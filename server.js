/**
 * Minimal proxy för AeroDataBox – noll beroenden.
 *
 *   node server.js
 *   → öppna http://localhost:8080
 *
 * Servern gör två saker:
 *   1. serverar filerna i mappen (index.html, css/, js/)
 *   2. vidarebefordrar allt under /flights/... och /airports/... till
 *      AeroDataBox med rätt headers, så webbläsaren slipper CORS
 *
 * Sätt CONFIG.proxyBase = "http://localhost:8080" i js/config.js när du
 * kör så här, annars anropar sidan API:t direkt från webbläsaren.
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const RAPID_HOST = "aerodatabox.p.rapidapi.com";
// Läser nyckeln från miljövariabel om den finns, annars projektets nyckel.
const RAPID_KEY = process.env.RAPIDAPI_KEY || "c634bdce5fmsh9f7bfc64f0072c0p1efa5cjsnd426456a304d";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/flights/") || url.pathname.startsWith("/airports/")) {
    return proxy(url, res);
  }

  // statiska filer
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.join(__dirname, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Hittar inte " + url.pathname);
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("Flyget kör på http://localhost:" + PORT);
});

function proxy(url, res) {
  const opts = {
    hostname: RAPID_HOST,
    path: url.pathname + url.search,
    method: "GET",
    headers: { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": RAPID_KEY }
  };
  https.get(opts, upstream => {
    let body = "";
    upstream.on("data", c => (body += c));
    upstream.on("end", () => {
      if (upstream.statusCode !== 200) {
        console.warn("AeroDataBox svarade", upstream.statusCode, body.slice(0, 200));
      }
      res.writeHead(upstream.statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(body);
    });
  }).on("error", err => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Nådde inte AeroDataBox: " + err.message }));
  });
}
