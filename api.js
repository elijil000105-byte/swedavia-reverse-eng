/* ============================================================
   Hämtning
   ============================================================ */
async function fetchFlights(icao){
  const from = new Date();
  from.setMinutes(from.getMinutes() - 60);
  const to = new Date(from.getTime() + CONFIG.hours*3600*1000);
  const path = "/flights/airports/icao/"+icao+"/"+stamp(from)+"/"+stamp(to)
    + "?withLeg=true&direction=Both&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false";
  const url = (CONFIG.proxyBase ? CONFIG.proxyBase.replace(/\/$/,"") : "https://"+CONFIG.rapidHost) + path;
  const res = await fetch(url, {headers:{
    "x-rapidapi-host": CONFIG.rapidHost,
    "x-rapidapi-key": CONFIG.rapidKey
  }});
  if(!res.ok) throw new Error("API svarade "+res.status);
  const data = await res.json();
  const out = [];
  (data.departures || []).forEach(f => out.push(normalize(f, "dep", icao)));
  (data.arrivals   || []).forEach(f => out.push(normalize(f, "arr", icao)));
  if(!out.length) throw new Error("Tomt svar");
  return out;
}

/* AeroDataBox skickar tillbaka lite olika former beroende på endpoint.
   Normaliseraren plockar isär både "movement"-varianten och den med
   separata departure/arrival-objekt, så tavlan överlever ett formatbyte. */
function normalize(f, dir, icao){
  const own  = dir === "dep" ? (f.departure || f.movement || {}) : (f.arrival || f.movement || {});
  const other= dir === "dep" ? (f.arrival || f.movement || {})   : (f.departure || f.movement || {});
  const peer = other.airport || (f.movement && f.movement.airport) || {};
  const sched = parseLocal(own.scheduledTime || own.scheduledTimeLocal);
  const rev   = parseLocal(own.revisedTime || own.actualTime || own.predictedTime);
  const raw   = (f.status || "").toString();
  return {
    dir,
    number: f.number || f.callSign || "—",
    airline: (f.airline && f.airline.name) || "",
    peerName: peer.municipalityName || peer.name || peer.shortName || "—",
    peerCode: peer.iata || peer.icao || "",
    sched, rev,
    terminal: own.terminal || "",
    gate: own.gate || "",
    belt: own.baggageBelt || "",
    checkIn: own.checkInDesk || "",
    aircraft: (f.aircraft && f.aircraft.model) || "",
    rawStatus: raw,
    icao
  };
}
