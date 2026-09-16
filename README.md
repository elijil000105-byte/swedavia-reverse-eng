# Flygtavlan

En egen avgångar/ankomster-tavla, byggd runt [OpenSky Networks](https://opensky-network.org/)
gratis, nyckelfria API. Node/Express-backend + ren HTML/CSS/JS-frontend, ingen build-process.

## Viktig begränsning — läs detta först

Swedavias tavla bygger på flygbolagens **schemadata**: den vet vilka flyg som *ska* gå,
och jämför det mot verkligheten för att räkna ut förseningar.

OpenSky har ingen sådan schemadata. Det är ett nätverk av ADS-B-mottagare som bara vet
**var flygplan faktiskt befinner sig och har befunnit sig**. Det betyder att den här
tavlan:

- visar **senaste 3 timmarnas faktiska** avgångar/ankomster, inte kommande schemalagda flyg
- **inte kan visa förseningar** (det finns ingen tidtabell att jämföra mot)
- ibland saknar destination/ursprungsflygplats om ADS-B-täckningen var dålig just då
- kan sakna mindre flygplatser helt om de har få ADS-B-mottagare i närheten

Om du vill ha riktig schema- och förseningsdata måste du byta datakälla till något som
**AeroDataBox** eller **AviationStack** (båda kräver en gratis API-nyckel). Backend-lagret
är byggt så att det går att byta ut `fetchOpenSky()` i `server.js` mot ett anrop till en
sådan tjänst utan att röra frontend.

## Kom igång lokalt

Kräver Node.js 18 eller senare.

```bash
npm install
npm start
```

Öppna sedan `http://localhost:3000`.

Vill du ha ett högre dagligt anropstak mot OpenSky (valfritt): skapa ett gratiskonto på
opensky-network.org, kopiera `.env.example` till `.env` och fyll i
`OPENSKY_USERNAME`/`OPENSKY_PASSWORD`.

## Hur det hänger ihop

```
flight-board/
├── server.js          Express-server: serverar frontend + proxyar/cachar OpenSky
├── data/airports.json Lista över valbara flygplatser (lägg gärna till fler)
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js         Sökruta, tabbar, hämtning och rendering av tavlan
├── package.json
└── .env.example
```

Backend cachar varje flygplats/riktning i 60 sekunder i minnet, för att hålla sig inom
OpenSkys dagliga anropsgräns (ca 400 anrop/dygn för anonym åtkomst). Frontend hämtar om
sig automatiskt var 60:e sekund.

## Lägga till fler flygplatser

Lägg till en rad i `data/airports.json` med ICAO-kod, IATA-kod, namn, stad, land och
koordinater. ICAO-koden är det som faktiskt skickas till OpenSky.

## Driftsättning

Appen är en helt vanlig Node/Express-app och kan köras på t.ex. Render, Railway, Fly.io
eller en egen VPS:

1. Pusha koden till ett Git-repo.
2. Skapa en ny webbtjänst hos leverantören, peka på repot.
3. Build command: `npm install`. Start command: `npm start`.
4. Sätt ev. `OPENSKY_USERNAME`/`OPENSKY_PASSWORD` som miljövariabler i leverantörens
   dashboard (lägg **aldrig** in dem direkt i koden).

Eftersom nyckeln/inloggningen (om du använder någon) bara finns i backend, är den aldrig
synlig i webbläsaren — till skillnad från om man anropar OpenSky direkt från frontend.
