const OUTLINE_ZOOM = 12;
const IRELAND = [[-10.7, 51.35], [-5.4, 55.45]];

const css = getComputedStyle(document.documentElement);
const KIND = {
  war_office: { colour: css.getPropertyValue("--war-office").trim(), label: "British War Office map" },
  os_historic: { colour: css.getPropertyValue("--os").trim(), label: "Ordnance Survey 1st/2nd edition" },
  other: { colour: css.getPropertyValue("--other").trim(), label: "Aerial imagery, NMS, other" },
  none: { colour: css.getPropertyValue("--none").trim(), label: "No source tag" },
};
const kindOf = ["match", ["get", "kind"], "war_office", "war_office", "os_historic", "os_historic", "none", "none", "other"];
const kindColour = ["match", kindOf, ...Object.entries(KIND).flatMap(([k, v]) => [k, v.colour]), KIND.other.colour];

// National Library of Scotland's georeferenced Ordnance Survey of Ireland six-inch sheets, one tile set per county
// per edition (`os/<county>/` 1st edition, `os/<county>_2nd/` 2nd edition), with the county extents from NLS's own
// viewer (geo/scripts/20251112/explore-layers-ol6.js). Kings is Offaly, Queens is Laois. CC-BY, per maps.nls.uk/copyright.html.
const NLS = "https://mapseries-tilesets.s3.amazonaws.com/os/";
const NLS_COUNTIES = {
  antrim: [-6.715, 54.454, -5.635, 55.317], armagh: [-6.887, 54.034, -6.27, 54.56], carlow: [-7.145, 52.443, -6.404, 52.968],
  cavan: [-8.082, 53.75, -6.723, 54.333], clare: [-9.976, 52.525, -8.372, 53.17], cork: [-10.237, 51.403, -7.819, 52.392],
  donegal: [-8.87, 54.412, -6.873, 55.4], down: [-6.465, 54.049, -5.395, 54.69], dublin: [-6.659, 53.143, -5.911, 53.669],
  fermanagh: [-8.288, 54.094, -7.068, 54.62], galway: [-10.293, 52.873, -7.926, 53.745], kerry: [-10.625, 51.676, -9.044, 52.604],
  kildare: [-7.173, 52.852, -6.423, 53.492], kilkenny: [-7.786, 52.214, -6.905, 52.912], kings: [-8.117, 52.838, -6.929, 53.422],
  leitrim: [-8.456, 53.783, -7.543, 54.482], limerick: [-9.425, 52.238, -8.113, 52.764], londonderry: [-7.438, 54.624, -6.311, 55.208],
  longford: [-8.087, 53.513, -7.328, 53.982], louth: [-6.763, 53.684, -6.005, 54.152], mayo: [-10.31, 53.466, -8.508, 54.392],
  meath: [-7.346, 53.339, -6.15, 53.923], monaghan: [-7.379, 53.879, -6.47, 54.462], queens: [-7.784, 52.78, -6.897, 53.25],
  roscommon: [-8.914, 53.255, -7.862, 54.126], sligo: [-9.2, 53.894, -8.138, 54.477], tipperary: [-8.487, 52.195, -7.317, 53.18],
  tyrone: [-7.94, 54.286, -6.409, 54.984], waterford: [-8.236, 51.897, -6.938, 52.365], westmeath: [-7.987, 53.274, -6.941, 53.799],
  wexford: [-7.03, 52.091, -6.149, 52.845], wicklow: [-6.869, 52.676, -5.981, 53.258],
};
const nlsSheets = (edition, suffix, dates) => Object.entries(NLS_COUNTIES).map(([county, bounds]) => ({
  id: `${edition}-${county}`,
  source: {
    type: "raster", tileSize: 256, maxzoom: 17, bounds,
    tiles: [`${NLS}${county}${suffix}/{z}/{x}/{y}.png`],
    attribution: `Ordnance Survey six-inch ${dates}: Reproduced with the permission of the <a href="https://maps.nls.uk/os/6inch-ireland/" target="_blank" rel="noopener">National Library of Scotland</a> (CC-BY)`,
  },
}));

const BACKGROUNDS = {
  imagery: [{
    id: "imagery",
    source: {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  }],
  os1: nlsSheets("os1", "", "1st edition (1830s–40s)"),
  os2: nlsSheets("os2", "_2nd", "2nd edition (1888–1915)"),
  // The standard openstreetmap.org map. Fine for light use from a web page under the OSMF tile usage policy
  // (operations.osmfoundation.org/policies/tiles/), which requires visible attribution: hence no compact attribution.
  osm: [{
    id: "osm",
    source: {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      attribution: 'Map: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    },
  }],
  waroffice: [{
    id: "waroffice",
    source: {
      type: "raster", tileSize: 256, maxzoom: 17, bounds: [-10.7, 51.35, -5.4, 55.45],
      tiles: ["https://mapwarper.net/layers/tile/101/{z}/{x}/{y}.png"],
      attribution: 'GSGS 3906 (1940): <a href="https://www.tcd.ie/library/map-library/" target="_blank" rel="noopener">Glucksman Map Library, Trinity College Dublin</a>, via <a href="https://mapwarper.net/layers/101" target="_blank" rel="noopener">mapwarper.net</a>',
    },
  }],
};

// Historic Environment Viewer record for an SMR number (URL pattern from the OSM wiki's Key:ref:IE:smr).
const HEV = "https://heritagedata.maps.arcgis.com/apps/webappviewer/index.html?id=0c9eb9575b544081b0d296436d8f60f8";
const hevRecord = (smr) => `${HEV}&query=18a4b61b268-layer-9%2CSMRS%2C${encodeURIComponent(smr)}`;

const startedWithView = /^#[\d.]+\/[-\d.]+\/[-\d.]+/.test(location.hash) && location.hash !== "#0/0/0";

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/dark",
  bounds: IRELAND,
  hash: true,
  maxZoom: 20,
  attributionControl: { compact: false },
  customAttribution: 'Ring forts: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)',
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

const panel = document.getElementById("panel");
const fortsById = new Map();
let fortsData = null;
let outlinesLoaded = false;

const dataReady = fetch("forts.geojson").then((r) => r.json()).then((fc) => {
  fortsData = fc;
  for (const f of fc.features) fortsById.set(f.properties.osm, f);
  document.getElementById("count").textContent = fc.features.length.toLocaleString("en");
});
const styleReady = new Promise((resolve) => map.once("load", resolve));

Promise.all([dataReady, styleReady]).then(() => {
  for (const layers of Object.values(BACKGROUNDS)) {
    for (const { id, source, minzoom } of layers) {
      map.addSource(id, source);
      map.addLayer({ id, type: "raster", source: id, minzoom: minzoom ?? 0, layout: { visibility: "none" } });
    }
  }

  map.addSource("forts", { type: "geojson", data: fortsData });
  map.addSource("outlines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  map.addLayer({
    id: "outline-fill", type: "fill", source: "outlines", minzoom: OUTLINE_ZOOM,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": kindColour, "fill-opacity": 0.08 },
  });
  map.addLayer({
    id: "outline-line", type: "line", source: "outlines", minzoom: OUTLINE_ZOOM,
    paint: {
      "line-color": kindColour,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2, 19, 3],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.9, 18, 0.7],
    },
  });
  map.addLayer({
    id: "fort-dots", type: "circle", source: "forts",
    paint: {
      "circle-color": kindColour,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 9, 2.2, 12, 3.5, 15, 3, 18, 2],
      "circle-stroke-color": "#0b1622",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 7, 0, 10, 0.6],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 1, 17, 0.6],
    },
  });
  map.addLayer({
    id: "selected-line", type: "line", source: "outlines", filter: ["==", ["get", "osm"], ""],
    paint: { "line-color": "#ffffff", "line-width": 3 },
  });
  map.addLayer({
    id: "selected-dot", type: "circle", source: "forts", filter: ["==", ["get", "osm"], ""],
    paint: { "circle-radius": 7, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });

  setBackground(document.querySelector("input[name=layer]:checked").value);
  map.on("zoomend", loadOutlines);
  loadOutlines();

  for (const id of ["fort-dots", "outline-fill"]) {
    map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
  }
  map.on("click", (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ["fort-dots", "outline-fill"] })[0];
    if (hit) select(hit.properties.osm);
  });
  document.querySelector("#selected .close").addEventListener("click", clearSelection);
  if (!startedWithView) map.fitBounds(IRELAND, { padding: viewPadding(), duration: 0 });
});

function loadOutlines() {
  if (outlinesLoaded || map.getZoom() < OUTLINE_ZOOM - 0.5) return;
  outlinesLoaded = true;
  fetch("outlines.geojson").then((r) => r.json()).then((fc) => map.getSource("outlines").setData(fc));
}

function setBackground(name) {
  // Before the layers exist there's nothing to switch; the load handler applies whichever background is checked.
  if (!map.getLayer("fort-dots")) return;
  for (const [key, layers] of Object.entries(BACKGROUNDS)) {
    for (const { id } of layers) map.setLayoutProperty(id, "visibility", key === name ? "visible" : "none");
  }
}

document.getElementById("layers").addEventListener("change", (e) => setBackground(e.target.value));

function select(osm, fly = false) {
  const f = fortsById.get(osm);
  if (!f) return;
  map.setFilter("selected-line", ["==", ["get", "osm"], osm]);
  map.setFilter("selected-dot", ["==", ["get", "osm"], osm]);
  showDetails(f.properties);
  // Old maps blur past their scanned detail: the War Office sheets at about z16, the six-inch sheets at z17.
  const zoom = { waroffice: 16, os1: 17, os2: 17 }[document.querySelector("input[name=layer]:checked").value] ?? 17.5;
  if (fly) map.flyTo({ center: f.geometry.coordinates, zoom, speed: 1.6, padding: viewPadding() });
}

function clearSelection() {
  map.setFilter("selected-line", ["==", ["get", "osm"], ""]);
  map.setFilter("selected-dot", ["==", ["get", "osm"], ""]);
  document.getElementById("selected").hidden = true;
}

// Keep the fort clear of the panel: it sits on the left on wide screens and along the bottom on phones.
function viewPadding() {
  const r = panel.getBoundingClientRect();
  if (panel.classList.contains("collapsed")) return 20;
  return window.innerWidth > 600 ? { left: r.right + 20, top: 20, right: 20, bottom: 20 }
    : { bottom: window.innerHeight - r.top + 20, top: 20, left: 20, right: 20 };
}

function showDetails(p) {
  const el = document.getElementById("selected");
  el.querySelector("h2").textContent = p.name || (p.type === "ring_ditch" ? "Unnamed ring ditch" : "Unnamed ring fort");
  const rows = [["County", p.county || "—"], ["Derived from", p.source || "No source tag"]];
  if (p.area_m2) {
    const d = 2 * Math.sqrt(p.area_m2 / Math.PI);
    rows.push(["Size", `${p.area_m2.toLocaleString("en")} m², about ${Math.round(d)} m across`]);
  }
  const dl = el.querySelector("dl");
  dl.replaceChildren();
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    dl.append(dt, dd);
  }
  const swatch = document.createElement("span");
  swatch.className = "swatch inline";
  swatch.style.setProperty("--c", KIND[p.kind]?.colour ?? KIND.other.colour);
  dl.children[3].prepend(swatch);
  const [type, id] = p.osm.split("/");
  const link = el.querySelector("a.osm");
  link.href = `https://www.openstreetmap.org/${type}/${id}`;
  link.textContent = `OpenStreetMap ${type} ${id}`;
  const hev = el.querySelector("a.hev");
  hev.hidden = !p.smr;
  if (p.smr) {
    hev.href = hevRecord(p.smr);
    hev.textContent = `Official record ${p.smr.replace(/-+$/, "")}`;
  }
  el.querySelector(".zoom").onclick = () => select(p.osm, true);
  el.hidden = false;
}

document.getElementById("random").addEventListener("click", () => {
  const f = fortsData.features[Math.floor(Math.random() * fortsData.features.length)];
  select(f.properties.osm, true);
});

document.getElementById("toggle").addEventListener("click", (e) => {
  const collapsed = panel.classList.toggle("collapsed");
  e.target.textContent = collapsed ? "Show panel" : "Hide panel";
  e.target.setAttribute("aria-expanded", String(!collapsed));
});
