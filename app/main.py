import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR, DATA_DIR, FRONTEND_DIR, GEOJSON_FILE
from app.models import (
    BasinOverviewResponse,
    HydrologicalMetrics,
)
from app.services.hydrocron import HydrocronClient
from app.services.dsi_client import DSIClient
from app.services.hydrology_engine import HydrologyEngine

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("meric-swot")

app = FastAPI(
    title="Meriç-Tunca-Arda SWOT & Hibrit ML Nehir Akım ve Taşkın İzleme Sistemi",
    description="Bulgaristan-Türkiye Sınıraşan Havzaları SWOT Uydu Verisi ve Hibrit Makine Öğrenmesi Tabanlı Gerçek Zamanlı Nehir Akım ve Taşkın Erken Uyarı Platformu",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service instances
hydrocron_client = HydrocronClient()
dsi_client = DSIClient()
hydrology_engine = HydrologyEngine(hydrocron_client, dsi_client)

# Mount static files if directory exists
static_path = FRONTEND_DIR / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h2>Meriç-Tunca-Arda SWOT Hidroloji Portalı - UI Yükleniyor...</h2>")


@app.get("/api/basin/overview")
async def get_basin_overview():
    """
    Havza genel durum özeti: toplam segmentler, istasyonlar, toplam Edirne debisi ve erken uyarı durumu.
    """
    reaches = hydrocron_client.get_all_reaches()
    stations = dsi_client.get_stations()
    alerts = hydrology_engine.calculate_transboundary_early_warning()
    flow_summary = dsi_client.get_combined_edirne_flow()

    total_edirne_flow = flow_summary["total_edirne_m3s"]
    alert_level = "NORMAL"
    if any(a.severity == "CRITICAL" for a in alerts) or total_edirne_flow >= 1000.0:
        alert_level = "CRITICAL"
    elif any(a.severity == "WARNING" for a in alerts) or total_edirne_flow >= 750.0:
        alert_level = "WARNING"

    return {
        "total_reaches": len(reaches),
        "total_stations": len(stations),
        "active_alerts_count": len(alerts),
        "system_status": "OPERATIONAL_REALTIME_SWOT",
        "current_edirne_total_flow_m3s": total_edirne_flow,
        "alert_level": alert_level,
        "flow_details": flow_summary,
    }


@app.get("/api/reaches")
async def get_all_reaches():
    """
    Tüm SWORD reach segmentlerini ve en son gözlemlerini döndürür.
    """
    reaches = hydrocron_client.get_all_reaches()
    results = []
    for r in reaches:
        obs = hydrocron_client.get_reach_observations(r["reach_id"])
        latest = obs[-1] if obs else {}
        item = dict(r)
        item["latest_observation"] = latest
        item["status"] = (
            "danger"
            if latest.get("discharge", 0) >= 1000
            else ("warning" if latest.get("discharge", 0) >= 700 else "normal")
        )
        results.append(item)
    return results


@app.get("/api/reaches/{reach_id}")
async def get_reach_detail(reach_id: str):
    """
    Belirli bir SWORD reach segmentinin detayları ve SWOT gözlem serisi.
    """
    reach = hydrocron_client.get_reach_by_id(reach_id)
    if not reach:
        raise HTTPException(status_code=404, detail="Reach not found")

    raw_obs = hydrocron_client.get_reach_observations(reach_id)
    valid_obs, qc_summary = hydrology_engine.filter_and_qc_observations(raw_obs)

    return {
        "reach": reach,
        "raw_observations": raw_obs,
        "valid_observations": valid_obs,
        "qc_summary": qc_summary,
    }


@app.get("/api/stations")
async def get_all_stations():
    """
    DSİ 11. Bölge Edirne AGİ istasyonlarının son ölçümleri ve eşik bilgileri.
    """
    return dsi_client.get_latest_observations_all()


@app.get("/api/stations/{station_id}")
async def get_station_detail(station_id: str, days: int = Query(180, ge=10, le=365)):
    """
    İstasyon meta verisi ve geçmiş zaman serisi.
    """
    station = dsi_client.get_station_by_id(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    timeseries = dsi_client.generate_station_timeseries(station_id, days_span=days)
    return {
        "station": station,
        "timeseries": timeseries,
    }


@app.get("/api/hydrograph")
async def get_hydrograph(
    station_id: str = Query("D01A001", description="DSİ Station ID (e.g. D01A001 Kirişhane)"),
    reach_id: str = Query("23214000121", description="SWORD Reach ID"),
    days: int = Query(180, ge=30, le=365),
):
    """
    Yersel AGİ debisi, SWOT anlık geçiş noktaları ve ML ile doldurulan sürekli akış eğrisi.
    Dinamik olarak RMSE, Pearson r, NSE ve KGE metriklerini döndürür.
    """
    station = dsi_client.get_station_by_id(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    hydrograph_data, metrics = hydrology_engine.generate_continuous_hydrograph(
        station_id=station_id,
        reach_id=reach_id,
        days_span=days,
    )

    return {
        "station": station,
        "reach_id": reach_id,
        "days": days,
        "metrics": metrics,
        "hydrograph": hydrograph_data,
    }


@app.get("/api/ridgeline")
async def get_ridgeline_profile(river: str = Query("Meriç", description="Nehir adı: Meriç, Tunca, Arda")):
    """
    Membadan mansaba (Bulgaristan sınırından Ege Denizi döküm noktasına kadar) akım ve kot boyuna profili.
    """
    profile = hydrology_engine.get_longitudinal_ridgeline_profile(river_name=river)
    return {
        "river": river,
        "profile": profile,
    }


@app.get("/api/alerts")
async def get_early_warning_alerts():
    """
    Sınıraşan erken uyarı ve lead-time (varış süresi) analizleri.
    Bulgaristan barajları ve memba debi dalgalarının Edirne'ye tahmini varış süresi.
    """
    alerts = hydrology_engine.calculate_transboundary_early_warning()
    return alerts


@app.get("/api/dams")
async def get_upstream_dams():
    """
    Bulgaristan memba barajları (Ivaylovgrad, Studen Kladenets, Kardzhali, Zhrebchevo, Koprinka) durumu.
    """
    return hydrology_engine.dams


@app.get("/api/geojson/reaches")
async def get_geojson_reaches():
    """
    Harita katmanı için GeoJSON segment verisi.
    """
    if GEOJSON_FILE.exists():
        with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


@app.post("/api/swot/qc-filter")
async def test_swot_qc_filter(
    reach_id: str = Query("23214000121"),
    min_width: float = Query(50.0),
    max_uncertainty: float = Query(1.0),
    strict_iqr: bool = Query(True),
):
    """
    Kullanıcı arayüzünden dinamik parametrelerle SWOT filtreleme testi yapma uç noktası.
    """
    obs = hydrocron_client.get_reach_observations(reach_id)
    accepted, summary = hydrology_engine.filter_and_qc_observations(
        obs,
        min_width=min_width,
        max_uncertainty=max_uncertainty,
        strict_iqr=strict_iqr,
    )
    return {
        "reach_id": reach_id,
        "summary": summary,
        "accepted_count": len(accepted),
        "sample_accepted": accepted[:5],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
