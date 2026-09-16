const REFRESH_MS = 60 * 1000;

const el = {
  search: document.getElementById('airport-search'),
  results: document.getElementById('airport-results'),
  tabDeparture: document.getElementById('tab-departure'),
  tabArrival: document.getElementById('tab-arrival'),
  airportName: document.getElementById('airport-name'),
  airportCode: document.getElementById('airport-code'),
  clock: document.getElementById('clock'),
  refreshStatus: document.getElementById('refresh-status'),
  boardBody: document.getElementById('board-body'),
};

let airports = [];
let airportsByIcao = new Map();
let state = {
  airport: null, // airport object
  type: 'departure',
  refreshTimer: null,
  countdown: REFRESH_MS / 1000,
  countdownTimer: null,
};

// ---------- Boot ----------

init();

async function init() {
  airports = await fetch('/api/airports').then(r => r.json());
  airportsByIcao = new Map(airports.map(a => [a.icao, a]));

  tickClock();
  setInterval(tickClock, 1000);

  el.search.addEventListener('input', onSearchInput);
  el.search.addEventListener('focus', onSearchInput);
  document.addEventListener('click', (e) => {
    if (!el.results.contains(e.target) && e.target !== el.search) {
      el.results.classList.add('hidden');
    }
  });

  el.tabDeparture.addEventListener('click', () => setType('departure'));
  el.tabArrival.addEventListener('click', () => setType('arrival'));

  // Default: Arlanda, om den finns i listan
  const defaultAirport = airportsByIcao.get('ESSA') || airports[0];
  if (defaultAirport) selectAirport(defaultAirport);
}

function tickClock() {
  el.clock.textContent = new Date().toLocaleTimeString('sv-SE');
}

// ---------- Airport search ----------

function onSearchInput() {
  const q = el.search.value.trim().toLowerCase();
  const matches = (q === ''
    ? airports
    : airports.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.iata.toLowerCase() === q ||
        a.icao.toLowerCase() === q ||
        a.iata.toLowerCase().includes(q)
      )
  ).slice(0, 8);

  renderResults(matches);
}

function renderResults(matches) {
  if (matches.length === 0) {
    el.results.innerHTML = `<div class="airport-result"><span class="city">Inga träffar</span></div>`;
    el.results.classList.remove('hidden');
    return;
  }
  el.results.innerHTML = matches.map(a => `
    <div class="airport-result" data-icao="${a.icao}">
      <div>
        <div class="name">${a.name}</div>
        <div class="city">${a.city}, ${a.country}</div>
      </div>
      <span class="codes">${a.iata} · ${a.icao}</span>
    </div>
  `).join('');
  el.results.classList.remove('hidden');

  el.results.querySelectorAll('.airport-result[data-icao]').forEach(node => {
    node.addEventListener('click', () => {
      const airport = airportsByIcao.get(node.dataset.icao);
      if (airport) selectAirport(airport);
    });
  });
}

function selectAirport(airport) {
  state.airport = airport;
  el.search.value = '';
  el.results.classList.add('hidden');
  el.airportName.textContent = `${airport.city} — ${airport.name}`;
  el.airportCode.textContent = `${airport.iata} / ${airport.icao}`;
  loadBoard();
  scheduleRefresh();
}

// ---------- Tabs ----------

function setType(type) {
  if (type === state.type) return;
  state.type = type;
  el.tabDeparture.classList.toggle('active', type === 'departure');
  el.tabDeparture.setAttribute('aria-selected', String(type === 'departure'));
  el.tabArrival.classList.toggle('active', type === 'arrival');
  el.tabArrival.setAttribute('aria-selected', String(type === 'arrival'));
  loadBoard();
}

// ---------- Board loading ----------

async function loadBoard() {
  if (!state.airport) return;
  el.boardBody.innerHTML = `<div class="loading-state">Hämtar trafik…</div>`;

  try {
    const res = await fetch(`/api/board/${state.airport.icao}?type=${state.type}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Serverfel (${res.status})`);
    }
    const data = await res.json();
    renderBoard(data);
  } catch (err) {
    el.boardBody.innerHTML = `<div class="error-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderBoard(data) {
  if (!data.flights || data.flights.length === 0) {
    el.boardBody.innerHTML = `<div class="empty-state">
      Ingen trafik registrerad de senaste ${data.windowHours} timmarna för den här flygplatsen.
    </div>`;
    return;
  }

  el.boardBody.innerHTML = data.flights.map(f => rowHtml(f, data.type)).join('');
}

function rowHtml(f, type) {
  const time = new Date(f.timestamp * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const elapsedMin = Math.max(0, Math.round((Date.now() / 1000 - f.timestamp) / 60));
  const elapsedLabel = elapsedMin < 1 ? 'nyss' : `för ${elapsedMin} min sedan`;

  const status = type === 'departure' ? `Avgått · ${elapsedLabel}` : `Landat · ${elapsedLabel}`;

  const otherName = f.otherAirport ? airportLabel(f.otherAirport) : 'Okänd flygplats';
  const route = type === 'departure'
    ? `${state.airport.iata}<span class="arrow">→</span>${otherName}`
    : `${otherName}<span class="arrow">→</span>${state.airport.iata}`;

  return `
    <div class="row">
      <span class="col-time">${time}</span>
      <span class="col-flight">${escapeHtml(f.callsign)}</span>
      <span class="col-route">${route}</span>
      <span class="col-status">${status}</span>
    </div>
  `;
}

function airportLabel(icao) {
  const a = airportsByIcao.get(icao);
  return a ? a.iata : icao;
}

// ---------- Auto-refresh ----------

function scheduleRefresh() {
  clearInterval(state.refreshTimer);
  clearInterval(state.countdownTimer);

  state.refreshTimer = setInterval(loadBoard, REFRESH_MS);

  state.countdown = REFRESH_MS / 1000;
  updateRefreshLabel();
  state.countdownTimer = setInterval(() => {
    state.countdown -= 1;
    if (state.countdown <= 0) state.countdown = REFRESH_MS / 1000;
    updateRefreshLabel();
  }, 1000);
}

function updateRefreshLabel() {
  el.refreshStatus.textContent = `Uppdateras om ${state.countdown}s`;
}

// ---------- Utils ----------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
