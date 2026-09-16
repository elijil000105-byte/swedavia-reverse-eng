// server.js
// Enkel Express-backend som:
//  1) serverar frontend-filerna i /public
//  2) fungerar som proxy mot OpenSky Network så att ev. inloggningsuppgifter
//     aldrig skickas till webbläsaren, och så att vi kan cacha svaren
//     (OpenSky har hård gräns på antal anrop per dygn för anonyma användare).

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import airports from "./data/airports.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Valfria inloggningsuppgifter för OpenSky. Utan dem fungerar allt ändå,
// men med ett registrerat konto får man en högre daglig anropsgräns.
// Sätts som miljövariabler, aldrig hårdkodat i koden.
const OPENSKY_USER = process.env.OPENSKY_USERNAME;
const OPENSKY_PASS = process.env.OPENSKY_PASSWORD;

// --- Enkel in-memory-cache -------------------------------------------------
// Nyckel: `${icao}:${type}` -> { expires, data }
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

// --- OpenSky-anrop -----------------------------------------------------
// OpenSky har ingen "schemalagd avgång/ankomst"-data, bara faktiskt
// observerade rörelser (ADS-B). Vi hämtar därför "senaste X timmarna".
const WINDOW_HOURS = 3;

async function fetchOpenSky(icao, type) {
  const now = Math.floor(Date.now() / 1000);
  const begin = now - WINDOW_HOURS * 3600;
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

  if (res.status === 404) {
    // OpenSky svarar 404 om det inte finns någon trafik i fönstret - inte ett fel.
    return [];
  }
  if (!res.ok) {
    throw new Error(`OpenSky svarade ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function mapFlight(raw, type) {
  const otherAirport = type === "departure" ? raw.estArrivalAirport : raw.estDepartureAirport;
  const timestamp = type === "departure" ? raw.firstSeen : raw.lastSeen;
  return {
    callsign: (raw.callsign || "").trim() || "Okänd",
    icao24: raw.icao24,
    otherAirport: otherAirport || null,
    timestamp, // unix seconds
    estDepartureAirport: raw.estDepartureAirport || null,
    estArrivalAirport: raw.estArrivalAirport || null,
  };
}

// --- API-routes ----------------------------------------------------------

app.get("/api/airports", (req, res) => {
  res.json(airports);
});

app.get("/api/board/:icao", async (req, res) => {
  const icao = req.params.icao.toUpperCase();
  const type = req.query.type === "arrival" ? "arrival" : "departure";
  const cacheKey = `${icao}:${type}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const raw = await fetchOpenSky(icao, type);
    const flights = raw
      .map((f) => mapFlight(f, type))
      .filter((f) => f.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    const payload = {
      icao,
      type,
      windowHours: WINDOW_HOURS,
      generatedAt: Math.floor(Date.now() / 1000),
      flights,
    };
    setCached(cacheKey, payload);
    res.json({ ...payload, cached: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({
      error: "Kunde inte hämta data från OpenSky just nu. Försök igen om en liten stund.",
    });
  }
});

// --- Statisk frontend ------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Flygplatstavlan körs på http://localhost:${PORT}`);
});
