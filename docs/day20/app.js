// Ireland's rain, filling up: each column grows from 1 January to 31 December, either through an average year
// (monthly means 2020–2025, spread evenly within each month) or day by day through 2025.

// Dry to wet: pale straw through teal to strong blue, the usual precipitation convention (ColorBrewer YlGnBu,
// stopped before its darkest navy, which would vanish into the dark background).
const RAMP = ["#f3f9c4", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#2166c2", "#2f45b8"].map(hexToRgb);
// Class edges (mm per year), spaced evenly along the ramp; colour slides continuously between them.
const STOPS = [0, 900, 1100, 1300, 1500, 1800, 2200];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const YEAR_DAYS = 365;
const YEAR_MS = 15000;

const DATA_VERSION = 5; // bump when export_web.py rewrites the JSON, so browsers refetch it
// Hexagon width in km: 5 by default, ?size=10 or ?size=15 to compare.
const HEX_KM = { 10: 10, 15: 15 }[new URLSearchParams(location.search).get("size")] || 5;
const METRES_PER_MM = 18; // a 2,900 mm column stands about 53 km tall
const PIN_M = 62000; // town pins rise above the tallest column (2,932 mm × 18 m)
const GAUGE_MAX = 2000; // mm at the top of the panel's gauges: Clifden's hexagon gets up to about 1,840, Dublin's about 800

// A west–east transect at about the same latitude: rain steps down from the Atlantic coast to the Irish Sea.
const TOWNS = [
  { name: "Clifden", position: [-10.02, 53.49] },
  { name: "Galway", position: [-9.05, 53.27] },
  { name: "Athlone", position: [-7.94, 53.42] },
  { name: "Dublin", position: [-6.26, 53.35] },
];
const LAND = [22, 34, 47];
const LINE = [44, 58, 74];
const MATERIAL = { ambient: 0.55, diffuse: 0.55, shininess: 24, specularColor: [50, 60, 70] };
const TOOLTIP_STYLE = { background: "rgba(11, 22, 34, 0.94)", color: "#e8eef4", border: "1px solid #2c3a4a", borderRadius: "6px", padding: "6px 8px" };

const IRELAND = [[-10.7, 51.4], [-5.4, 55.4]];
const VIEW_ANGLE = { pitch: 45, bearing: -15 }; // looking a little west of north, so the low east sits in front of the tall west

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const els = {
  panel: document.getElementById("panel"),
  toggle: document.getElementById("toggle"),
  play: document.getElementById("play"),
  scrub: document.getElementById("scrub"),
  date: document.getElementById("date"),
  national: document.getElementById("national"),
  legend: document.getElementById("legend"),
  gauges: document.getElementById("gauges"),
  modes: document.getElementById("modes"),
  intro: document.getElementById("intro"),
  year: document.getElementById("year"),
};

const MODES = {
  avg: { intro: () => `Each ${HEX_KM} km hexagon fills like a rain gauge from 1 January, using the mean of 2020–2025.`, year: "" },
  2025: { intro: () => `Each ${HEX_KM} km hexagon fills day by day through 2025.`, year: " 2025" },
};

let progress = 0; // 0 = 1 Jan, 1 = 31 Dec
let mode = "avg"; // "avg" or "2025"
let playing = !reduceMotion;
let last = null;

function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rampAt(t) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f));
}

/** Position along the ramp for v mm: linear between neighbouring stops, pale end at the top stop and above. */
function colour(v) {
  const last = STOPS.length - 1;
  if (v >= STOPS[last]) return rampAt(1);
  const k = Math.max(0, STOPS.findIndex((e, i) => v >= e && v < STOPS[i + 1]));
  return rampAt((k + (v - STOPS[k]) / (STOPS[k + 1] - STOPS[k])) / last);
}

const fmt = (v) => Math.round(v).toLocaleString("en-IE");

function drawLegend() {
  const bar = RAMP.map((c, i) => `rgb(${c.join(",")}) ${(100 * i) / (RAMP.length - 1)}%`).join(", ");
  els.legend.innerHTML =
    `<div class="bar" style="background: linear-gradient(to right, ${bar})"></div>` +
    `<div class="labels">${STOPS.map((e, i) => `<span style="left: ${(100 * i) / (STOPS.length - 1)}%">${fmt(e)}${i === STOPS.length - 1 ? "+" : ""}</span>`).join("")}</div>`;
}

/** Fit Ireland into the part of the window the panel doesn't cover, then tilt. */
function initialView() {
  const { innerWidth: width, innerHeight: height } = window;
  const panel = width <= 600 ? { left: 20, bottom: height * 0.5 } : { left: Math.min(380, width * 0.4), bottom: 20 };
  const flat = new deck.WebMercatorViewport({ width, height }).fitBounds(IRELAND, { padding: { top: 30, right: 30, ...panel } });
  // Tilting and rotating spread the near (south-east) corner and lift the tall columns; zoom out to keep it all in frame.
  return { longitude: flat.longitude - 0.3, latitude: flat.latitude + 0.15, zoom: flat.zoom - 0.2, ...VIEW_ANGLE };
}

/** Month index and fraction through it for a progress in [0, 1]; rain within a month is spread evenly over its days. */
function monthAt(p) {
  let day = p * YEAR_DAYS;
  for (let i = 0; i < 12; i++) {
    if (day <= DAYS[i] || i === 11) return { i, frac: Math.min(day / DAYS[i], 1) };
    day -= DAYS[i];
  }
}

function dateLabel(p) {
  const { i, frac } = monthAt(p);
  return `${Math.max(1, Math.round(frac * DAYS[i]))} ${MONTHS[i]}`;
}

/** Where in the year we are, for whichever mode is showing. */
function position(p) {
  const at = monthAt(p);
  const x = Math.min(p * YEAR_DAYS, YEAR_DAYS - 1e-6);
  return { ...at, day: Math.floor(x), dayFrac: x - Math.floor(x) };
}

/** Rain so far (mm) at a position. The average spreads each month's mean evenly over its days; 2025 adds up real days. */
function soFar(d, at) {
  if (mode === "avg") return d.cum[at.i] + at.frac * d.m[at.i];
  return d.dcum[at.day] + at.dayFrac * (d.dcum[at.day + 1] - d.dcum[at.day]);
}

function dayLabel(i) {
  let m = 0;
  while (i >= DAYS[m]) i -= DAYS[m++];
  return `${i + 1} ${MONTHS[m]}`;
}

/** Land-area-weighted national mean of value(d). */
function nationalMean(hexes, value) {
  let sum = 0, w = 0;
  for (const d of hexes) { sum += value(d) * d.w; w += d.w; }
  return sum / w;
}

function tooltip({ object: d }) {
  if (!d) return null;
  const at = position(progress);
  const html =
    mode === "avg"
      ? `<b>By ${dateLabel(progress)}: ${fmt(soFar(d, at))} mm</b><br>Whole year: ${fmt(d.a)} mm`
      : `<b>By ${dateLabel(progress)} 2025: ${fmt(soFar(d, at))} mm</b><br>Whole of 2025: ${fmt(d.dcum[YEAR_DAYS])} mm<br>` +
        `<span style="color:#8a9bb0">Wettest day: ${dayLabel(d.wetDay)}, ${d.wetMm.toFixed(1)} mm</span>`;
  return {
    html,
    style: TOOLTIP_STYLE,
  };
}

function baseLayers(outlines) {
  return [
    new deck.SolidPolygonLayer({ id: "ni", data: outlines.ni, getPolygon: (d) => d, getFillColor: LAND }),
    new deck.PathLayer({ id: "ni-edge", data: outlines.ni.flat(), getPath: (d) => d, getColor: LINE, widthUnits: "pixels", getWidth: 1 }),
  ];
}

/** A pin per town: a thin line from the ground up past the tallest column, with the name on top. The line is
 * depth-tested, so columns in front of a town hide its foot and the pin reads as standing behind them. */
function townLayers() {
  const top = (d) => [...d.position, PIN_M];
  return [
    new deck.LineLayer({
      id: "town-pins",
      data: TOWNS,
      getSourcePosition: (d) => [...d.position, 0],
      getTargetPosition: top,
      getColor: [255, 255, 255],
      getWidth: 2.5,
      widthUnits: "pixels",
    }),
    new deck.TextLayer({
      id: "towns",
      data: TOWNS,
      getPosition: top,
      getText: (d) => d.name,
      getSize: 14,
      getColor: [232, 238, 244],
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      getPixelOffset: [0, -4],
      fontFamily: '"Avenir Next", "Helvetica Neue", system-ui, sans-serif',
      fontSettings: { sdf: true },
      outlineWidth: 4,
      outlineColor: [11, 22, 34, 255],
      // drawn without depth testing, so the names stay readable whatever is in front
      parameters: { depthCompare: "always", depthWriteEnabled: false },
    }),
  ];
}

/** A rain gauge per town in the panel, on a fixed 0–GAUGE_MAX mm scale. */
function drawGauges() {
  const ticks = [2000, 1500, 1000, 500].map((v) => `<span style="bottom: ${(100 * v) / GAUGE_MAX}%">${fmt(v)}</span>`).join("");
  els.gauges.innerHTML =
    `<div class="gauge-ticks">${ticks}</div>` +
    TOWNS.map(
      (t, i) => `<div class="gauge"><div class="tube"><div class="fill" id="fill-${i}"></div></div><div class="g-mm" id="mm-${i}">0 mm</div><div class="g-name">${t.name}</div></div>`,
    ).join("");
}

/** The hexagon whose centre is nearest each town (centres from the outline's six corners). */
function findTownHexes(hexes) {
  const centre = (d) => [0, 1].map((k) => d.p[0].slice(0, 6).reduce((s, c) => s + c[k], 0) / 6);
  for (const t of TOWNS) {
    let best = Infinity;
    for (const d of hexes) {
      const [x, y] = centre(d);
      const dist = ((x - t.position[0]) * Math.cos((53.3 * Math.PI) / 180)) ** 2 + (y - t.position[1]) ** 2;
      if (dist < best) { best = dist; t.hex = d; }
    }
  }
}

function main([hexes, outlines]) {
  for (const d of hexes) {
    d.cum = [0];
    for (let i = 0; i < 11; i++) d.cum.push(d.cum[i] + d.m[i]);
  }
  const deckgl = new deck.DeckGL({
    container: "map",
    initialViewState: initialView(),
    controller: true,
    getTooltip: tooltip,
    // preserveDrawingBuffer lets the canvas be captured for the preview image
    deviceProps: { webgl: { preserveDrawingBuffer: true } },
  });
  const under = baseLayers(outlines);
  findTownHexes(hexes);
  drawGauges();
  let daily = null; // loaded the first time 2025 is picked

  function render() {
    const at = position(progress);
    deckgl.setProps({
      layers: [
        ...under,
        new deck.PolygonLayer({
          id: "water",
          data: hexes,
          getPolygon: (d) => d.p,
          extruded: true,
          stroked: false,
          getElevation: (d) => soFar(d, at) * METRES_PER_MM,
          getFillColor: (d) => colour(soFar(d, at)),
          material: MATERIAL,
          pickable: true,
          updateTriggers: { getElevation: [progress, mode], getFillColor: [progress, mode] },
        }),
        ...townLayers(),
      ],
    });
    els.date.textContent = dateLabel(progress);
    els.year.textContent = MODES[mode].year;
    els.national.textContent = `${fmt(nationalMean(hexes, (d) => soFar(d, at)))} mm`;
    els.scrub.value = Math.round(progress * 1000);

    const mm = TOWNS.map((t) => soFar(t.hex, at));
    mm.forEach((v, i) => {
      const fill = document.getElementById(`fill-${i}`);
      fill.style.height = `${Math.min(100, (100 * v) / GAUGE_MAX)}%`;
      fill.style.background = `rgb(${colour(v).join(",")})`;
      document.getElementById(`mm-${i}`).textContent = `${fmt(v)} mm`;
    });
  }

  function setPlaying(on) {
    playing = on;
    last = null;
    els.play.textContent = on ? "❚❚ Pause" : progress >= 1 ? "↻ Replay" : "▶ Play";
    els.play.setAttribute("aria-pressed", String(on));
    if (on) requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!playing) return;
    if (last !== null) progress = Math.min(1, progress + (now - last) / YEAR_MS);
    last = now;
    render();
    if (progress >= 1) return setPlaying(false);
    requestAnimationFrame(tick);
  }

  els.play.addEventListener("click", () => {
    if (!playing && progress >= 1) progress = 0;
    setPlaying(!playing);
  });
  els.scrub.addEventListener("input", () => {
    if (playing) setPlaying(false);
    progress = els.scrub.value / 1000;
    render();
    els.play.textContent = progress >= 1 ? "↻ Replay" : "▶ Play";
  });

  async function setMode(m) {
    if (m === "2025" && !daily) {
      daily = await get(`daily_2025_${HEX_KM}km.json`);
      hexes.forEach((d, k) => {
        const r = daily.r[k];
        d.dcum = new Float32Array(r.length + 1);
        d.wetDay = 0;
        for (let i = 0; i < r.length; i++) {
          d.dcum[i + 1] = d.dcum[i] + r[i] / 10; // tenths of a mm -> mm
          if (r[i] > r[d.wetDay]) d.wetDay = i;
        }
        d.wetMm = r[d.wetDay] / 10;
      });
    }
    mode = m;
    for (const b of els.modes.children) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    els.intro.textContent = MODES[m].intro();
    render();
  }
  // Switching keeps the date, so pausing on a day and flipping compares the same moment.
  els.modes.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setMode(b.dataset.mode);
  });

  if (reduceMotion) progress = 1;
  render();
  setPlaying(playing);
}

els.intro.textContent = MODES.avg.intro();
els.toggle.addEventListener("click", () => {
  const collapsed = els.panel.classList.toggle("collapsed");
  els.toggle.textContent = collapsed ? "Show panel" : "Hide panel";
  els.toggle.setAttribute("aria-expanded", String(!collapsed));
});
drawLegend();

const get = (name) => fetch(`${name}?v=${DATA_VERSION}`).then((r) => r.json());
Promise.all([get(`hexes_${HEX_KM}km.json`), get("outlines.json")]).then(main);
