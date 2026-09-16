/* ============================================================
   Status
   ============================================================ */
function statusOf(f){
  const raw = (f.rawStatus||"").toLowerCase();
  const delay = f.rev && f.sched ? Math.round((f.rev - f.sched)/60000) : 0;
  if(raw.includes("cancel")) return {kind:"can", label:"Inställd", delay:0};
  if(raw.includes("divert")) return {kind:"can", label:"Omdirigerad", delay};
  if(delay >= 5) return {kind:"late", label:"Försenad "+delay+" min", delay};
  if(raw.includes("board")) return {kind:"info", label:"Boarding", delay:0};
  if(raw.includes("gateclosed") || raw.includes("closed")) return {kind:"info", label:"Gate stängd", delay:0};
  if(raw.includes("checkin")) return {kind:"info", label:"Incheckning öppen", delay:0};
  if(raw.includes("depart")) return {kind:"ok", label:"Avgått", delay:0};
  if(raw.includes("arriv")) return {kind:"ok", label:"Landat", delay:0};
  if(raw.includes("approach")) return {kind:"info", label:"Inflygning", delay:0};
  if(raw.includes("enroute")) return {kind:"info", label:"I luften", delay:0};
  return {kind:"ok", label:"Enligt tidtabell", delay:0};
}

/* ============================================================
   Rendering
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function renderRail(){
  $("#rail").innerHTML = AIRPORTS.map(a =>
    '<button class="ap" data-icao="'+a.icao+'" aria-current="'+(a.icao===state.airport)+'">'+
    '<b>'+esc(a.city)+'</b><i class="mono">'+a.iata+'</i></button>').join("");
}

function currentAirport(){ return AIRPORTS.find(a=>a.icao===state.airport); }

function visible(){
  const now = new Date();
  let list = state.flights.filter(f => f.dir === state.dir);
  if(state.q){
    const q = state.q.toLowerCase();
    list = list.filter(f => (f.number+" "+f.airline+" "+f.peerName+" "+f.peerCode).toLowerCase().includes(q));
  }
  if(state.soon) list = list.filter(f => f.sched && f.sched - now < 3*3600*1000 && f.sched - now > -30*60000);
  if(state.onlyDev) list = list.filter(f => ["late","can"].includes(statusOf(f).kind));
  return list.sort((a,b)=>(a.rev||a.sched)-(b.rev||b.sched));
}

function renderHero(){
  const ap = currentAirport();
  $("#apName").textContent = ap.name;
  const deps = state.flights.filter(f=>f.dir==="dep");
  const all = state.flights;
  const late = all.filter(f=>statusOf(f).kind==="late");
  const can = all.filter(f=>statusOf(f).kind==="can");
  const avg = late.length ? Math.round(late.reduce((s,f)=>s+statusOf(f).delay,0)/late.length) : 0;
  const punkt = all.length ? Math.round(100*(all.length-late.length-can.length)/all.length) : 100;

  $("#apSub").textContent = state.loading ? "Laddar trafikbilden …"
    : all.length + " rörelser de närmaste " + CONFIG.hours + " timmarna. "
      + (late.length + can.length === 0 ? "Inga avvikelser just nu."
         : late.length + " försenade, " + can.length + " inställda.");

  $("#stats").innerHTML = [
    ["Punktlighet", punkt+" %"],
    ["Försenade flyg", late.length],
    ["Inställda", can.length],
    ["Snittförsening", avg ? avg+" min" : "–"],
    ["Kö i säkerhetskontrollen", securityWait()+" min"]
  ].map(s => '<div class="stat"><b class="mono">'+s[1]+'</b><span>'+s[0]+'</span></div>').join("");

  // pulskurvan: halvtimmesstaplar
  const start = new Date(); start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
  start.setHours(start.getHours()-1);
  const slots = [];
  for(let i=0;i<CONFIG.hours*2;i++){
    const t0 = new Date(start.getTime()+i*30*60000);
    const t1 = new Date(t0.getTime()+30*60000);
    const inSlot = deps.filter(f=>f.sched>=t0 && f.sched<t1);
    slots.push({t0, ok:inSlot.filter(f=>statusOf(f).kind!=="late"&&statusOf(f).kind!=="can").length,
                late:inSlot.filter(f=>statusOf(f).kind==="late").length,
                can:inSlot.filter(f=>statusOf(f).kind==="can").length});
  }
  const max = Math.max(1, ...slots.map(s=>s.ok+s.late+s.can));
  const now = new Date();
  $("#bars").innerHTML = slots.map(s=>{
    const isNow = now >= s.t0 && now < new Date(s.t0.getTime()+30*60000);
    const h = v => (v/max*68).toFixed(1)+"px";
    return '<div class="bar'+(isNow?" now":"")+'" title="'+fmt(s.t0)+" – "+(s.ok+s.late+s.can)+' avgångar">'
      + (s.can?'<span class="s-can" style="height:'+h(s.can)+'"></span>':"")
      + (s.late?'<span class="s-late" style="height:'+h(s.late)+'"></span>':"")
      + (s.ok?'<span class="s-ok" style="height:'+h(s.ok)+'"></span>':"")
      + '</div>';
  }).join("");
  $("#axis").innerHTML = slots.filter((_,i)=>i%4===0).map(s=>'<span class="mono">'+fmt(s.t0)+'</span>').join("");
  const peak = slots.reduce((a,b)=>(b.ok+b.late+b.can)>(a.ok+a.late+a.can)?b:a, slots[0]);
  $("#pulseHint").textContent = peak ? "Mest trafik kring " + fmt(peak.t0) : "";
}

/* Kötid i säkerhetskontrollen skattas från faktisk avgångstäthet
   närmaste två timmarna – inte en fast gissning per klockslag. */
function securityWait(){
  const now = new Date();
  const soon = state.flights.filter(f=>f.dir==="dep" && f.sched>now && f.sched-now < 2*3600*1000).length;
  const ap = currentAirport();
  const cap = ["ESSA","ESGG"].includes(ap.icao) ? 26 : ap.icao==="ESSB"||ap.icao==="ESMS" ? 10 : 6;
  return Math.max(4, Math.min(45, Math.round(6 + (soon/cap)*22)));
}

function renderBoard(){
  const box = $("#boardBox");
  if(state.loading){ box.innerHTML = '<div class="empty">Hämtar flygningar …</div>'; return; }
  const list = visible();
  const dep = state.dir === "dep";
  if(!list.length){
    box.innerHTML = '<div class="empty"><b>Inga flyg matchar</b>Rensa sökningen eller ta bort filtren för att se hela tavlan.</div>';
    return;
  }
  let html = '<div class="row head"><span>Tid</span><span>Ny tid</span><span>'+(dep?"Destination":"Från")+
    '</span><span>Flight</span><span>'+(dep?"Gate":"Bagage")+'</span><span class="term">Term.</span><span>Status</span><span></span></div>';
  list.slice(0,120).forEach((f,i)=>{
    const st = statusOf(f);
    const key = f.number+"|"+fmt(f.sched);
    const isOpen = state.open === key;
    const tracked = state.tracked.some(t=>t.key===key);
    html += '<div class="row f '+st.kind+'" data-key="'+esc(key)+'" tabindex="0" role="button" aria-expanded="'+isOpen+'">'
      + '<span class="tm mono'+(f.rev?" struck":"")+'">'+fmt(f.sched)+'</span>'
      + '<span class="new mono">'+(f.rev?fmt(f.rev):"")+'</span>'
      + '<span class="dest"><b>'+esc(f.peerName)+'</b><i class="mono">'+esc(f.peerCode)+'</i>'
      +   '<span class="al" style="display:block">'+esc(f.airline)+'</span></span>'
      + '<span class="mono" style="font-size:14px">'+esc(f.number)+'</span>'
      + '<span class="gate mono">'+esc(dep ? (f.gate||"–") : (f.belt||"–"))+'</span>'
      + '<span class="term mono" style="font-size:14px">'+esc(f.terminal||"–")+'</span>'
      + '<span class="st '+st.kind+'">'+esc(st.label)+'</span>'
      + '<button class="fav" data-fav="'+esc(key)+'" aria-pressed="'+tracked+'" aria-label="Bevaka '+esc(f.number)+'">'
      +   '<svg width="17" height="17" viewBox="0 0 24 24" fill="'+(tracked?"currentColor":"none")+'" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z"/></svg></button>'
      + (isOpen ? detailHtml(f, st) : "")
      + '</div>';
  });
  box.innerHTML = html;
}

function detailHtml(f, st){
  const dep = f.dir === "dep";
  const t = state.trip;
  const wait = securityWait();
  const buffer = (t.intl === "intl" ? 60 : 35) + (t.bags === "yes" ? 30 : 0) + wait;
  const base = f.rev || f.sched;
  const leave = base ? new Date(base.getTime() - (buffer + Number(t.travel||0))*60000) : null;
  const mins = leave ? Math.round((leave - new Date())/60000) : 0;

  const steps = dep ? [
    ["Incheckning", f.checkIn ? "Disk "+f.checkIn : "Öppnar 2 h före avgång"],
    ["Säkerhetskontroll", "Beräknad kö "+wait+" min just nu"],
    ["Gate "+(f.gate||"meddelas senare"), f.terminal ? "Terminal "+f.terminal : "Terminal meddelas"],
    ["Avgång "+fmt(base), st.kind==="can" ? "Inställd" : (f.aircraft || "")]
  ] : [
    ["Avgång från "+f.peerName, f.airline],
    ["Ankomst "+fmt(base), st.label],
    ["Terminal "+(f.terminal||"–"), f.aircraft || ""],
    ["Bagageband "+(f.belt||"meddelas vid landning"), "Bagaget kommer normalt 10–20 min efter landning"]
  ];

  return '<div class="detail"><div class="dwrap">'
    + '<div><ul class="tl">' + steps.map((s,i)=>
        '<li class="'+(i<2?"on":"")+'"><span class="dot"></span><span class="mono" style="font-size:13px;color:var(--ink-2)"></span>'
        + '<span class="w"><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></span></li>').join("")
    + '</ul></div>'
    + (dep ? '<div class="calc"><h4>När ska du åka hemifrån?</h4>'
      + '<p>Räknar bakåt från '+fmt(base)+' med dagens kötid i kontrollen.</p>'
      + '<div class="fields">'
      + '<div><label for="cTravel">Restid hit (min)</label><input id="cTravel" type="number" min="0" max="300" value="'+Number(t.travel||45)+'"></div>'
      + '<div><label for="cBags">Incheckat bagage</label><select id="cBags"><option value="no"'+(t.bags==="no"?" selected":"")+'>Nej</option><option value="yes"'+(t.bags==="yes"?" selected":"")+'>Ja</option></select></div>'
      + '<div><label for="cIntl">Resa</label><select id="cIntl"><option value="dom"'+(t.intl==="dom"?" selected":"")+'>Inrikes</option><option value="intl"'+(t.intl==="intl"?" selected":"")+'>Utrikes</option></select></div>'
      + '</div>'
      + '<div class="leave"><b class="mono">'+(leave?fmt(leave):"–")+'</b>'
      + '<span>Lämna hemmet för att ha '+buffer+' min marginal på flygplatsen.<br>'
      + (mins > 0 ? 'Du har <em>'+mins+' min</em> kvar.' : '<em>Dags att åka nu.</em>')+'</span></div></div>'
      : '<div class="calc"><h4>Möta någon?</h4><p>Var på plats vid ankomsthallen ungefär 20 minuter efter landning – tid för utrymning, passkontroll och bagage.</p>'
        + '<div class="leave"><b class="mono">'+(base?fmt(new Date(base.getTime()+20*60000)):"–")+'</b><span>Trolig tid i ankomsthallen för '+esc(f.number)+'.</span></div></div>')
    + '</div></div>';
}

function renderTracked(){
  const sec = $("#trackedSec");
  if(!state.tracked.length){ sec.hidden = true; return; }
  sec.hidden = false;
  $("#tcards").innerHTML = state.tracked.map(t=>{
    const f = state.flights.find(x=>x.number+"|"+fmt(x.sched) === t.key);
    const st = f ? statusOf(f) : null;
    const ap = AIRPORTS.find(a=>a.icao===t.icao);
    return '<div class="tcard '+(st?st.kind:"")+'">'
      + '<button class="x" data-untrack="'+esc(t.key)+'" aria-label="Sluta bevaka">×</button>'
      + '<div class="n mono">'+esc(t.number)+'</div>'
      + '<div class="r">'+esc(t.peer)+' · '+esc(ap?ap.iata:"")+'</div>'
      + '<div class="t mono">'+(f ? fmt(f.rev||f.sched) : t.time)+'</div>'
      + '<div class="r">'+(st ? esc(st.label) : "Utanför tidsfönstret")+'</div></div>';
  }).join("");
}

function renderNotice(){
  const slot = $("#noticeSlot");
  if(state.live || state.loading){ slot.innerHTML = ""; return; }
  slot.innerHTML = '<div class="notice"><span><b>Demoläge.</b> '
    + esc(state.error || "Livedata kunde inte hämtas")
    + '. Tavlan visar genererad trafik med rätt rutter och rimliga tider så att gränssnittet går att testa.</span>'
    + '<button id="retry">Försök igen</button></div>';
}

function render(){ renderRail(); renderHero(); renderTracked(); renderNotice(); renderBoard(); syncUrl(); }
