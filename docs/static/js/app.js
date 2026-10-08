// Meriç-Tunca-Arda SWOT Streamflow & Flood Early Warning App
let map;
let reachesLayer;
let stationsLayer;
let damsLayer;
let currentStationId = "D01A001"; // Kirişhane AGİ default
let currentReachId = "23214000121"; // Meriç Edirne Reach
let currentDays = 180;
let currentRiver = "Meriç";

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

  // Base layers
  const darkLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 18,
  }).addTo(map);

  const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri",
    maxZoom: 18,
  });

  const baseMaps = {
    "Karanlık Harita (Dark)": darkLayer,
    "Uydu Görüntüsü (Satellite)": satelliteLayer,
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
      "D01A001": "23214000121", // Kirişhane -> Meriç Edirne
      "D01A003": "23214000151", // İpsala -> İpsala Reach
      "D01A005": "23214100021", // Suakacağı -> Tunca Sınır
      "D01A006": "23214100031", // Değirmenyeni -> Tunca Sarayiçi
      "D01A008": "23214200021", // Arda Köprüsü -> Arda Mansap
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
      let color = "#10b981"; // green
      if (status === "danger") color = "#ef4444";
      else if (status === "warning") color = "#f59e0b";

      const polyline = L.polyline(coords, {
        color: color,
        weight: 5,
        opacity: 0.85,
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
  } catch (err) {
    console.error("Error loading hydrograph:", err);
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
