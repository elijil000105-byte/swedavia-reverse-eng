/* ============================================================
   Konfiguration
   ============================================================ */
const CONFIG = {
  rapidKey: "c634bdce5fmsh9f7bfc64f0072c0p1efa5cjsnd426456a304d",
  rapidHost: "aerodatabox.p.rapidapi.com",
  // Om webbläsaren blockerar anropet (CORS) kan du peka detta mot en egen
  // proxy, t.ex. "http://localhost:8080/". Lämna tomt för direktanrop.
  proxyBase: "",
  hours: 12,          // tidsfönster som hämtas (AeroDataBox tillåter max 12 h)
  refreshMs: 90000
};

const AIRPORTS = [
  {icao:"ESSA", iata:"ARN", name:"Stockholm Arlanda",  city:"Stockholm"},
  {icao:"ESGG", iata:"GOT", name:"Göteborg Landvetter",city:"Göteborg"},
  {icao:"ESSB", iata:"BMA", name:"Stockholm Bromma",   city:"Stockholm"},
  {icao:"ESMS", iata:"MMX", name:"Malmö Airport",      city:"Malmö"},
  {icao:"ESPA", iata:"LLA", name:"Luleå Airport",      city:"Luleå"},
  {icao:"ESNU", iata:"UME", name:"Umeå Airport",       city:"Umeå"},
  {icao:"ESNZ", iata:"OSD", name:"Åre Östersund",      city:"Östersund"},
  {icao:"ESSV", iata:"VBY", name:"Visby Airport",      city:"Visby"},
  {icao:"ESDF", iata:"RNB", name:"Ronneby Airport",    city:"Ronneby"},
  {icao:"ESNQ", iata:"KRN", name:"Kiruna Airport",     city:"Kiruna"}
];
