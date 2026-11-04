// DesignSafe on the map: a step-by-step story over MapLibre.
//
// All data is served from the 30day-map-data-2026 repo on GitHub Pages, so this page
// doesn't depend on geoapi:
//   story/*.json   built by story_designsafe_points/build_data.py (copied from its data/)
//   *.pmtiles      a copy of the GeoAPI published-maps archive

const DATA_REPO = "https://nathanfranklin.github.io/30day-map-data-2026/day1_designsafe/";
const DATA_BASE = `${DATA_REPO}story/`;
const ARCHIVE = {
  url: `${DATA_REPO}published_ds_maps_20260818T131449Z.pmtiles`,
  generated_at: "2026-08-18T13:14:49Z",
};
const TRACTS_URL = "https://designsafe-ci.org/data/browser/public/designsafe.storage.published/PRJ-6361";

const COLORS = {
  surface: "#0b1622",
  project: "#c7d0db",
  mapped: "#199e70",
  image: "#3987e5",
  cloud: "#d95926",
  tract: "#3cc28c",
};

const WORLD = { center: [-35, 28], zoom: 1.35 };
const ARCHIVE_LAYERS = ["archive-tracts", "archive-other", "archive-shape", "archive-cloud-fill", "archive-cloud-line", "archive-images"];

// Each chapter: camera (a view, or bounds to fit), base map, and visible layers.
// `tracts: false` hides the census-tract points, which clutter zoomed-in maps.
// The Browse chapters, one per Hazmapper map, are added from data/maps.geojson.
const CHAPTERS = {
  projects: { view: WORLD, basemap: "dark", layers: ["projects"] },
  mapped: { view: WORLD, basemap: "dark", layers: ["projects-dim", "maps"] },
  outro: { view: WORLD, basemap: "dark", layers: ["projects-dim", "maps"] },
};

// Wider than this (degrees), a map is shown on the dark base map rather than imagery.
const IMAGERY_MAX_SPAN = 3;

const FEATURE_NAMES = {
  image: ["photo or image", "photos or images"],
  point_cloud: ["point cloud", "point clouds"],
  point: ["point", "points"],
  shape: ["shape", "shapes"],
  streetview: ["streetview sequence", "streetview sequences"],
  video: ["video", "videos"],
  questionnaire: ["questionnaire", "questionnaires"],
};

const STORY_LAYERS = ["projects", "projects-dim", "maps", ...ARCHIVE_LAYERS];

let summary = null;
let mapsList = [];
let mapsByProject = {};
let archiveReady = false;
let layersReady = false;
let currentChapter = "projects";

const isNarrow = () => window.matchMedia("(max-width: 760px)").matches;
// The panel grows with the window (see style.css), so measure it rather than assume a width.
const cameraPadding = () =>
  isNarrow() ? 30 : { top: 60, bottom: 60, right: 60, left: document.getElementById("panel").getBoundingClientRect().right + 60 };

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// External links open in a new tab; the icon and hidden text say so.
const EXTERNAL_ICON = '<svg class="ext" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" ' +
  'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function link(url, label) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}${EXTERNAL_ICON}` +
    '<span class="visually-hidden"> (opens in a new tab)</span></a>';
}

const map = new maplibregl.Map({
  container: "map",
  center: WORLD.center,
  zoom: WORLD.zoom,
  minZoom: 0,
  maxZoom: 18,
  attributionControl: false,
  style: {
    version: 8,
    sources: {
      dark: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 16,
        attribution: "Base map © Esri, HERE, Garmin, © OpenStreetMap contributors",
      },
      imagery: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": COLORS.surface } },
      { id: "dark", type: "raster", source: "dark", paint: { "raster-opacity": 1, "raster-opacity-transition": { duration: 900 } } },
      { id: "imagery", type: "raster", source: "imagery", paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 900 } } },
    ],
  },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
// Credits stay written out on wider screens (Esri asks for its attribution to be visible on
// the map). MapLibre switches to the compact ⓘ button on narrow maps by itself.
map.addControl(new maplibregl.AttributionControl({
  customAttribution: 'Data: <a href="https://www.designsafe-ci.org/" target="_blank" rel="noopener">NHERI DesignSafe</a> and Hazmapper',
}), "bottom-right");

function addStaticLayers() {
  map.addSource("projects", { type: "geojson", data: `${DATA_BASE}projects.geojson` });
  map.addSource("maps", { type: "geojson", data: `${DATA_BASE}maps.geojson` });

  const radius = ["interpolate", ["linear"], ["zoom"], 1, 3.2, 6, 6];
  map.addLayer({
    id: "projects", type: "circle", source: "projects",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": radius, "circle-color": COLORS.project, "circle-opacity": 0.9,
      "circle-stroke-color": COLORS.surface, "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "projects-dim", type: "circle", source: "projects",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": radius, "circle-color": COLORS.project, "circle-opacity": 0.35,
      "circle-stroke-color": COLORS.surface, "circle-stroke-width": 0.5,
    },
  });
  map.addLayer({
    id: "maps", type: "circle", source: "maps",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 7, 6, 11],
      "circle-color": "rgba(25, 158, 112, 0.25)",
      "circle-stroke-color": COLORS.mapped, "circle-stroke-width": 2.5,
    },
  });
}

function addArchiveLayers(archive) {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  map.addSource("archive", {
    type: "vector",
    url: `pmtiles://${archive.url}`,
    attribution: '<a href="https://hazmapper.tacc.utexas.edu/hazmapper/" target="_blank" rel="noopener">Hazmapper</a> via GeoAPI',
  });

  const isTract = ["==", ["get", "ds_project_url"], TRACTS_URL];
  const before = "projects";
  const pointRadius = ["interpolate", ["linear"], ["zoom"], 2, 1.6, 8, 3, 14, 6];
  map.addLayer({
    id: "archive-tracts", type: "circle", source: "archive", "source-layer": "point",
    filter: isTract, layout: { visibility: "none" },
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.0, 8, 2.2], "circle-color": COLORS.tract, "circle-opacity": 0.85 },
  }, before);
  for (const layer of ["point", "streetview", "video", "questionnaire"]) {
    map.addLayer({
      id: layer === "point" ? "archive-other" : `archive-other-${layer}`,
      type: "circle", source: "archive", "source-layer": layer,
      filter: ["!", isTract], layout: { visibility: "none" },
      paint: {
        "circle-radius": pointRadius, "circle-color": COLORS.project,
        "circle-stroke-color": COLORS.surface, "circle-stroke-width": 1,
      },
    }, before);
  }
  map.addLayer({
    id: "archive-shape", type: "line", source: "archive", "source-layer": "shape",
    layout: { visibility: "none" },
    paint: { "line-color": COLORS.project, "line-width": 1.5, "line-opacity": 0.85 },
  }, before);
  map.addLayer({
    id: "archive-cloud-fill", type: "fill", source: "archive", "source-layer": "point_cloud",
    layout: { visibility: "none" },
    paint: { "fill-color": COLORS.cloud, "fill-opacity": 0.28 },
  }, before);
  map.addLayer({
    id: "archive-cloud-line", type: "line", source: "archive", "source-layer": "point_cloud",
    layout: { visibility: "none" },
    paint: { "line-color": COLORS.cloud, "line-width": 1.6 },
  }, before);
  map.addLayer({
    id: "archive-images", type: "circle", source: "archive", "source-layer": "image",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius, "circle-color": COLORS.image,
      "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 0, 12, 1],
    },
  }, before);

  // The other small point layers follow "archive-other".
  ["streetview", "video", "questionnaire"].forEach((l) => ARCHIVE_LAYERS.push(`archive-other-${l}`));
  STORY_LAYERS.push(...ARCHIVE_LAYERS.slice(6));
  archiveReady = true;

}

function applyChapter(id) {
  const chapter = CHAPTERS[id];
  // Not map.isStyleLoaded(): that stays false while new sources load, which would skip
  // the first chapter. Chapters picked before the layers exist are applied on load.
  if (!chapter || !layersReady) return;
  currentChapter = id;

  map.setPaintProperty("dark", "raster-opacity", chapter.basemap === "dark" ? 1 : 0);
  map.setPaintProperty("imagery", "raster-opacity", chapter.basemap === "imagery" ? 1 : 0);

  const visible = new Set(chapter.layers);
  if (chapter.tracts === false) visible.delete("archive-tracts");
  for (const layer of STORY_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible.has(layer) ? "visible" : "none");
  }

  // Padding passed to flyTo persists on the map and stacks with fitBounds padding,
  // which can leave no room to fit. So flyTo uses an offset and only fitBounds pads.
  const padding = cameraPadding();
  if (map.getPadding().left) map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  if (chapter.bounds) {
    const [w, s, e, n] = chapter.bounds;
    // maxZoom also covers one-point maps, whose bounds have no size. Their point is a
    // extent's centre, so stop short enough to show a point cloud's whole extent.
    map.fitBounds([[w, s], [e, n]], { padding, duration: 3200, essential: true, maxZoom: 15 });
  } else if (chapter.view) {
    const offset = typeof padding === "number" ? [0, 0] : [(padding.left - padding.right) / 2, 0];
    // A phone-width map needs to sit further out to show the same area.
    const zoom = chapter.view.zoom - (isNarrow() ? 1.4 : 0);
    map.flyTo({ ...chapter.view, zoom, offset, duration: 2600, essential: true });
  }
}

const fmt = (n) => Number(n).toLocaleString("en-US");

function fillStoryText() {
  document.querySelectorAll("[data-stat]").forEach((el) => {
    const value = summary[el.dataset.stat];
    if (value !== undefined) el.textContent = fmt(value);
  });
  const built = new Date(ARCHIVE.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  document.getElementById("archive-status").textContent = `GeoAPI published-maps archive, built ${built}.`;
}

const mapChapterId = (m) => `map-${m.uuid.slice(0, 8)}`;

function countsText(counts) {
  return Object.entries(counts)
    .map(([type, n]) => {
      const [one, many] = FEATURE_NAMES[type] || [type, `${type}s`];
      return `${fmt(n)} ${n === 1 ? one : many}`;
    })
    .join(", ");
}

function legendHtml(m) {
  const items = [];
  const types = new Set(Object.keys(m.counts));
  if (m.id === "PRJ-6361") items.push('<li><span class="swatch dot tract"></span>Census tract</li>');
  if (types.has("image")) items.push('<li><span class="swatch dot image"></span>Photo or image</li>');
  if (types.has("point_cloud")) items.push('<li><span class="swatch fill cloud"></span>Point cloud extent</li>');
  if (types.has("shape")) items.push('<li><span class="swatch line"></span>Shape</li>');
  if (m.id !== "PRJ-6361" && ["point", "streetview", "video", "questionnaire"].some((t) => types.has(t))) {
    items.push('<li><span class="swatch dot other"></span>Other feature</li>');
  }
  return `<ul class="legend">${items.join("")}</ul>`;
}

// One Browse chapter per Hazmapper map, largest first, inserted before About.
function buildMapChapters() {
  const outro = document.querySelector('.chapter[data-chapter="outro"]');
  const options = mapsList
    .map((m) => `<option value="${mapChapterId(m)}">${m.rank}. ${escapeHtml(m.map_name)}</option>`)
    .join("");
  for (const m of mapsList) {
    const id = mapChapterId(m);
    const [w, s, e, n] = m.bounds;
    const wide = Math.max(e - w, n - s) > IMAGERY_MAX_SPAN;
    CHAPTERS[id] = {
      bounds: m.bounds,
      basemap: wide ? "dark" : "imagery",
      layers: ARCHIVE_LAYERS,
      tracts: m.id === "PRJ-6361",
    };
    const section = document.createElement("section");
    section.className = "chapter";
    section.hidden = true;
    section.dataset.chapter = id;
    section.dataset.group = "browse";
    section.dataset.label = "Browse";
    section.innerHTML = `
      <label class="jump">Jump to <select aria-label="Jump to a map">${options}</select></label>
      <p class="place">Map ${m.rank} of ${mapsList.length} · ${fmt(m.n)} ${m.n === 1 ? "feature" : "features"}</p>
      <h2>${escapeHtml(m.map_name)}</h2>
      <p>${escapeHtml(m.title)}</p>
      <p class="note">${escapeHtml(countsText(m.counts))}</p>
      ${legendHtml(m)}
      <div class="links">
        ${link(m.ds_url, `Open published project ${m.id}`)}
        ${link(m.hazmapper_url, "Open this map in Hazmapper")}
      </div>`;
    section.querySelector("select").value = id;
    outro.before(section);
  }
}

// What to call a clicked feature in its "Open this … in Hazmapper" link. Points, shapes,
// questionnaires and any type not listed here are called a "feature".
const FEATURE_LINK_NAMES = {
  image: "image",
  point_cloud: "point cloud",
  streetview: "streetview sequence",
  video: "video",
};

// Hazmapper opens a map zoomed to one feature, with its details shown, when the URL has
// ?selectedFeature=<feature id> (see useFeatureSelection and FitBoundsHandler in hazmapper).
function featureUrl(p) {
  const url = new URL(p.hazmapper_url);
  url.searchParams.set("selectedFeature", p.feature_id);
  return url.href;
}

function popupHtml(feature) {
  const p = feature.properties;
  if (feature.layer.id.startsWith("projects")) {
    const maps = JSON.parse(p.maps || "[]");
    const meta = [p.event, p.place, p.year].filter(Boolean).join(" · ");
    return `<div class="popup-title">${escapeHtml(p.title)}</div>
      <div class="popup-meta">${escapeHtml(meta)}${p.hazards ? `<br>${escapeHtml(p.hazards)}` : ""}${p.coord_fixed ? "<br>Location sign corrected" : ""}</div>
      <div class="popup-links">${link(p.ds_url, `Open published project ${p.id}`)}${maps.map((m) => link(m.url, `Open ${m.name} in Hazmapper`)).join("")}</div>`;
  }
  if (feature.layer.id === "maps") {
    return `<div class="popup-title">${escapeHtml(p.map_name)}</div>
      <div class="popup-meta">${escapeHtml(p.title)}<br>${escapeHtml(countsText(typeof p.counts === "string" ? JSON.parse(p.counts) : p.counts))}</div>
      <button type="button" class="popup-jump" data-chapter="map-${escapeHtml(String(p.uuid).slice(0, 8))}">Show this map</button>
      <div class="popup-links">${link(p.ds_url, `Open published project ${p.id}`)}${link(p.hazmapper_url, "Open this map in Hazmapper")}</div>`;
  }
  const kind = (p.feature_type || "feature").replace("_", " ");
  const projectId = String(p.ds_project_url || "").split("/").pop();
  return `<div class="popup-title">${escapeHtml(p.hazmapper_project_name)}</div>
    <div class="popup-meta">${escapeHtml(kind)} · ${escapeHtml(p.ds_project_name)}</div>
    <div class="popup-links">${link(p.ds_project_url, `Open published project ${projectId}`)}${link(p.hazmapper_url, "Open this map in Hazmapper")}${link(featureUrl(p), `Open this ${FEATURE_LINK_NAMES[p.feature_type] || "feature"} in Hazmapper`)}</div>`;
}

function enablePopups() {
  const clickable = () => STORY_LAYERS.filter((l) => map.getLayer(l) && l !== "archive-cloud-line");
  map.on("click", (e) => {
    const layers = clickable().filter((l) => map.getLayoutProperty(l, "visibility") === "visible");
    const [feature] = map.queryRenderedFeatures(e.point, { layers });
    if (!feature) return;
    new maplibregl.Popup({ maxWidth: "300px" }).setLngLat(e.lngLat).setHTML(popupHtml(feature)).addTo(map);
  });
  map.on("mousemove", (e) => {
    const layers = clickable().filter((l) => map.getLayoutProperty(l, "visibility") === "visible");
    map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers }).length ? "pointer" : "";
  });
}

// Chapters are steps: one card at a time, picked by tab, Back/Next or the arrow keys.
// The Browse maps share one tab. The URL hash names the current chapter, so a link
// can open on any step.
let sections = [];
let stepIndex = 0;

const groupOf = (section) => section.dataset.group || section.dataset.chapter;
const stepOf = (chapterId) => sections.findIndex((s) => s.dataset.chapter === chapterId);

function showStep(index) {
  if (!sections.length) return;
  stepIndex = Math.max(0, Math.min(sections.length - 1, index));
  const section = sections[stepIndex];
  const tabs = [...document.querySelectorAll(".steps button")];
  const activeTab = tabs.find((tab) => tab.dataset.group === groupOf(section));
  sections.forEach((s, i) => { s.hidden = i !== stepIndex; });
  tabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab === activeTab));
    tab.tabIndex = tab === activeTab ? 0 : -1;
    if (tab === activeTab) tab.setAttribute("aria-controls", section.id);
  });
  if (document.activeElement?.closest(".steps")) activeTab.focus();
  activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
  document.getElementById("prev").disabled = stepIndex === 0;
  document.getElementById("next").disabled = stepIndex === sections.length - 1;
  const browse = sections.filter((s) => s.dataset.group === "browse");
  document.getElementById("step-count").textContent = section.dataset.group === "browse"
    ? `Map ${browse.indexOf(section) + 1} of ${browse.length}`
    : "";
  document.querySelector(".cards").scrollTop = 0;
  history.replaceState(null, "", `#${section.dataset.chapter}`);
  currentChapter = section.dataset.chapter;
  applyChapter(currentChapter);
}

function buildSteps() {
  sections = [...document.querySelectorAll(".chapter")];
  const nav = document.querySelector(".steps");
  const tabFor = {};
  sections.forEach((section, i) => {
    const id = section.dataset.chapter;
    const group = groupOf(section);
    section.id = `chapter-${id}`;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `tab-${group}`);
    if (tabFor[group]) return;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${group}`;
    tab.dataset.group = group;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", section.id);
    tab.textContent = section.dataset.label;
    tab.addEventListener("click", () => showStep(i));
    tabFor[group] = tab;
    nav.append(tab);
  });
  document.getElementById("prev").addEventListener("click", () => showStep(stepIndex - 1));
  document.getElementById("next").addEventListener("click", () => showStep(stepIndex + 1));
  document.querySelector(".cards").addEventListener("change", (e) => {
    if (e.target.matches(".jump select")) showStep(stepOf(e.target.value));
  });
  // "Show this map" in a ring's popup.
  document.getElementById("map").addEventListener("click", (e) => {
    const button = e.target.closest(".popup-jump");
    if (!button) return;
    document.querySelectorAll(".maplibregl-popup").forEach((p) => p.remove());
    showStep(stepOf(button.dataset.chapter));
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // The map canvas pans with the arrow keys when it has focus.
    if (e.target.closest?.(".maplibregl-canvas-container, input, textarea, select")) return;
    if (e.key === "ArrowRight") showStep(stepIndex + 1);
    else if (e.key === "ArrowLeft") showStep(stepIndex - 1);
    else if (e.key === "Home" && e.target.closest?.(".steps")) showStep(0);
    else if (e.key === "End" && e.target.closest?.(".steps")) showStep(sections.length - 1);
    else return;
    e.preventDefault();
  });
  const fromHash = stepOf(location.hash.slice(1));
  showStep(fromHash === -1 ? 0 : fromHash);
}

// Browsers block fetch() from file:// pages, so the data can't load. Say so on the page.
if (location.protocol === "file:") {
  const warning = document.createElement("p");
  warning.className = "note";
  warning.innerHTML = "This page has to be served over HTTP to load its data. From the repo root run " +
    "<code>python3 -m http.server 8765 --directory docs</code> and open " +
    '<a href="http://127.0.0.1:8765/day01/">http://127.0.0.1:8765/day01/</a>.';
  document.querySelector(".masthead").append(warning);
}

// Fetch the data straight away and add layers once the style is ready. Waiting for the
// map's "load" event would also wait for every base map tile, which can take many seconds.
const dataReady = Promise.all([
  fetch(`${DATA_BASE}summary.json`).then((r) => r.json()),
  fetch(`${DATA_BASE}maps.geojson`).then((r) => r.json()),
]);
const styleReady = new Promise((resolve) => map.once("style.load", resolve));

// The cards and steps need only the data, so build them before the map is ready.
dataReady.then(([summaryJson, mapsJson]) => {
  summary = summaryJson;
  mapsList = mapsJson.features.map((f) => f.properties).sort((a, b) => a.rank - b.rank);
  for (const m of mapsList) (mapsByProject[m.id] ||= []).push(m);
  buildMapChapters();
  fillStoryText();
  buildSteps();
});

Promise.all([dataReady, styleReady]).then(() => {
  addStaticLayers();
  addArchiveLayers(ARCHIVE);
  enablePopups();
  // On phones the compact attribution opens expanded and covers part of the map; start it closed.
  if (isNarrow()) document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  layersReady = true;
  applyChapter(currentChapter);
});
