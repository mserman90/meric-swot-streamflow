import json
import shutil
from pathlib import Path
import os
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.hydrocron import HydrocronClient
from app.services.dsi_client import DSIClient
from app.services.hydrology_engine import HydrologyEngine
from app.services.earthdata_flood import EarthdataFloodClient
from app.config import GEOJSON_FILE

def export_static_site():
    docs_dir = BASE_DIR / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    api_dir = docs_dir / "api"
    api_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Initialize backend services
    print("Initializing hydrology engine & clients...")
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    earthdata = EarthdataFloodClient()
    engine = HydrologyEngine(hydrocron, dsi)
    
    # 2. Export /api/basin/overview -> docs/api/basin_overview.json
    print("Exporting basin overview...")
    reaches = hydrocron.get_all_reaches()
    stations = dsi.get_stations()
    alerts = engine.calculate_transboundary_early_warning()
    flow_summary = dsi.get_combined_edirne_flow()
    total_edirne_flow = flow_summary["total_edirne_m3s"]
    alert_level = "NORMAL"
    if any(a.severity == "CRITICAL" for a in alerts) or total_edirne_flow >= 1000.0:
        alert_level = "CRITICAL"
    elif any(a.severity == "WARNING" for a in alerts) or total_edirne_flow >= 750.0:
        alert_level = "WARNING"
        
    overview_data = {
        "total_reaches": len(reaches),
        "total_stations": len(stations),
        "active_alerts_count": len(alerts),
        "system_status": "OPERATIONAL_REALTIME_SWOT",
        "current_edirne_total_flow_m3s": total_edirne_flow,
        "alert_level": alert_level,
        "flow_details": flow_summary,
    }
    with open(api_dir / "basin_overview.json", "w", encoding="utf-8") as f:
        json.dump(overview_data, f, ensure_ascii=False, indent=2)

    # 3. Export /api/reaches -> docs/api/reaches.json
    print("Exporting reaches...")
    reaches_results = []
    for r in reaches:
        obs = hydrocron.get_reach_observations(r["reach_id"])
        latest = obs[-1] if obs else {}
        item = dict(r)
        item["latest_observation"] = latest
        item["status"] = (
            "danger"
            if latest.get("discharge", 0) >= 1000
            else ("warning" if latest.get("discharge", 0) >= 700 else "normal")
        )
        reaches_results.append(item)
    with open(api_dir / "reaches.json", "w", encoding="utf-8") as f:
        json.dump(reaches_results, f, ensure_ascii=False, indent=2)

    # Export reach details: docs/api/reach_{reach_id}.json
    for r in reaches:
        rid = r["reach_id"]
        raw_obs = hydrocron.get_reach_observations(rid)
        valid_obs, qc_summary = engine.filter_and_qc_observations(raw_obs)
        detail = {
            "reach": r,
            "observations_count": len(raw_obs),
            "valid_observations_count": len(valid_obs),
            "qc_summary": qc_summary,
            "latest_observation": raw_obs[-1] if raw_obs else None,
        }
        with open(api_dir / f"reach_{rid}.json", "w", encoding="utf-8") as f:
            json.dump(detail, f, ensure_ascii=False, indent=2)

    # 4. Export /api/stations -> docs/api/stations.json
    print("Exporting stations...")
    stations_data = dsi.get_latest_observations_all()
    with open(api_dir / "stations.json", "w", encoding="utf-8") as f:
        json.dump(stations_data, f, ensure_ascii=False, indent=2)

    # 5. Export /api/dams -> docs/api/dams.json
    print("Exporting dams...")
    dams_data = engine.dams
    with open(api_dir / "dams.json", "w", encoding="utf-8") as f:
        json.dump(dams_data, f, ensure_ascii=False, indent=2)

    # 6. Export /api/ridgeline -> docs/api/ridgeline.json and docs/api/ridgeline_{river}.json
    print("Exporting ridgeline profiles...")
    for riv in ["Meriç", "Tunca", "Arda"]:
        r_profile = engine.get_longitudinal_ridgeline_profile(river_name=riv)
        r_data = {"river": riv, "profile": r_profile}
        with open(api_dir / f"ridgeline_{riv}.json", "w", encoding="utf-8") as f:
            json.dump(r_data, f, ensure_ascii=False, indent=2)
    # Default ridgeline (Meriç)
    default_profile = engine.get_longitudinal_ridgeline_profile(river_name="Meriç")
    with open(api_dir / "ridgeline.json", "w", encoding="utf-8") as f:
        json.dump({"river": "Meriç", "profile": default_profile}, f, ensure_ascii=False, indent=2)

    # 7. Export /api/alerts -> docs/api/alerts.json
    print("Exporting early warnings...")
    alerts_data = [a.dict() if hasattr(a, "dict") else dict(a) for a in alerts]
    with open(api_dir / "alerts.json", "w", encoding="utf-8") as f:
        json.dump(alerts_data, f, ensure_ascii=False, indent=2)

    # 8. Export GeoJSON
    if GEOJSON_FILE.exists():
        with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
            geojson_data = json.load(f)
        with open(api_dir / "geojson_reaches.json", "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)

    # 8.5 Export NASA Earthdata Flood datasets & indicators
    print("Exporting NASA Earthdata flood products & indicators...")
    earthdata_products = {
        "theme": "NASA Earthdata Floods",
        "user": earthdata.user,
        "basin_bbox": earthdata.bbox,
        "products": earthdata.get_flood_thematic_catalog(),
    }
    with open(api_dir / "earthdata_products.json", "w", encoding="utf-8") as f:
        json.dump(earthdata_products, f, ensure_ascii=False, indent=2)

    earthdata_indicators = earthdata.compute_basin_flood_indicators(precipitation_24h_mm=14.5)
    with open(api_dir / "earthdata_flood_indicators.json", "w", encoding="utf-8") as f:
        json.dump(earthdata_indicators, f, ensure_ascii=False, indent=2)

    # 9. Export Hydrograph permutations
    print("Exporting hydrographs for all stations and spans...")
    station_ids = ["D01A001", "D01A003", "D01A005", "D01A006", "D01A008"]
    spans = [30, 90, 180, 365]
    for st_id in station_ids:
        st_obj = dsi.get_station_by_id(st_id)
        for span in spans:
            print(f"  Generating hydrograph: {st_id} ({span} days)...")
            hydrograph_data, metrics = engine.generate_continuous_hydrograph(
                station_id=st_id,
                reach_id="23214000121",
                days_span=span,
            )
            metrics_dict = metrics.model_dump() if hasattr(metrics, "model_dump") else (metrics.dict() if hasattr(metrics, "dict") else dict(metrics))
            hydro_list = [p.model_dump() if hasattr(p, "model_dump") else (p.dict() if hasattr(p, "dict") else dict(p)) for p in hydrograph_data]
            res = {
                "station": st_obj,
                "reach_id": "23214000121",
                "days": span,
                "metrics": metrics_dict,
                "hydrograph": hydro_list,
            }
            with open(api_dir / f"hydrograph_{st_id}_{span}.json", "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False, indent=2)

    # 10. Copy static files & directories
    print("Copying static assets and data...")
    docs_static = docs_dir / "static"
    if docs_static.exists():
        shutil.rmtree(docs_static)
    shutil.copytree(BASE_DIR / "frontend" / "static", docs_static)

    docs_data = docs_dir / "data"
    if docs_data.exists():
        shutil.rmtree(docs_data)
    shutil.copytree(BASE_DIR / "data", docs_data)

    # 11. Copy and adapt index.html
    print("Adapting index.html for relative paths...")
    with open(BASE_DIR / "frontend" / "index.html", "r", encoding="utf-8") as f:
        html_content = f.read()

    # Convert /static/ to static/
    html_adapted = html_content.replace('href="/static/', 'href="static/').replace('src="/static/', 'src="static/')
    with open(docs_dir / "index.html", "w", encoding="utf-8") as f:
        f.write(html_adapted)

    # Create .nojekyll in docs to avoid Jekyll ignoring files or folders
    with open(docs_dir / ".nojekyll", "w", encoding="utf-8") as f:
        f.write("")

    print(f"Static site export completed successfully at: {docs_dir}")

if __name__ == "__main__":
    export_static_site()
