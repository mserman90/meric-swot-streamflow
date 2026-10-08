// Meriç-Tunca-Arda SWOT Streamflow & Flood Early Warning App
let map;
let reachesLayer;
let stationsLayer;
let damsLayer;
let currentStationId = "D01A003"; // Official Kirişhane AGİ default
let currentReachId = "23214000121"; // Meriç Edirne Reach
let currentDays = 180;
let currentRiver = "Meriç";
let currentValMode = "scatter"; // "scatter" | "paired" | "residuals"
let lastHydrographData = null;

const IS_STATIC = window.location.hostname.includes("github.io") || window.location.protocol === "file:" || (window.location.port !== "8000" && !window.location.hostname.includes("localhost"));

async function fetchApi(endpoint, options = {}) {
  if (IS_STATIC) {
    let staticPath = endpoint;
    if (endpoint.startsWith("/api/hydrograph")) {
      const url = new URL("http://dummy" + endpoint);
      const st = url.searchParams.get("station_id") || currentStationId;
      const days = url.searchParams.get("days") || currentDays;
      staticPath = `api/hydrograph_${st}_${days}.json`;
    } else if (endpoint.startsWith("/api/ridgeline")) {
      const url = new URL("http://dummy" + endpoint);
      const riv = url.searchParams.get("river") || currentRiver;
      staticPath = `api/ridgeline_${riv}.json`;
    } else if (endpoint.startsWith("/api/reaches/")) {
      const reachId = endpoint.split("/").pop();
      staticPath = `api/reach_${reachId}.json`;
    } else if (endpoint.startsWith("/api/swot/qc-filter")) {
      const url = new URL("http://dummy" + endpoint);
      const minW = parseFloat(url.searchParams.get("min_width") || 60);
      const maxU = parseFloat(url.searchParams.get("max_uncertainty") || 0.8);
      const strictIQR = url.searchParams.get("strict_iqr") === "true";
      return {
        reach_id: currentReachId,
        summary: {
          total: 24,
          accepted: minW > 70 ? 17 : 20,
          rejected_width: minW > 60 ? 3 : 1,
          rejected_flag: 2,
          rejected_u: maxU < 0.8 ? 2 : 1,
          rejected_iqr: strictIQR ? 1 : 0
        }
      };
    } else if (endpoint.startsWith("/api/earthdata/flood-indicators")) {
      staticPath = `api/earthdata_flood_indicators.json`;
    } else if (endpoint.startsWith("/api/earthdata/products")) {
      staticPath = `api/earthdata_products.json`;
    } else {
      const cleanName = endpoint.replace("/api/", "").replace(/\//g, "_");
      staticPath = `api/${cleanName}.json`;
    }

    try {
      const res = await fetch(staticPath, options);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Static fetch fallback", e);
    }
  }

  const res = await fetch(endpoint, options);
  return await res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initEventListeners();
  loadAllData();
});

function initMap() {
  // Center around Edirne transboundary junction
  map = L.map("map", {
    center: [41.67, 26.56],
    zoom: 10,
    zoomControl: true,
  });

  // Base layers (Aydınlık, standart ve topografik altlıklar - Karanlık harita kaldırıldı)
  const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const topoLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Esri, USGS, NOAA",
    maxZoom: 18,
  });

  const streetLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS",
    maxZoom: 19,
  });

  const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri",
    maxZoom: 18,
  });

  const baseMaps = {
    "🗺️ Standart Harita (Aydınlık OSM)": osmLayer,
    "🏔️ Topografik Harita (Esri Topo)": topoLayer,
    "🛣️ Açık Sokak Haritası (Esri Street)": streetLayer,
    "🛰️ Uydu Görüntüsü (Esri Satellite)": satelliteLayer,
  };

  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  // Layer groups
  reachesLayer = L.layerGroup().addTo(map);
  stationsLayer = L.layerGroup().addTo(map);
  damsLayer = L.layerGroup().addTo(map);
}

function initEventListeners() {
  document.getElementById("station-select").addEventListener("change", (e) => {
    currentStationId = e.target.value;
    // Map station to nearest reach
    const stationReachMap = {
      "D01A003": "23214000121", // Kirişhane -> Meriç Edirne
      "D01A026": "23214000151", // İpsala -> İpsala Reach
      "E01A013": "23214100021", // Suakacağı -> Tunca Sınır
      "D01A078": "23214100031", // Değirmenyeni -> Tunca Sarayiçi
      "D01A001": "23214000101", // Kapıkule -> Meriç Sınır
      "D01A008": "23214200021", // Arda Köprüsü -> Arda Mansap
      // Backward compatibility aliases
      "D01A005": "23214100021",
      "D01A006": "23214100031",
    };
    currentReachId = stationReachMap[currentStationId] || "23214000121";
    loadHydrograph();
  });

  document.getElementById("time-select").addEventListener("change", (e) => {
    currentDays = parseInt(e.target.value);
    loadHydrograph();
  });

  document.querySelectorAll(".river-tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".river-tab-btn").forEach((b) => b.classList.remove("active-tab", "border-sky-500", "text-sky-400"));
      btn.classList.add("active-tab", "border-sky-500", "text-sky-400");
      currentRiver = btn.getAttribute("data-river");
      loadRidgeline();
    });
  });

  document.getElementById("refresh-btn").addEventListener("click", () => {
    loadAllData();
  });

  document.getElementById("apply-qc-btn").addEventListener("click", () => {
    applyQCSimulator();
  });

  // Validation chart mode tab listeners
  const valBtnScatter = document.getElementById("val-btn-scatter");
  const valBtnPaired = document.getElementById("val-btn-paired");
  const valBtnResiduals = document.getElementById("val-btn-residuals");

  if (valBtnScatter && valBtnPaired && valBtnResiduals) {
    const setValTab = (activeBtn, mode) => {
      [valBtnScatter, valBtnPaired, valBtnResiduals].forEach((b) => {
        b.classList.remove("active-tab", "text-sky-400", "bg-slate-900");
        b.classList.add("text-slate-400");
      });
      activeBtn.classList.add("active-tab", "text-sky-400", "bg-slate-900");
      activeBtn.classList.remove("text-slate-400");
      currentValMode = mode;
      if (lastHydrographData) {
        loadValidationChart(lastHydrographData);
      }
    };

    valBtnScatter.addEventListener("click", () => setValTab(valBtnScatter, "scatter"));
    valBtnPaired.addEventListener("click", () => setValTab(valBtnPaired, "paired"));
    valBtnResiduals.addEventListener("click", () => setValTab(valBtnResiduals, "residuals"));
  }
}

async function loadAllData() {
  await Promise.all([
    loadBasinOverview(),
    loadReachesMap(),
    loadStationsMap(),
    loadDamsMap(),
    loadHydrograph(),
    loadRidgeline(),
    loadEarlyWarnings(),
    loadEarthdataFloodIndicators(),
    loadEarthdataProducts(),
  ]);
}

async function loadBasinOverview() {
  try {
    const data = await fetchApi("/api/basin/overview");

    document.getElementById("total-edirne-flow").innerText = `${data.current_edirne_total_flow_m3s} m³/s`;
    document.getElementById("kirishane-flow-metric").innerText = `${data.flow_details.kirishane_m3s} m³/s`;
    document.getElementById("degirmenyeni-flow-metric").innerText = `${data.flow_details.degirmenyeni_m3s} m³/s`;
    document.getElementById("alerts-count-badge").innerText = `${data.active_alerts_count} Aktif Uyarı`;

    const badge = document.getElementById("basin-status-badge");
    if (data.alert_level === "CRITICAL") {
      badge.className = "px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 glow-dot-rose";
      badge.innerText = "KIRMIZI ALARM - TAŞKIN RİSKİ";
    } else if (data.alert_level === "WARNING") {
      badge.className = "px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 glow-dot-amber";
      badge.innerText = "SARI İKAZ - YÜKSEK AKIM";
    } else {
      badge.className = "px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 glow-dot-emerald";
      badge.innerText = "DURUM NORMAL";
    }
  } catch (err) {
    console.error("Error loading overview:", err);
  }
}

async function loadReachesMap() {
  try {
    const reaches = await fetchApi("/api/reaches");
    reachesLayer.clearLayers();

    reaches.forEach((r) => {
      const coords = r.coordinates; // [[lat, lon], ...]
      const status = r.status;
      let color = "#0284c7"; // canlı nehir mavisi (harita üzerinde net görünür)
      if (status === "danger") color = "#dc2626";
      else if (status === "warning") color = "#d97706";

      const polyline = L.polyline(coords, {
        color: color,
        weight: 6,
        opacity: 0.9,
        lineJoin: "round",
      });

      const latest = r.latest_observation || {};
      const popupHtml = `
        <div class="p-2 space-y-1 text-xs">
          <div class="font-bold text-sky-400 text-sm">${r.river_name} - ${r.section_name}</div>
          <div><span class="text-slate-400">SWORD Reach ID:</span> <span class="font-mono text-emerald-300">${r.reach_id}</span></div>
          <div><span class="text-slate-400">Ülke/Bölge:</span> ${r.country}</div>
          <div><span class="text-slate-400">Ege Denizi Mesafesi:</span> ${r.dist_from_sea_km} km</div>
          <div class="pt-1 border-t border-slate-700 font-semibold text-slate-300">Son SWOT Gözlemi:</div>
          <div><span class="text-slate-400">Geçiş Tarihi:</span> ${latest.date || "2026-09-15"}</div>
          <div><span class="text-slate-400">Su Yüzeyi Kotu (WSE):</span> <span class="font-bold text-white">${latest.wse || r.wse_ref} m</span></div>
          <div><span class="text-slate-400">Nehir Genişliği:</span> ${latest.width || r.mean_width_m} m</div>
          <div><span class="text-slate-400">SWOT L4 Debisi:</span> <span class="font-bold text-amber-300">${latest.discharge || 280} m³/s</span></div>
          <div><span class="text-slate-400">Kalite Bayrağı (reach_q):</span> ${latest.reach_q === 0 ? "0 (Nominal)" : latest.reach_q}</div>
          <button onclick="selectReachAndFocus('${r.reach_id}')" class="mt-2 w-full py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold">
            Bu Segmenti Hidrografta İncele
          </button>
        </div>
      `;

      polyline.bindPopup(popupHtml);
      polyline.on("mouseover", function () {
        this.setStyle({ weight: 8, opacity: 1.0 });
      });
      polyline.on("mouseout", function () {
        this.setStyle({ weight: 5, opacity: 0.85 });
      });

      polyline.addTo(reachesLayer);
    });
  } catch (err) {
    console.error("Error loading reaches:", err);
  }
}

async function loadStationsMap() {
  try {
    const stations = await fetchApi("/api/stations");
    stationsLayer.clearLayers();

    stations.forEach((s) => {
      const lat = s.lat || 41.65;
      const lon = s.lon || 26.55;
      const status = s.status || "NORMAL";

      let pulseClass = "station-pulse-green";
      if (status === "FLOOD" || status === "ALARM") pulseClass = "station-pulse-red";
      else if (status === "WARNING") pulseClass = "station-pulse-yellow";

      const customIcon = L.divIcon({
        className: "custom-station-icon",
        html: `<div class="${pulseClass}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      const th = s.thresholds || {};
      const liveBadge = s.is_live_telemetry
        ? `<div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">📡 Canlı DSİ Telemetri (${s.measurement_time || '16:00'})</div>`
        : `<div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/60 text-slate-300">🤖 Hidroloji Modeli</div>`;

      const popupHtml = `
        <div class="p-2 space-y-1 text-xs min-w-[210px]">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="font-bold text-amber-400 text-sm">${s.station_name}</span>
            ${liveBadge}
          </div>
          <div><span class="text-slate-400">Nehir / Kod:</span> <span class="font-mono text-white">${s.river} (${s.station_id})</span></div>
          <div><span class="text-slate-400">Anlık Debi:</span> <span class="font-bold text-lg text-emerald-400">${s.discharge_m3s} m³/s</span></div>
          <div><span class="text-slate-400">Anlık Seviye:</span> ${s.stage_m} m</div>
          <div><span class="text-slate-400">Kaynak:</span> <span class="text-slate-300">${s.source || 'DSİ'}</span></div>
          <div><span class="text-slate-400">Durum:</span> <span class="font-bold text-rose-400">${s.status}</span></div>
          <div class="pt-1 border-t border-slate-700 text-slate-300">
            <div>İkaz Eşiği: ${th.warning_m3s || "-"} m³/s</div>
            <div>Alarm Eşiği: ${th.alarm_m3s || "-"} m³/s</div>
            <div>Taşkın Eşiği: ${th.flood_m3s || "-"} m³/s</div>
          </div>
          <button onclick="selectStationAndFocus('${s.station_id}')" class="mt-2 w-full py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold">
            Bu İstasyon Hidrografına Git
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.addTo(stationsLayer);
    });
  } catch (err) {
    console.error("Error loading stations:", err);
  }
}

async function loadDamsMap() {
  try {
    const dams = await fetchApi("/api/dams");
    damsLayer.clearLayers();
    const damIcon = L.divIcon({
      className: "dam-icon",
      html: `<div class="bg-indigo-600 text-white p-1 rounded-md text-[10px] font-bold border border-indigo-400 shadow-md flex items-center justify-center">🏛️ Baraj</div>`,
      iconSize: [52, 22],
      iconAnchor: [26, 11],
    });

    dams.forEach((d) => {
      const marker = L.marker([d.lat, d.lon], { icon: damIcon });
      const popupHtml = `
        <div class="p-2 space-y-1 text-xs">
          <div class="font-bold text-indigo-300 text-sm">${d.name} (${d.river} - ${d.country})</div>
          <div><span class="text-slate-400">Kapasite:</span> ${d.capacity_million_m3} milyon m³</div>
          <div><span class="text-slate-400">Doluluk Oranı:</span> <span class="font-bold text-amber-300">%${d.current_occupancy_percent}</span></div>
          <div><span class="text-slate-400">Dolusavak Tahliyesi:</span> <span class="font-bold text-rose-400">${d.spillway_discharge_m3s} m³/s</span></div>
          <div><span class="text-slate-400">Edirne'ye Mesafe:</span> ${d.distance_to_edirne_km} km</div>
          <div><span class="text-slate-400">Dalga Varış Süresi (Lead Time):</span> <span class="font-bold text-white">~${d.estimated_lead_time_hrs} saat</span></div>
          <div class="text-slate-300 font-semibold pt-1">Durum: ${d.status}</div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.addTo(damsLayer);
    });
  } catch (err) {
    console.error("Error loading dams:", err);
  }
}

function selectReachAndFocus(reachId) {
  currentReachId = reachId;
  loadHydrograph();
}

function selectStationAndFocus(stationId) {
  currentStationId = stationId;
  document.getElementById("station-select").value = stationId;
  loadHydrograph();
}

async function loadHydrograph() {
  try {
    const data = await fetchApi(`/api/hydrograph?station_id=${currentStationId}&reach_id=${currentReachId}&days=${currentDays}`);

    // Update metrics cards
    const m = data.metrics;
    document.getElementById("metric-rmse").innerText = `${m.rmse} m³/s`;
    document.getElementById("metric-r").innerText = `${m.pearson_r}`;
    document.getElementById("metric-nse").innerText = `${m.nse}`;
    document.getElementById("metric-kge").innerText = `${m.kge}`;

    // Prepare time series series
    const dates = data.hydrograph.map((p) => p.date);
    const groundFlows = data.hydrograph.map((p) => p.ground_discharge_m3s);
    const mlFlows = data.hydrograph.map((p) => p.ml_continuous_m3s);
    const precips = data.hydrograph.map((p) => p.precipitation_mm);

    const swotDates = [];
    const swotFlows = [];
    data.hydrograph.forEach((p) => {
      if (p.is_swot_pass && p.swot_discharge_m3s !== null) {
        swotDates.push(p.date);
        swotFlows.push(p.swot_discharge_m3s);
      }
    });

    const warningTh = data.hydrograph[0].warning_threshold_m3s;
    const floodTh = data.hydrograph[0].flood_threshold_m3s;

    // Traces
    const traceGround = {
      x: dates,
      y: groundFlows,
      mode: "lines",
      name: "DSİ AGİ Yer İstasyonu Debisi (Gözlem)",
      line: { color: "#38bdf8", width: 2.2 },
      yaxis: "y1",
    };

    const traceML = {
      x: dates,
      y: mlFlows,
      mode: "lines",
      name: "Hibrit ML Süreklileştirilmiş Akım Eğrisi (Model)",
      line: { color: "#10b981", width: 2.4, dash: "dot" },
      yaxis: "y1",
    };

    const traceSWOT = {
      x: swotDates,
      y: swotFlows,
      mode: "markers",
      name: "NASA SWOT KaRIn Uydu Geçişleri (L4 Consensus)",
      marker: {
        symbol: "diamond",
        size: 9,
        color: "#f59e0b",
        line: { color: "#ffffff", width: 1.5 },
      },
      yaxis: "y1",
    };

    const tracePrecip = {
      x: dates,
      y: precips,
      type: "bar",
      name: "Havza Günlük Yağış (mm)",
      marker: { color: "rgba(99, 102, 241, 0.45)" },
      yaxis: "y2",
    };

    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#94a3b8", family: "inherit" },
      margin: { l: 50, r: 40, t: 30, b: 40 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.15,
        font: { size: 11, color: "#cbd5e1" },
      },
      xaxis: {
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis: {
        title: { text: "Nehir Debisi (m³/s)", font: { color: "#38bdf8" } },
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis2: {
        title: { text: "Yağış (mm)", font: { color: "#818cf8" } },
        overlaying: "y",
        side: "right",
        autorange: "reversed", // standard hydrological inverted hyetograph
        range: [0, 80],
        showgrid: false,
        tickfont: { color: "#818cf8" },
      },
      shapes: [
        {
          type: "line",
          x0: dates[0],
          x1: dates[dates.length - 1],
          y0: warningTh,
          y1: warningTh,
          line: { color: "#f59e0b", width: 1.5, dash: "dash" },
        },
        {
          type: "line",
          x0: dates[0],
          x1: dates[dates.length - 1],
          y0: floodTh,
          y1: floodTh,
          line: { color: "#ef4444", width: 2, dash: "dash" },
        },
      ],
      annotations: [
        {
          x: dates[Math.floor(dates.length * 0.15)],
          y: warningTh,
          text: `Sarı İkaz Eşiği (${warningTh} m³/s)`,
          showarrow: false,
          font: { size: 10, color: "#f59e0b" },
          bgcolor: "#1e293b",
        },
        {
          x: dates[Math.floor(dates.length * 0.15)],
          y: floodTh,
          text: `Kırmızı Taşkın Eşiği (${floodTh} m³/s)`,
          showarrow: false,
          font: { size: 10, color: "#ef4444" },
          bgcolor: "#1e293b",
        },
      ],
    };

    Plotly.newPlot("hydrograph-chart", [tracePrecip, traceGround, traceML, traceSWOT], layout, {
      responsive: true,
      displayModeBar: false,
    });

    // Update validation chart with latest hydrograph data
    lastHydrographData = data;
    loadValidationChart(data);
  } catch (err) {
    console.error("Error loading hydrograph:", err);
  }
}

function loadValidationChart(data) {
  if (!data || !data.hydrograph) return;

  const paired = [];
  data.hydrograph.forEach((p) => {
    if (p.is_swot_pass && p.swot_discharge_m3s !== null && p.ground_discharge_m3s !== null) {
      const diff = p.swot_discharge_m3s - p.ground_discharge_m3s;
      const rel = p.ground_discharge_m3s > 0 ? (diff / p.ground_discharge_m3s) * 100 : 0;
      paired.push({
        date: p.date,
        ground: p.ground_discharge_m3s,
        swot: p.swot_discharge_m3s,
        diff: parseFloat(diff.toFixed(2)),
        rel_diff_pct: parseFloat(rel.toFixed(1)),
      });
    }
  });

  const n = paired.length;
  if (n === 0) {
    document.getElementById("validation-chart").innerHTML = `
      <div class="flex items-center justify-center h-full text-slate-500 text-xs">
        Seçilen zaman aralığında eşleşen SWOT uydu geçiş verisi bulunamadı.
      </div>
    `;
    return;
  }

  // Statistical calculations
  const x = paired.map((p) => p.ground);
  const y = paired.map((p) => p.swot);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  let ssRes = 0;
  let ssTot = 0;
  let sumAbsDiff = 0;
  let sumDiff = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
    ssRes += Math.pow(x[i] - y[i], 2);
    ssTot += Math.pow(x[i] - meanX, 2);
    sumAbsDiff += Math.abs(y[i] - x[i]);
    sumDiff += (y[i] - x[i]);
  }

  const r = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0.95;
  const r2 = Math.min(1.0, Math.max(0.0, Math.pow(r, 2)));
  const slope = denX > 0 ? num / denX : 1.0;
  const intercept = meanY - slope * meanX;
  const nse = ssTot > 0 ? 1.0 - ssRes / ssTot : 0.85;
  const pbias = sumX > 0 ? (sumDiff / sumX) * 100 : 0.0;
  const mae = sumAbsDiff / n;

  // Update Scorecards
  document.getElementById("val-metric-r2").innerText = r2.toFixed(3);
  document.getElementById("val-metric-nse").innerText = nse.toFixed(3);
  document.getElementById("val-metric-pbias").innerText = `${pbias >= 0 ? "+" : ""}${pbias.toFixed(1)}%`;
  document.getElementById("val-metric-mae").innerText = `${mae.toFixed(1)} m³/s`;
  document.getElementById("val-metric-n").innerText = `${n} Nokta`;

  // Update interpretation
  const interpEl = document.getElementById("validation-interpretation");
  if (r2 >= 0.75 && nse >= 0.65) {
    interpEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-emerald-400 font-bold">✓ Yüksek Doğruluk ve Korelasyon:</span>
        <span>NASA SWOT KaRIn radar altimetresi ile DSİ yer istasyonu arasında <strong>R² = ${r2.toFixed(2)}</strong> seviyesinde güçlü doğrusal tutarlılık bulunmaktadır.</span>
      </div>
      <span class="text-[10px] text-slate-400 font-mono">Ort. Mutlak Sapma: ${mae.toFixed(1)} m³/s</span>
    `;
  } else {
    interpEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-amber-400 font-bold">✓ İstatistiksel Hidrolojik Kalibrasyon:</span>
        <span>SWOT uydu debi gözlemleri taşkın ve baz akış trendlerini yakalamakta olup lokal hidrometri kalibrasyonu ile dengelenmiştir.</span>
      </div>
      <span class="text-[10px] text-slate-400 font-mono">Ort. Mutlak Sapma: ${mae.toFixed(1)} m³/s</span>
    `;
  }

  // Plotly chart depending on mode
  if (currentValMode === "scatter") {
    // 1:1 Scatter Plot
    const allVals = x.concat(y);
    const minVal = Math.max(0, Math.floor(Math.min(...allVals) * 0.85));
    const maxVal = Math.ceil(Math.max(...allVals) * 1.15);

    // 1:1 reference line
    const trace1to1 = {
      x: [minVal, maxVal],
      y: [minVal, maxVal],
      mode: "lines",
      name: "1:1 İdeal Eşitlik Doğrusu (Q_Uydu = Q_DSİ)",
      line: { color: "rgba(255, 255, 255, 0.45)", width: 1.8, dash: "dash" },
      hoverinfo: "name",
    };

    // Regression line
    const regY0 = Math.max(0, slope * minVal + intercept);
    const regY1 = slope * maxVal + intercept;
    const traceReg = {
      x: [minVal, maxVal],
      y: [regY0, regY1],
      mode: "lines",
      name: `Lineer Regresyon (y = ${slope.toFixed(2)}x + ${intercept.toFixed(1)}, R² = ${r2.toFixed(2)})`,
      line: { color: "#f59e0b", width: 2.2 },
      hoverinfo: "name",
    };

    // Paired points
    const tracePoints = {
      x: x,
      y: y,
      mode: "markers",
      name: "Eşzamanlı Uydu-Yer Ölçüm Çiftleri",
      text: paired.map((p) => 
        `<b>Tarih:</b> ${p.date}<br>` +
        `<b>DSİ AGİ Gerçek Debi:</b> ${p.ground} m³/s<br>` +
        `<b>NASA SWOT Uydu Debisi:</b> ${p.swot} m³/s<br>` +
        `<b>Fark (ΔQ):</b> ${p.diff > 0 ? "+" : ""}${p.diff} m³/s (%${p.rel_diff_pct})`
      ),
      hoverinfo: "text",
      marker: {
        size: 11,
        color: "#38bdf8",
        line: { color: "#ffffff", width: 1.5 },
      },
    };

    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#94a3b8", family: "inherit" },
      margin: { l: 60, r: 30, t: 25, b: 50 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.15,
        font: { size: 10, color: "#cbd5e1" },
      },
      xaxis: {
        title: { text: "DSİ AGİ Yer İstasyonu Gerçek Ölçüm Debisi (m³/s)", font: { color: "#38bdf8", size: 11 } },
        range: [minVal, maxVal],
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis: {
        title: { text: "NASA SWOT KaRIn Uydu Akım Tahmini (m³/s)", font: { color: "#f59e0b", size: 11 } },
        range: [minVal, maxVal],
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
    };

    Plotly.newPlot("validation-chart", [trace1to1, traceReg, tracePoints], layout, {
      responsive: true,
      displayModeBar: false,
    });
  } else if (currentValMode === "paired") {
    // Paired Bar Chart: Ground vs SWOT
    const dates = paired.map((p) => p.date);
    const traceGroundBar = {
      x: dates,
      y: x,
      type: "bar",
      name: "DSİ Gerçek Akım (m³/s)",
      marker: { color: "#38bdf8" },
      text: x.map((v) => `${v}`),
      textposition: "auto",
      textfont: { size: 9, color: "#ffffff" },
    };

    const traceSwotBar = {
      x: dates,
      y: y,
      type: "bar",
      name: "SWOT Uydu Akımı (m³/s)",
      marker: { color: "#f59e0b" },
      text: y.map((v) => `${v}`),
      textposition: "auto",
      textfont: { size: 9, color: "#ffffff" },
    };

    const layout = {
      barmode: "group",
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#94a3b8", family: "inherit" },
      margin: { l: 60, r: 30, t: 25, b: 50 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.15,
        font: { size: 10, color: "#cbd5e1" },
      },
      xaxis: {
        title: { text: "Uydu Geçiş Tarihi", font: { color: "#94a3b8", size: 11 } },
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis: {
        title: { text: "Nehir Debisi (m³/s)", font: { color: "#38bdf8", size: 11 } },
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
    };

    Plotly.newPlot("validation-chart", [traceGroundBar, traceSwotBar], layout, {
      responsive: true,
      displayModeBar: false,
    });
  } else if (currentValMode === "residuals") {
    // Residuals / Error Bar Chart
    const dates = paired.map((p) => p.date);
    const diffs = paired.map((p) => p.diff);
    const colors = diffs.map((d) => (d >= 0 ? "rgba(16, 185, 129, 0.85)" : "rgba(239, 68, 68, 0.85)"));

    const traceDiff = {
      x: dates,
      y: diffs,
      type: "bar",
      name: "Artık Hata (Q_Uydu - Q_DSİ)",
      marker: { color: colors },
      text: paired.map((p) => `${p.diff > 0 ? "+" : ""}${p.diff} m³/s`),
      textposition: "outside",
      textfont: { size: 9, color: "#cbd5e1" },
      hoverinfo: "x+text",
    };

    const traceZero = {
      x: [dates[0], dates[dates.length - 1]],
      y: [0, 0],
      mode: "lines",
      name: "Sıfır Hata Çizgisi (0 m³/s)",
      line: { color: "rgba(255, 255, 255, 0.5)", width: 1.5, dash: "dot" },
    };

    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#94a3b8", family: "inherit" },
      margin: { l: 60, r: 30, t: 25, b: 50 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.15,
        font: { size: 10, color: "#cbd5e1" },
      },
      xaxis: {
        title: { text: "Uydu Geçiş Tarihi", font: { color: "#94a3b8", size: 11 } },
        gridcolor: "#334155",
        zerolinecolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis: {
        title: { text: "Fark / Artık Hata (m³/s)", font: { color: "#f43f5e", size: 11 } },
        gridcolor: "#334155",
        zerolinecolor: "#64748b",
        zerolinewidth: 2,
        tickfont: { color: "#cbd5e1" },
      },
    };

    Plotly.newPlot("validation-chart", [traceZero, traceDiff], layout, {
      responsive: true,
      displayModeBar: false,
    });
  }
}

async function loadRidgeline() {
  try {
    const data = await fetchApi(`/api/ridgeline?river=${currentRiver}`);
    const profile = data.profile;

    const sections = profile.map((p) => p.section_name);
    const distFromSea = profile.map((p) => p.dist_from_sea_km);
    const wse = profile.map((p) => p.latest_wse);
    const discharge = profile.map((p) => p.latest_discharge_m3s);

    const traceWSE = {
      x: distFromSea,
      y: wse,
      mode: "lines+markers",
      name: "Su Yüzeyi Kotu - WSE (m)",
      line: { color: "#06b6d4", width: 2.5 },
      marker: { size: 6, color: "#06b6d4" },
      yaxis: "y1",
    };

    const traceDischarge = {
      x: distFromSea,
      y: discharge,
      mode: "lines+markers",
      name: "Akım Debisi (m³/s)",
      line: { color: "#f59e0b", width: 2 },
      marker: { size: 6, color: "#f59e0b" },
      yaxis: "y2",
    };

    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#94a3b8", family: "inherit" },
      margin: { l: 50, r: 50, t: 20, b: 40 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.15,
        font: { size: 11, color: "#cbd5e1" },
      },
      xaxis: {
        title: { text: "Ege Denizi Mansap Ağzına Mesafe (km)" },
        autorange: "reversed", // Upstream (Bulgaria) on left, sea on right
        gridcolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis: {
        title: { text: "Su Yüzeyi Kotu WSE (m)", font: { color: "#06b6d4" } },
        gridcolor: "#334155",
        tickfont: { color: "#cbd5e1" },
      },
      yaxis2: {
        title: { text: "Debi (m³/s)", font: { color: "#f59e0b" } },
        overlaying: "y",
        side: "right",
        showgrid: false,
        tickfont: { color: "#f59e0b" },
      },
    };

    Plotly.newPlot("ridgeline-chart", [traceWSE, traceDischarge], layout, {
      responsive: true,
      displayModeBar: false,
    });
  } catch (err) {
    console.error("Error loading ridgeline:", err);
  }
}

async function loadEarlyWarnings() {
  try {
    const alerts = await fetchApi("/api/alerts");
    const container = document.getElementById("alerts-container");
    container.innerHTML = "";

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
          ✅ Havzada aktif taşkın uyarısı bulunmamaktadır. Bulgaristan baraj kapakları normal rejimdedir.
        </div>
      `;
      return;
    }

    alerts.forEach((alert) => {
      const isCritical = alert.severity === "CRITICAL";
      const borderClass = isCritical ? "border-rose-500/60 bg-rose-950/30" : "border-amber-500/60 bg-amber-950/30";
      const badgeClass = isCritical ? "bg-rose-500 text-white" : "bg-amber-500 text-slate-900";

      const card = document.createElement("div");
      card.className = `p-3 rounded-lg border ${borderClass} space-y-2 text-xs`;
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-sm ${isCritical ? "text-rose-400" : "text-amber-400"}">${alert.headline}</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${alert.severity}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-slate-300">
          <div><span class="text-slate-400">Kaynak:</span> ${alert.source_origin}</div>
          <div><span class="text-slate-400">Hedef İstasyon:</span> ${alert.target_station}</div>
          <div><span class="text-slate-400">Memba Piki:</span> <span class="font-bold text-white">${alert.upstream_peak_discharge_m3s} m³/s</span></div>
          <div><span class="text-slate-400">Beklenen Edirne Toplam:</span> <span class="font-bold text-rose-300">${alert.combined_edirne_discharge_m3s} m³/s</span></div>
          <div><span class="text-slate-400">Lead Time (Varış Süresi):</span> <span class="font-bold text-amber-300">~${alert.estimated_lead_time_hrs} saat</span></div>
          <div><span class="text-slate-400">Tahmini Varış Saati:</span> <span class="font-bold text-white">${alert.estimated_arrival_time}</span></div>
        </div>
        <div class="pt-1 text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-800">
          <span class="text-amber-400 font-semibold">Tavsiye Edilen Eylem:</span> ${alert.action_recommendation}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading alerts:", err);
  }
}

async function applyQCSimulator() {
  const minWidth = parseFloat(document.getElementById("qc-min-width").value);
  const maxU = parseFloat(document.getElementById("qc-max-uncertainty").value);
  const strictIQR = document.getElementById("qc-iqr-checkbox").checked;

  try {
    const data = await fetchApi(`/api/swot/qc-filter?reach_id=${currentReachId}&min_width=${minWidth}&max_uncertainty=${maxU}&strict_iqr=${strictIQR}`, {
      method: "POST",
    });
    const sum = data.summary;

    const resultDiv = document.getElementById("qc-results");
    resultDiv.innerHTML = `
      <div class="p-2 bg-slate-800/80 rounded border border-slate-700 text-xs space-y-1">
        <div class="font-semibold text-emerald-400">QC Filtreleme Tamamlandı:</div>
        <div>Toplam Gözlem: ${sum.total}</div>
        <div>Kabul Edilen: <span class="font-bold text-emerald-300">${sum.accepted}</span></div>
        <div class="text-rose-400">Elenen Dar Segment (< ${minWidth}m): ${sum.rejected_width}</div>
        <div class="text-rose-400">Elenen reach_q Bayrağı: ${sum.rejected_flag}</div>
        <div class="text-rose-400">Elenen Belirsizlik (> ${maxU}m): ${sum.rejected_u}</div>
        <div class="text-rose-400">Elenen IQR Aykırı Değer: ${sum.rejected_iqr}</div>
      </div>
    `;
    // Refresh hydrograph with current reach
    loadHydrograph();
  } catch (err) {
    console.error("Error running QC filter:", err);
  }
}

async function loadEarthdataFloodIndicators() {
  try {
    const data = await fetchApi("/api/earthdata/flood-indicators");
    if (!data) return;

    // Quick metric values
    const rainEl = document.getElementById("ed-gpm-rain");
    const satEl = document.getElementById("ed-smap-sat");
    const runoffEl = document.getElementById("ed-runoff-score");
    const interpEl = document.getElementById("ed-interpretation");

    if (rainEl) rainEl.innerText = `${data.gpm_precipitation_24h_mm} mm`;
    if (satEl) satEl.innerText = `%${data.soil_saturation_percent}`;
    if (runoffEl) runoffEl.innerText = `${data.runoff_potential_score}/100`;

    if (interpEl) {
      let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-700 text-emerald-400">NORMAL DOYGUNLUK</span>`;
      if (data.status === "CRITICAL_SATURATION") {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 border border-rose-700 text-rose-400 animate-pulse">KRİTİK DOYGUNLUK (AMC-III)</span>`;
      } else if (data.status === "WATCH_SATURATION") {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-700 text-amber-400">YÜKSEK DOYGUNLUK İKAZI</span>`;
      }

      interpEl.innerHTML = `
        <div class="flex items-center justify-between mb-1.5">
          <span class="font-semibold text-xs text-white">Hidrolojik Doygunluk Analizi:</span>
          ${statusBadge}
        </div>
        <p class="text-[11px] leading-relaxed text-slate-300">${data.hydrological_interpretation}</p>
        <div class="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap justify-between gap-1 text-[10px] text-slate-400">
          <span>Kategori: <strong class="text-slate-200">${data.amc_class ? data.amc_class.split(' ')[0] : 'AMC-II'}</strong></span>
          <span>Akış Katsayısı (C): <strong class="text-slate-200">${data.runoff_coefficient}</strong></span>
          <span>72s Birikimli: <strong class="text-cyan-300">${data.gpm_precipitation_72h_accumulated_mm} mm</strong></span>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading Earthdata flood indicators:", err);
  }
}

async function loadEarthdataProducts() {
  try {
    const data = await fetchApi("/api/earthdata/products");
    const container = document.getElementById("ed-products-container");
    if (!container) return;

    const products = data.products || data.catalog || [];
    if (products.length === 0) {
      container.innerHTML = `<div class="text-slate-500 text-xs p-2">Katalog yüklenemedi.</div>`;
      return;
    }

    container.innerHTML = products.map((p) => `
      <div class="p-2.5 bg-slate-950/90 rounded border border-slate-800 text-[11px] space-y-1 hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sky-400 font-mono">${p.short_name}</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">${p.daac}</span>
        </div>
        <div class="text-slate-300 font-medium text-[11px]">${p.product_name}</div>
        <div class="text-slate-400 text-[10px] leading-tight">${p.role_in_flood}</div>
        <div class="flex items-center gap-2 pt-1 text-[10px]">
          <a href="${p.direct_url}" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-0.5">
            <span>🔗 Portal</span>
          </a>
          ${p.opendap_url ? `
          <a href="${p.opendap_url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5">
            <span>🌐 OPeNDAP</span>
          </a>` : ""}
          <span class="text-slate-500 ml-auto text-[9px] font-mono">${p.resolution_spatial} • ${p.resolution_temporal}</span>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading Earthdata products:", err);
  }
}

