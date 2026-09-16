/* ============================================================
   Tillstånd
   ============================================================ */
const state = {
  airport: "ESSA",
  dir: "dep",
  q: "",
  soon: false,
  onlyDev: false,
  flights: [],
  open: null,
  live: false,
  loading: true,
  error: null,
  tracked: load("flyget.tracked", []),
  trip: load("flyget.trip", {travel:45, bags:"no", intl:"dom"})
};

function load(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

/* ============================================================
   Tid
   ============================================================ */
const pad = n => String(n).padStart(2,"0");
function fmt(d){ return d ? pad(d.getHours())+":"+pad(d.getMinutes()) : ""; }
function stamp(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); }
function parseLocal(v){
  if(!v) return null;
  let s = typeof v === "string" ? v : (v.local || v.utc || "");
  if(!s) return null;
  s = s.trim().replace(" ", "T");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
}
