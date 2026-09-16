// server.js
// Enkel Express-backend som:
//  1) serverar frontend-filerna i /public
//  2) hämtar flygdata från en av två källor:
//     - AeroDataBox (om AERODATABOX_KEY är satt): riktig schemadata,
//       gate/terminal och äkta förseningar (schemalagt vs. faktiskt).
//     - OpenSky Network + adsbdb.com (annars, alltid som reservläge):
//       gratis och nyckelfritt, men bara faktiskt observerade rörelser,
//       ingen schemadata och ingen riktig förseningsberäkning.
//  Nycklar/inloggningar skickas ALDRIG till webbläsaren - allt går via
//  den här servern, som läser dem från miljövariabler.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import airports from "./data/airports.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const OPENSKY_USER = process.env.OPENSKY_USERNAME;
const OPENSKY_PASS = process.env.OPENSKY_PASSWORD;
const AERODATABOX_KEY = process.env.AERODATABOX_KEY;
const AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";

// --- Enkel in-memory-cache -------------------------------------------------
const CACHE_TTL_MS = 60 * 1000; // 60 sekunder
const cache = new Map();

function getCached(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  return null;
}
function setCached(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

function airportRef({ icao = null, iata = null, name = null, municipality = null } = {}) {
  if (!icao && !iata && !name) return null;
  return { icao, iata, name, municipality };
}

// =====================================================================
// KÄLLA 1: AeroDataBox (schemadata + äkta förseningar)
// =====================================================================
// OBS: fältnamnen nedan följer AeroDataBox publika dokumentation
// (doc.aerodatabox.com) vid det här projektets skrivande. RapidAPI-
// leverantörer justerar ibland svarsformat - om fält saknas eller ser
// konstiga ut, jämför mot ett live-anrop i RapidAPIs "Test Endpoint"-flik
// och justera mapAeroDataBoxFlight() därefter.

const ADB_WINDOW_HOURS = 10; // Basic-planen tillåter typiskt max ~12h per anrop

function pad(n) { return String(n).padStart(2, "0"); }

// AeroDataBox vill ha lokal tid utan tidszon-suffix, t.ex. "2026-09-16T14:00".
// Vi har ingen pålitlig lokal tidszon per flygplats i vår lilla airports.json,
// så vi använder UTC som approximation. För flygplatser långt från UTC+0
// kan tidsfönstret därför vara några timmar förskjutet mot den riktiga
// lokala dagen - det påverkar INTE vilka flygningar som hittas (de filtreras
// ändå på faktisk schemalagd tid), bara var brytpunkten "nu" hamnar i UTC.
function isoLocal(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

async function fetchAeroDataBox(icao, type) {
  const now = new Date();
  const from = new Date(now.getTime() - 2 * 3600 * 1000);
  const to = new Date(now.getTime() + (ADB_WINDOW_HOURS - 2) * 3600 * 1000);

  const direction = type === "departure" ? "Departure" : "Arrival";
  const url =
    `https://${AERODATABOX_HOST}/flights/airports/icao/${icao}/${isoLocal(from)}/${isoLocal(to)}` +
    `?withLeg=false&direction=${direction}&withCancelled=true&withCodeshared=true&withCargo=true&withPrivate=false&withLocation=false`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": AERODATABOX_KEY,
      "x-rapidapi-host": AERODATABOX_HOST,
    },
  });

  if (!res.ok) {
    throw new Error(`AeroDataBox svarade ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const list = type === "departure" ? json.departures : json.arrivals;
  return Array.isArray(list) ? list : [];
}

function mapAeroDataBoxFlight(raw, type) {
  const movement = raw.movement || {};
  const scheduledIso = movement.scheduledTime?.utc || null;
  const revisedIso =
    movement.revisedTime?.utc || movement.actualTime?.utc || movement.runwayTime?.utc || null;

  const scheduledTs = scheduledIso ? Math.floor(Date.parse(scheduledIso) / 1000) : null;
  const revisedTs = revisedIso ? Math.floor(Date.parse(revisedIso) / 1000) : null;
  const delayMinutes =
    scheduledTs != null && revisedTs != null ? Math.round((revisedTs - scheduledTs) / 60) : null;

  const otherAirport = airportRef({
    icao: movement.airport?.icao,
    iata: movement.airport?.iata,
    name: movement.airport?.name,
    municipality: movement.airport?.municipality,
  });

  return {
    source: "aerodatabox",
    callsign: raw.number || raw.callSign || "",
    airline: raw.airline?.name || null,
    time: revisedTs ?? scheduledTs,
    scheduledTime: scheduledTs,
    delayMinutes,
    status: raw.status || null,
    terminal: movement.terminal || null,
    gate: movement.gate || null,
    origin: type === "arrival" ? otherAirport : null,
    destination: type === "departure" ? otherAirport : null,
  };
}

async function getBoardFromAeroDataBox(icao, type) {
  const raw = await fetchAeroDataBox(icao, type);
  return raw
    .map((f) => mapAeroDataBoxFlight(f, type))
    .filter((f) => f.time)
    .sort((a, b) => b.time - a.time);
}

// =====================================================================
// KÄLLA 2 (reservläge): OpenSky Network + adsbdb.com ruttuppslag
// =====================================================================

const OPENSKY_WINDOW_HOURS = 3;

async function fetchOpenSky(icao, type) {
  const now = Math.floor(Date.now() / 1000);
  const begin = now - OPENSKY_WINDOW_HOURS * 3600;
  const end = now;

  const url = new URL(`https://opensky-network.org/api/flights/${type}`);
  url.searchParams.set("airport", icao);
  url.searchParams.set("begin", String(begin));
  url.searchParams.set("end", String(end));

  const headers = {};
  if (OPENSKY_USER && OPENSKY_PASS) {
    const token = Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  const res = await fetch(url, { headers });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky svarade ${res.status} ${res.statusText}`);
  return res.json();
}

function mapOpenSkyFlight(raw, type) {
  const timestamp = type === "departure" ? raw.firstSeen : raw.lastSeen;
  return {
    source: "opensky",
    callsign: (raw.callsign || "").trim(),
    time: timestamp,
    scheduledTime: null,
    delayMinutes: null,
    status: null,
    terminal: null,
    gate: null,
    airline: null,
    estDepartureAirport: raw.estDepartureAirport || null,
    estArrivalAirport: raw.estArrivalAirport || null,
  };
}

// --- Ruttuppslag via adsbdb.com (gratis, nyckelfritt) -----------------
const ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 timmar
const routeCache = new Map();
const MAX_ROUTE_LOOKUPS_PER_REQUEST = 30;
const ROUTE_LOOKUP_CONCURRENCY = 5;

async function fetchRoute(callsign) {
  if (!callsign) return null;
  const cached = routeCache.get(callsign);
  if (cached && cached.expires > Date.now()) return cached.data;

  let data = null;
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`);
    if (res.ok) {
      const json = await res.json();
      const fr = json?.response?.flightroute;
      if (fr) {
        data = {
          origin: airportRef({
            icao: fr.origin?.icao_code,
            iata: fr.origin?.iata_code,
            name: fr.origin?.name,
            municipality: fr.origin?.municipality,
          }),
          destination: airportRef({
            icao: fr.destination?.icao_code,
            iata: fr.destination?.iata_code,
            name: fr.destination?.name,
            municipality: fr.destination?.municipality,
          }),
          airline: fr.airline?.name || null,
        };
      }
    }
  } catch {
    data = null;
  }

  routeCache.set(callsign, { data, expires: Date.now() + ROUTE_CACHE_TTL_MS });
  return data;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getBoardFromOpenSky(icao, type) {
  const raw = await fetchOpenSky(icao, type);
  const basicFlights = raw
    .map((f) => mapOpenSkyFlight(f, type))
    .filter((f) => f.time)
    .sort((a, b) => b.time - a.time);

  return mapWithConcurrency(basicFlights, ROUTE_LOOKUP_CONCURRENCY, async (f, i) => {
    const shouldLookup = i < MAX_ROUTE_LOOKUPS_PER_REQUEST && f.callsign;
    const route = shouldLookup ? await fetchRoute(f.callsign) : null;
    return {
      ...f,
      airline: route?.airline || null,
      origin: route?.origin || (f.estDepartureAirport ? { icao: f.estDepartureAirport } : null),
      destination: route?.destination || (f.estArrivalAirport ? { icao: f.estArrivalAirport } : null),
    };
  });
}

// =====================================================================
// API-routes
// =====================================================================

app.get("/api/airports", (req, res) => {
  res.json(airports);
});

app.get("/api/board/:icao", async (req, res) => {
  const icao = req.params.icao.toUpperCase();
  const type = req.query.type === "arrival" ? "arrival" : "departure";
  const cacheKey = `${icao}:${type}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  let flights, source, windowHours;

  if (AERODATABOX_KEY) {
    try {
      flights = await getBoardFromAeroDataBox(icao, type);
      source = "aerodatabox";
      windowHours = ADB_WINDOW_HOURS;
    } catch (err) {
      console.error("AeroDataBox-anrop misslyckades, faller tillbaka på OpenSky:", err.message);
    }
  }

  if (!flights) {
    try {
      flights = await getBoardFromOpenSky(icao, type);
      source = "opensky";
      windowHours = OPENSKY_WINDOW_HOURS;
    } catch (err) {
      console.error(err);
      return res.status(502).json({
        error: "Kunde inte hämta flygdata just nu. Försök igen om en liten stund.",
      });
    }
  }

  const payload = {
    icao,
    type,
    source,
    windowHours,
    generatedAt: Math.floor(Date.now() / 1000),
    flights,
  };
  setCached(cacheKey, payload);
  res.json({ ...payload, cached: false });
});

// --- Statisk frontend ------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Flygplatstavlan körs på http://localhost:${PORT}`);
  console.log(AERODATABOX_KEY ? "Datakälla: AeroDataBox (schema + förseningar)" : "Datakälla: OpenSky Network (reservläge, ingen AERODATABOX_KEY satt)");
});
