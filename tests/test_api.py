import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio

from app.main import (
    serve_index,
    get_basin_overview,
    get_all_reaches,
    get_reach_detail,
    get_all_stations,
    get_station_detail,
    get_hydrograph,
    get_ridgeline_profile,
    get_early_warning_alerts,
    get_upstream_dams,
    get_geojson_reaches,
    test_swot_qc_filter,
)


def log(msg):
    safe_msg = msg.encode("ascii", "replace").decode("ascii")
    print(safe_msg, flush=True)


async def run_api_tests():
    log("Starting Direct Endpoint Integration Tests...")

    # 1. UI HTML endpoint
    res = await serve_index()
    assert res.status_code == 200
    assert "Meriç-Tunca-Arda" in res.body.decode("utf-8")
    log("[OK] serve_index() returned HTML with title")

    # 2. Basin Overview
    overview = await get_basin_overview()
    assert overview["total_reaches"] >= 12
    assert overview["current_edirne_total_flow_m3s"] > 0
    log(f"[OK] get_basin_overview(): Total flow = {overview['current_edirne_total_flow_m3s']} m3/s, Alerts = {overview['active_alerts_count']}")

    # 3. All Reaches
    reaches = await get_all_reaches()
    assert len(reaches) >= 12
    log(f"[OK] get_all_reaches(): {len(reaches)} reaches retrieved")

    # 4. Reach Detail
    detail = await get_reach_detail("23214000121")
    assert detail["reach"]["reach_id"] == "23214000121"
    assert "qc_summary" in detail
    log(f"[OK] get_reach_detail(23214000121): Valid obs = {len(detail['valid_observations'])}")

    # 5. Stations
    stations = await get_all_stations()
    assert len(stations) == 5
    log(f"[OK] get_all_stations(): 5 DSİ stations retrieved")

    # 6. Station Detail
    st_det = await get_station_detail("D01A001", days=60)
    assert len(st_det["timeseries"]) == 60
    log(f"[OK] get_station_detail(D01A001): 60 daily records retrieved")

    # 7. Hydrograph with ML fusion
    hg = await get_hydrograph(station_id="D01A001", reach_id="23214000121", days=90)
    assert len(hg["hydrograph"]) == 90
    m = hg["metrics"]
    log(f"[OK] get_hydrograph(): ML & SWOT fused! RMSE={m.rmse} m3/s, r={m.pearson_r}, NSE={m.nse}, KGE={m.kge}")

    # 8. Ridgeline profile
    rl = await get_ridgeline_profile(river="Meriç")
    assert len(rl["profile"]) > 0
    log(f"[OK] get_ridgeline_profile(Meriç): {len(rl['profile'])} longitudinal segments from Bulgaria to Aegean Sea")

    # 9. Early Warning Alerts
    alerts = await get_early_warning_alerts()
    log(f"[OK] get_early_warning_alerts(): {len(alerts)} alerts generated")
    for a in alerts:
        log(f"     -> [{a.severity}] {a.headline} (Lead Time: ~{a.estimated_lead_time_hrs}h)")

    # 10. Upstream Dams
    dams = await get_upstream_dams()
    assert len(dams) >= 5
    log(f"[OK] get_upstream_dams(): {len(dams)} Bulgarian dams tracked")

    # 11. GeoJSON Reaches
    geojson = await get_geojson_reaches()
    assert geojson["type"] == "FeatureCollection"
    log(f"[OK] get_geojson_reaches(): {len(geojson['features'])} GeoJSON features")

    # 12. Interactive QC Filter Simulation
    qc_res = await test_swot_qc_filter(reach_id="23214000121", min_width=60, max_uncertainty=0.9, strict_iqr=True)
    assert "summary" in qc_res
    log(f"[OK] test_swot_qc_filter(): Accepted count = {qc_res['accepted_count']}")

    log("\n[SUCCESS] ALL FASTAPI ENDPOINTS DIRECTLY TESTED AND VERIFIED!")


if __name__ == "__main__":
    asyncio.run(run_api_tests())
