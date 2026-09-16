# Flygtavlan

<<<<<<< HEAD
En egen avgångar/ankomster-tavla. Node/Express-backend + ren HTML/CSS/JS-frontend,
ingen build-process. Stödjer två datakällor:

- **AeroDataBox** (rekommenderas) – riktig schemadata, gate/terminal och äkta
  förseningar. Kräver en gratis API-nyckel, se nedan.
- **OpenSky Network + adsbdb.com** – helt gratis och nyckelfritt, används
  automatiskt som reservläge om ingen AeroDataBox-nyckel är satt.

## Skaffa en gratis AeroDataBox-nyckel

1. Skapa ett konto på [rapidapi.com](https://rapidapi.com/) (gratis).
2. Sök upp **AeroDataBox** i marketplace och öppna fliken *Pricing*.
3. Välj **Basic**-planen (0 $/mån, 600 API-units).
4. Klicka *Subscribe*. RapidAPI kan be om kortverifiering för vissa konton,
   men Basic-planen debiteras inte.
5. Under fliken *Endpoints* hittar du din `x-rapidapi-key`.
6. Kopiera `.env.example` till `.env` och klistra in nyckeln som
   `AERODATABOX_KEY=din-nyckel`. Lägg **aldrig** en nyckel direkt i koden,
   i git, eller dela den i en chatt – betrakta den som exponerad om du gör det,
   och regenerera den i så fall på RapidAPI.

Utan nyckel fungerar appen ändå, den använder då OpenSky-reservläget nedan.

## Viktig begränsning i reservläget (OpenSky) — läs detta
=======
En egen avgångar/ankomster-tavla, byggd runt [OpenSky Networks](https://opensky-network.org/)
gratis, nyckelfria API. Node/Express-backend + ren HTML/CSS/JS-frontend, ingen build-process.

## Viktig begränsning — läs detta först
>>>>>>> 46b59df993ea84d367c17cf3b26e18a9b3970054

Swedavias tavla bygger på flygbolagens **schemadata**: den vet vilka flyg som *ska* gå,
och jämför det mot verkligheten för att räkna ut förseningar.

OpenSky har ingen sådan schemadata. Det är ett nätverk av ADS-B-mottagare som bara vet
**var flygplan faktiskt befinner sig och har befunnit sig**. Det betyder att den här
tavlan:

- visar **senaste 3 timmarnas faktiska** avgångar/ankomster, inte kommande schemalagda flyg
- **inte kan visa förseningar** (det finns ingen tidtabell att jämföra mot)
<<<<<<< HEAD
- kan sakna mindre flygplatser helt om de har få ADS-B-mottagare i närheten

**Ursprung/destination:** OpenSkys egna fält för det (`estDepartureAirport`/
`estArrivalAirport`) är bara en gissning utifrån radartäckning och saknas ofta.
Backend kompletterar därför med ett andra, gratis och nyckelfritt uppslag mot
[adsbdb.com](https://www.adsbdb.com/), som kopplar flygnummer (callsign) till en
rutt via en community-databas. Den täcker de flesta reguljära linjeflyg men missar
ofta privatflyg, taxiflyg, frakt och militärtrafik - dyker "Okänd flygplats" upp
är det oftast därför, inte ett fel i koden.

=======
- ibland saknar destination/ursprungsflygplats om ADS-B-täckningen var dålig just då
- kan sakna mindre flygplatser helt om de har få ADS-B-mottagare i närheten

>>>>>>> 46b59df993ea84d367c17cf3b26e18a9b3970054
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
