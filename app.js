/* ============================================================
   Ladda
   ============================================================ */
async function loadAirport(){
  state.loading = true; state.open = null; render();
  try{
    state.flights = await fetchFlights(state.airport);
    state.live = true; state.error = null;
    $("#srcLine").textContent = "Livedata hämtad " + fmt(new Date()) + " från AeroDataBox.";
  }catch(err){
    state.flights = demoFlights(state.airport);
    state.live = false; state.error = err.message;
    $("#srcLine").textContent = "Demodata genererad " + fmt(new Date()) + ". Öppna filen lokalt eller via en proxy för livedata.";
  }
  state.loading = false;
  render();
}

/* ============================================================
   URL-tillstånd
   ============================================================ */
function syncUrl(){
  const p = new URLSearchParams();
  p.set("ap", state.airport); p.set("v", state.dir);
  if(state.q) p.set("q", state.q);
  history.replaceState(null, "", "?"+p.toString());
}
(function readUrl(){
  const p = new URLSearchParams(location.search);
  if(p.get("ap") && AIRPORTS.some(a=>a.icao===p.get("ap"))) state.airport = p.get("ap");
  if(p.get("v") === "arr") state.dir = "arr";
  if(p.get("q")) state.q = p.get("q");
})();

/* ============================================================
   Händelser
   ============================================================ */
$("#rail").addEventListener("click", e=>{
  const b = e.target.closest(".ap"); if(!b) return;
  state.airport = b.dataset.icao; loadAirport();
});
$("#depBtn").addEventListener("click", ()=>setDir("dep"));
$("#arrBtn").addEventListener("click", ()=>setDir("arr"));
function setDir(d){
  state.dir = d; state.open = null;
  $("#depBtn").setAttribute("aria-pressed", d==="dep");
  $("#arrBtn").setAttribute("aria-pressed", d==="arr");
  renderBoard(); syncUrl();
}
$("#q").value = state.q;
$("#q").addEventListener("input", e=>{ state.q = e.target.value.trim(); state.open = null; renderBoard(); syncUrl(); });
$("#chipSoon").addEventListener("click", e=>{ state.soon = !state.soon; e.currentTarget.setAttribute("aria-pressed", state.soon); renderBoard(); });
$("#chipLate").addEventListener("click", e=>{ state.onlyDev = !state.onlyDev; e.currentTarget.setAttribute("aria-pressed", state.onlyDev); renderBoard(); });
$("#refreshBtn").addEventListener("click", loadAirport);

$("#boardBox").addEventListener("click", e=>{
  const fav = e.target.closest("[data-fav]");
  if(fav){ toggleTrack(fav.dataset.fav); return; }
  if(e.target.closest(".detail")) return;
  const row = e.target.closest(".row.f"); if(!row) return;
  state.open = state.open === row.dataset.key ? null : row.dataset.key;
  renderBoard();
});
$("#boardBox").addEventListener("keydown", e=>{
  if(e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest(".row.f"); if(!row || e.target.closest("[data-fav]")) return;
  e.preventDefault();
  state.open = state.open === row.dataset.key ? null : row.dataset.key;
  renderBoard();
});
$("#boardBox").addEventListener("change", e=>{
  if(!["cTravel","cBags","cIntl"].includes(e.target.id)) return;
  state.trip = {
    travel: Number($("#cTravel") ? $("#cTravel").value : state.trip.travel) || 0,
    bags: $("#cBags") ? $("#cBags").value : state.trip.bags,
    intl: $("#cIntl") ? $("#cIntl").value : state.trip.intl
  };
  save("flyget.trip", state.trip);
  renderBoard();
});
document.body.addEventListener("click", e=>{
  const un = e.target.closest("[data-untrack]");
  if(un){ state.tracked = state.tracked.filter(t=>t.key!==un.dataset.untrack); save("flyget.tracked", state.tracked); renderTracked(); renderBoard(); }
  if(e.target.id === "retry") loadAirport();
});

function toggleTrack(key){
  const has = state.tracked.some(t=>t.key===key);
  if(has) state.tracked = state.tracked.filter(t=>t.key!==key);
  else{
    const f = state.flights.find(x=>x.number+"|"+fmt(x.sched) === key);
    if(f) state.tracked.push({key, number:f.number, peer:f.peerName, time:fmt(f.sched), icao:f.icao});
  }
  save("flyget.tracked", state.tracked);
  renderTracked(); renderBoard();
}

document.addEventListener("keydown", e=>{
  if(e.target.matches("input,select,textarea")) { if(e.key==="Escape") e.target.blur(); return; }
  if(e.key === "/"){ e.preventDefault(); $("#q").focus(); }
  if(e.key.toLowerCase() === "a") setDir("dep");
  if(e.key.toLowerCase() === "d") setDir("arr");
  if(e.key.toLowerCase() === "r") loadAirport();
});

/* tema */
const themeBtn = $("#themeBtn");
function applyTheme(t){
  if(t) document.documentElement.setAttribute("data-theme", t);
  const dark = (document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light")) === "dark";
  themeBtn.textContent = dark ? "Ljust läge" : "Mörkt läge";
}
themeBtn.addEventListener("click", ()=>{
  const dark = (document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light")) === "dark";
  const next = dark ? "light" : "dark";
  save("flyget.theme", next); applyTheme(next);
});
applyTheme(load("flyget.theme", null));

/* start */
loadAirport();
setInterval(()=>{ if(!document.hidden) loadAirport(); }, CONFIG.refreshMs);
