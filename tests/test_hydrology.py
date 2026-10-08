import sys
import math
import numpy as np

# Configure utf-8 encoding for Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.hydrocron import HydrocronClient
from app.services.dsi_client import DSIClient
from app.services.hydrology_engine import HydrologyEngine



def test_qc_filtering():
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    engine = HydrologyEngine(hydrocron, dsi)

    # Synthetic observations with known issues
    raw_obs = [
        {"reach_id": "test1", "wse": 40.2, "wse_u": 0.2, "width": 120.0, "reach_q": 0, "discharge": 250.0},
        {"reach_id": "test2", "wse": 40.5, "wse_u": 0.3, "width": 35.0, "reach_q": 0, "discharge": 260.0},  # narrow width (<50)
        {"reach_id": "test3", "wse": 40.4, "wse_u": 0.25, "width": 110.0, "reach_q": 2, "discharge": 255.0}, # bad reach_q (>1)
        {"reach_id": "test4", "wse": 40.3, "wse_u": 1.4, "width": 115.0, "reach_q": 0, "discharge": 252.0},  # high uncertainty (>1.0)
        {"reach_id": "test5", "wse": 95.0, "wse_u": 0.2, "width": 130.0, "reach_q": 0, "discharge": 270.0},  # IQR outlier
        {"reach_id": "test6", "wse": 40.1, "wse_u": 0.18, "width": 125.0, "reach_q": 0, "discharge": 248.0},
        {"reach_id": "test7", "wse": 40.6, "wse_u": 0.22, "width": 118.0, "reach_q": 0, "discharge": 265.0},
        {"reach_id": "test8", "wse": 40.3, "wse_u": 0.19, "width": 122.0, "reach_q": 0, "discharge": 254.0},
    ]

    accepted, summary = engine.filter_and_qc_observations(raw_obs, min_width=50.0, max_uncertainty=1.0, strict_iqr=True)

    assert summary["total"] == 8, "Total count mismatch"
    assert summary["rejected_width"] == 1, "Width rejection failed"
    assert summary["rejected_flag"] == 1, "Quality flag rejection failed"
    assert summary["rejected_u"] == 1, "Uncertainty rejection failed"
    assert summary["rejected_iqr"] == 1, "IQR outlier rejection failed"
    assert len(accepted) == 4, f"Expected 4 accepted obs, got {len(accepted)}"
    print("[OK] QC Filtering Test PASSED")


def test_datum_correction():
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    engine = HydrologyEngine(hydrocron, dsi)

    swot_wse = [42.1, 42.5, 43.0]
    ground_wse = [49.0, 49.4, 49.9] # Offset is ~6.9 m

    offset = engine.compute_vertical_datum_offset(swot_wse, ground_wse)
    assert abs(offset - 6.9) < 0.05, f"Unexpected offset {offset}"

    corrected = engine.apply_datum_correction(42.2, offset)
    assert abs(corrected - 49.1) < 0.05, f"Corrected WSE mismatch {corrected}"
    print("[OK] Datum Correction Test PASSED")


def test_inverse_distance_node_matching():
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    engine = HydrologyEngine(hydrocron, dsi)

    # Station at (41.658, 26.556)
    nodes = [
        {"node_id": "n1", "lat": 41.658, "lon": 26.556, "wse": 39.5, "wse_u": 0.1},  # Exactly at station
        {"node_id": "n2", "lat": 41.670, "lon": 26.570, "wse": 42.0, "wse_u": 0.5},  # Further away, higher variance
    ]

    result = engine.aggregate_nodes_to_station(nodes, station_lat=41.658, station_lon=26.556)
    # The node at the station with low uncertainty should dominate the weight
    assert abs(result["weighted_wse"] - 39.5) < 0.2, f"Weighted WSE {result['weighted_wse']} expected near 39.5"
    print("[OK] Inverse Distance & Variance Node Matching Test PASSED")


def test_hydrological_metrics():
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    engine = HydrologyEngine(hydrocron, dsi)

    obs = np.array([100.0, 150.0, 200.0, 250.0, 300.0])
    # Slight variation
    sim = np.array([105.0, 148.0, 202.0, 245.0, 305.0])

    metrics = engine.compute_metrics(obs, sim)
    assert metrics.rmse < 10.0, f"RMSE too high: {metrics.rmse}"
    assert metrics.pearson_r > 0.95, f"r too low: {metrics.pearson_r}"
    assert metrics.nse > 0.90, f"NSE too low: {metrics.nse}"
    assert metrics.kge > 0.85, f"KGE too low: {metrics.kge}"
    print(f"[OK] Hydrological Metrics Test PASSED: RMSE={metrics.rmse}, r={metrics.pearson_r}, NSE={metrics.nse}, KGE={metrics.kge}")


def test_early_warning_routing():
    hydrocron = HydrocronClient()
    dsi = DSIClient()
    engine = HydrologyEngine(hydrocron, dsi)

    alerts = engine.calculate_transboundary_early_warning()
    assert len(alerts) > 0, "Expected at least one early warning alert"
    first = alerts[0]
    assert first.estimated_lead_time_hrs > 0, "Lead time must be positive"
    assert first.upstream_peak_discharge_m3s > 0, "Peak discharge must be positive"
    print(f"[OK] Early Warning Test PASSED: {len(alerts)} alerts generated, Lead time: {first.estimated_lead_time_hrs}h")


if __name__ == "__main__":
    test_qc_filtering()
    test_datum_correction()
    test_inverse_distance_node_matching()
    test_hydrological_metrics()
    test_early_warning_routing()
    print("\n[SUCCESS] ALL HYDROLOGICAL ENGINE TESTS PASSED SUCCESSFULLY!")

