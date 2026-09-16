# Flyget

En reverse engineerad variant av Swedavias flygplatssajt, byggd på AeroDataBox
via RapidAPI. Skolprojekt, inte knutet till Swedavia.

Ren HTML, CSS och JavaScript. Inga ramverk, ingen byggkedja, inga beroenden.

## Struktur

```
flyget/
├── index.html        markup
├── css/style.css     designtokens, layout, mörkt läge
├── js/config.js      API-nyckel, tidsfönster, flygplatslista
├── js/state.js       applikationstillstånd, localStorage, tidsfunktioner
├── js/api.js         anrop mot AeroDataBox + normalisering av svaret
├── js/demo.js        genererad reservtrafik när API:t inte går att nå
├── js/ui.js          statuslogik och all rendering
├── js/app.js         laddning, URL-tillstånd, händelser, tangentbord
└── server.js         proxy + statisk server för lokal körning
```

Skripten laddas som vanliga `<script>`-taggar i den ordningen, inte som ES-moduler.
Det gör att `index.html` funkar även om du bara dubbelklickar på filen.

## Köra

**Direkt i webbläsaren:** öppna `index.html`. Fungerar om RapidAPI släpper
igenom anropet från webbläsaren, annars slår demoläget in automatiskt.

**Med proxy (rekommenderat):**

```bash
node server.js
```

Sätt sedan `proxyBase: "http://localhost:8080"` i `js/config.js`.
Nyckeln kan läggas i miljövariabeln `RAPIDAPI_KEY` istället för i koden:

```bash
RAPIDAPI_KEY=din_nyckel node server.js
```

## API:t

Sidan använder en endpoint, FIDS:

```
GET /flights/airports/icao/{icao}/{från}/{till}
    ?direction=Both&withCancelled=true&withLeg=true&withCodeshared=false
```

Tiderna skickas som lokal tid utan tidszon, `2026-09-16T08:00`. Fönstret får
vara max 12 timmar, därav `CONFIG.hours`.

Svaret har `departures` och `arrivals`. Varje post beskriver antingen sin egen
rörelse i `departure`/`arrival` eller motparten i `movement`, beroende på
anrop. `normalize()` i `js/api.js` hanterar båda formerna och plattar ut dem
till ett internt objekt, så resten av koden aldrig behöver bry sig.

Statussträngarna från API:t (`Expected`, `Boarding`, `GateClosed`, `Delayed`,
`Canceled`, `Departed`, `Arrived`, `EnRoute`, `Approaching`, `Diverted`)
översätts i `statusOf()` till fyra visuella lägen: `ok`, `info`, `late`, `can`.
Försening räknas alltid som skillnaden mellan `scheduledTime` och
`revisedTime`, inte från statusfältet, eftersom det uppdateras snabbare.

## Demoläget

Om anropet misslyckas genererar `demoFlights()` trafik med riktiga rutter och
flygbolag per flygplats, tidsfördelad efter morgon- och eftermiddagsrusning.
Slumpen är seedad på flygplatskod plus datum, så tavlan ser likadan ut hela
dagen istället för att hoppa vid varje omladdning. En banner talar om att det
är demodata.

## Egna funktioner utöver originalet

- alla tio flygplatser i samma vy
- stapeldiagram över avgångstäthet kommande 12 timmar med nu-markör
- avresekalkylator som räknar bakåt från revised time
- kötid i säkerhetskontrollen skattad från faktisk avgångstäthet
- bevakade flyg sparade i localStorage
- länkbart tillstånd via `?ap=ESSA&v=dep&q=CPH`
- tangentbord: `/` sök, `A` avgående, `D` ankommande, `R` uppdatera
- mörkt läge, mobillayout, synlig fokusmarkering

## Att bygga vidare på

- `/flights/number/{nummer}/{datum}` för att följa ett flyg hela vägen mellan
  två flygplatser istället för bara vid en
- terminalkarta med gate-positioner
- notiser vid gateändring via Notification API
- cacha svaret i sessionStorage för att spara anrop mot kvoten
