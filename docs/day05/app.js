// Day 5: flip through Fussball stickers photographed around Galway. The left map shows where
// each one was, the right map shows its club's stadium. The URL hash names the step
// (#overview, #sticker-3), so every sticker has its own link.

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
const STICKER_ZOOM = 17;
const GROUND_ZOOM = 15;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

const NARROW = matchMedia("(max-width: 760px)").matches;

const galwayMap = new maplibregl.Map({ container: "galway-map", style: OSM_STYLE, center: [-9.0, 53.26], zoom: 11,
                                       attributionControl: false });
const groundMap = new maplibregl.Map({ container: "ground-map", style: OSM_STYLE, center: [3, 51], zoom: 4,
                                       attributionControl: false });
for (const map of [galwayMap, groundMap]) {
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true }));
  // On a phone the maps are small, so start with the attribution folded behind its (i) button.
  if (NARROW) map.once("load", () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
}

const card = document.getElementById("card");
const count = document.getElementById("count");
const prev = document.getElementById("prev");
const next = document.getElementById("next");

let data, steps, current = 0;
const pins = new Map();          // sticker id -> pin element
const groundDots = new Map();    // club -> { el, label }

const fmt = new Intl.NumberFormat("en-IE");

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function move(map, options) {
  REDUCED_MOTION ? map.jumpTo(options) : map.flyTo({ ...options, duration: 1600, essential: true });
}

function fit(map, points, padding) {
  const bounds = points.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
  map.fitBounds(bounds, { padding, maxZoom: 14, duration: REDUCED_MOTION ? 0 : 1200 });
}

// Great-circle arc from Galway to a stadium, as a line of points.
function arc(from, to, steps = 64) {
  const rad = Math.PI / 180;
  const [l1, p1, l2, p2] = [from[0] * rad, from[1] * rad, to[0] * rad, to[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d), b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    points.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad]);
  }
  return points;
}

function stickerCount(club) {
  return data.stickers.filter(s => s.club === club).length;
}

// ---- Panel ----

function overviewCard() {
  const thumbs = data.stickers.map(s => {
    const club = data.clubs[s.club];
    return `<li><button type="button" data-step="${s.n}" aria-label="Sticker ${s.n}: ${escapeHtml(club.label)}">
      <img src="${s.photo}" alt="" loading="lazy"><span class="num">${s.n}</span></button></li>`;
  }).join("");
  return `<p>Fussball stickers photographed on lampposts, signs and bins around Galway. Flip through them to see where each one was, and the club’s stadium.</p>
    <ul class="thumbs">${thumbs}</ul>`;
}

function stickerCard(s) {
  const club = data.clubs[s.club];
  const ground = club.ground ? `${escapeHtml(club.ground)}, ` : "";
  return `<img class="photo" src="${s.photo}" alt="${escapeHtml(club.label)} sticker, photographed in Galway.">
    <h2>${s.n}. ${escapeHtml(club.label)}</h2>
    <p class="ground">Stadium: ${ground}${fmt.format(Math.round(club.km / 10) * 10)} km from Galway</p>`;
}

// ---- Steps ----

function showStep(i, { updateHash = true } = {}) {
  current = Math.max(0, Math.min(steps.length - 1, i));
  const s = steps[current];
  card.innerHTML = s ? stickerCard(s) : overviewCard();
  card.scrollTop = 0;
  count.textContent = s ? `Sticker ${s.n} of ${data.stickers.length}` : "Overview";
  prev.disabled = current === 0;
  next.disabled = current === steps.length - 1;
  if (updateHash) history.replaceState(null, "", s ? `#sticker-${s.n}` : "#overview");

  for (const [id, el] of pins) {
    el.classList.toggle("active", s?.id === id);
    el.classList.toggle("dim", Boolean(s) && s.id !== id);
  }
  for (const [club, { el, label }] of groundDots) {
    el.classList.toggle("active", s?.club === club);
    label.hidden = !s || s.club !== club;
  }
  if (groundMap.getLayer("arcs")) {
    groundMap.setPaintProperty("arcs", "line-opacity", s ? ["case", ["==", ["get", "club"], s.club], 0.9, 0.15] : 0.55);
  }

  if (s) {
    const club = data.clubs[s.club];
    move(galwayMap, { center: [s.lon, s.lat], zoom: STICKER_ZOOM });
    move(groundMap, { center: [club.lon, club.lat], zoom: GROUND_ZOOM });
  } else {
    fit(galwayMap, data.stickers.map(p => [p.lon, p.lat]), 50);
    fit(groundMap, [data.galway, ...Object.values(data.clubs).map(c => [c.lon, c.lat])], 50);
  }
}

function stepFromHash() {
  const match = location.hash.match(/^#sticker-(\d+)$/);
  return match ? steps.findIndex(s => s && s.n === Number(match[1])) : 0;
}

prev.addEventListener("click", () => showStep(current - 1));
next.addEventListener("click", () => showStep(current + 1));
card.addEventListener("click", e => {
  const button = e.target.closest("button[data-step]");
  if (button) showStep(Number(button.dataset.step));
});
document.addEventListener("keydown", e => {
  if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") showStep(current + 1);
  if (e.key === "ArrowLeft") showStep(current - 1);
});
window.addEventListener("hashchange", () => showStep(Math.max(0, stepFromHash()), { updateHash: false }));

// ---- Markers and arcs ----

function addMarkers() {
  for (const s of data.stickers) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pin";
    el.textContent = s.n;
    el.setAttribute("aria-label", `Sticker ${s.n}: ${data.clubs[s.club].label}`);
    el.addEventListener("click", () => showStep(s.n));
    new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(galwayMap);
    pins.set(s.id, el);
  }

  const galway = document.createElement("div");
  galway.className = "galway-dot";
  galway.title = "Galway";
  new maplibregl.Marker({ element: galway }).setLngLat(data.galway).addTo(groundMap);

  for (const [name, club] of Object.entries(data.clubs)) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ground-dot";
    const n = stickerCount(name);
    el.title = `${club.label}${n > 1 ? ` (${n} stickers)` : ""}`;
    el.setAttribute("aria-label", el.title);
    const label = document.createElement("span");
    label.className = "marker-label";
    label.textContent = club.label;
    label.hidden = true;
    el.append(label);
    el.addEventListener("click", () => showStep(data.stickers.find(s => s.club === name).n));
    new maplibregl.Marker({ element: el }).setLngLat([club.lon, club.lat]).addTo(groundMap);
    groundDots.set(name, { el, label });
  }
}

function addArcs() {
  groundMap.addSource("arcs", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: Object.entries(data.clubs).map(([name, club]) => ({
        type: "Feature",
        properties: { club: name, n: stickerCount(name) },
        geometry: { type: "LineString", coordinates: arc(data.galway, [club.lon, club.lat]) },
      })),
    },
  });
  groundMap.addLayer({
    id: "arcs",
    type: "line",
    source: "arcs",
    layout: { "line-cap": "round" },
    paint: { "line-color": "#c8323c", "line-width": ["+", 1, ["*", 1.5, ["get", "n"]]], "line-opacity": 0.55 },
  });
}

// ---- Start ----

const dataReady = fetch("stickers.json").then(r => r.json()).then(d => {
  data = d;
  steps = [null, ...data.stickers];   // step 0 is the overview
  addMarkers();
  showStep(Math.max(0, stepFromHash()), { updateHash: false });
});
const arcsReady = new Promise(resolve => groundMap.on("style.load", resolve));
Promise.all([dataReady, arcsReady]).then(() => {
  addArcs();
  showStep(current, { updateHash: false });
});
