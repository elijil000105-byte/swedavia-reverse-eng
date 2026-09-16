/* ============================================================
   Demodata – används om API:t inte går att nå
   ============================================================ */
const ROUTES = {
  ESSA:[["Köpenhamn","CPH","SAS"],["London Heathrow","LHR","British Airways"],["Amsterdam","AMS","KLM"],["Helsingfors","HEL","Finnair"],["Göteborg","GOT","SAS"],["Umeå","UME","Norwegian"],["Luleå","LLA","SAS"],["Berlin","BER","Norwegian"],["Frankfurt","FRA","Lufthansa"],["Paris CDG","CDG","Air France"],["Zürich","ZRH","Swiss"],["Málaga","AGP","Norwegian"],["Istanbul","IST","Turkish Airlines"],["Reykjavik","KEF","Icelandair"],["Oslo","OSL","SAS"],["Visby","VBY","SAS"],["Dubai","DXB","Emirates"],["Warszawa","WAW","LOT"]],
  ESGG:[["Köpenhamn","CPH","SAS"],["Amsterdam","AMS","KLM"],["London Gatwick","LGW","Norwegian"],["Frankfurt","FRA","Lufthansa"],["Stockholm Arlanda","ARN","SAS"],["Helsingfors","HEL","Finnair"],["Alicante","ALC","Norwegian"],["München","MUC","Lufthansa"],["Istanbul","IST","Turkish Airlines"],["Warszawa","WAW","LOT"]],
  ESSB:[["Malmö","MMX","BRA"],["Visby","VBY","BRA"],["Göteborg","GOT","BRA"],["Umeå","UME","BRA"],["Halmstad","HAD","BRA"],["Helsingfors","HEL","Finnair"],["Ronneby","RNB","BRA"]],
  ESMS:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Bromma","BMA","BRA"],["Frankfurt","FRA","Lufthansa"],["Gdansk","GDN","Wizz Air"],["Bukarest","OTP","Wizz Air"],["Alicante","ALC","Norwegian"]],
  ESPA:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Arlanda","ARN","Norwegian"],["Göteborg","GOT","SAS"],["Kiruna","KRN","SAS"],["Umeå","UME","Amapola"]],
  ESNU:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Bromma","BMA","BRA"],["Göteborg","GOT","Norwegian"],["Luleå","LLA","Amapola"]],
  ESNZ:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Bromma","BMA","BRA"],["Göteborg","GOT","Amapola"],["London Gatwick","LGW","SAS"]],
  ESSV:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Bromma","BMA","BRA"],["Göteborg","GOT","BRA"],["Norrköping","NRK","Amapola"]],
  ESDF:[["Stockholm Bromma","BMA","BRA"],["Stockholm Arlanda","ARN","SAS"],["Berlin","BER","Ryanair"]],
  ESNQ:[["Stockholm Arlanda","ARN","SAS"],["Stockholm Arlanda","ARN","Norwegian"],["Luleå","LLA","SAS"]]
};
const PREFIX = {"SAS":"SK","Norwegian":"DY","BRA":"TF","Finnair":"AY","KLM":"KL","Lufthansa":"LH","British Airways":"BA","Air France":"AF","Swiss":"LX","Turkish Airlines":"TK","Icelandair":"FI","Emirates":"EK","LOT":"LO","Wizz Air":"W6","Ryanair":"FR","Amapola":"HP"};

function demoFlights(icao){
  const routes = ROUTES[icao] || ROUTES.ESSA;
  const big = ["ESSA","ESGG"].includes(icao);
  const perHour = big ? 14 : (icao === "ESSB" || icao === "ESMS" ? 5 : 3);
  let seed = icao.split("").reduce((a,c)=>a+c.charCodeAt(0),0) + new Date().getDate()*13;
  const rnd = () => { seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const out = [];
  const start = new Date(); start.setMinutes(start.getMinutes()-60, 0, 0);
  for(let h=0; h<CONFIG.hours; h++){
    const hour = new Date(start.getTime() + h*3600*1000);
    const load = hour.getHours() >= 5 && hour.getHours() <= 8 ? 1.4
               : hour.getHours() >= 15 && hour.getHours() <= 18 ? 1.3
               : hour.getHours() >= 23 || hour.getHours() < 5 ? 0.15 : 1;
    const n = Math.round(perHour * load);
    for(let i=0;i<n;i++){
      const r = routes[Math.floor(rnd()*routes.length)];
      const dir = rnd() > .5 ? "dep" : "arr";
      const sched = new Date(hour.getTime() + Math.floor(rnd()*60)*60000);
      const roll = rnd();
      let rev = null, raw = "Expected";
      if(roll > .97) raw = "Canceled";
      else if(roll > .80){ rev = new Date(sched.getTime() + (5 + Math.floor(rnd()*70))*60000); raw = "Delayed"; }
      const mins = (sched - new Date())/60000;
      if(raw !== "Canceled"){
        if(mins < -20) raw = dir === "dep" ? "Departed" : "Arrived";
        else if(mins < 5 && !rev) raw = dir === "dep" ? "GateClosed" : "Approaching";
        else if(mins < 35 && dir === "dep" && !rev) raw = "Boarding";
      }
      out.push({
        dir, number: (PREFIX[r[2]]||"XX") + (100 + Math.floor(rnd()*899)),
        airline: r[2], peerName: r[0], peerCode: r[1],
        sched, rev,
        terminal: big ? String(1 + Math.floor(rnd()*5)) : "",
        gate: dir === "dep" ? (big ? "F"+(20+Math.floor(rnd()*40)) : String(1+Math.floor(rnd()*6))) : "",
        belt: dir === "arr" ? String(1+Math.floor(rnd()*7)) : "",
        checkIn: dir === "dep" ? (big ? "A"+(1+Math.floor(rnd()*30)) : "1-4") : "",
        aircraft: ["Airbus A320neo","Boeing 737-800","ATR 72","Airbus A350","Embraer 195","Saab 340"][Math.floor(rnd()*6)],
        rawStatus: raw, icao
      });
    }
  }
  return out.sort((a,b)=>a.sched-b.sched);
}
