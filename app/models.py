from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SWOTNode(BaseModel):
    node_id: str
    lat: float
    lon: float
    dist_km: float


class SWORDReach(BaseModel):
    reach_id: str
    river_name: str
    section_name: str
    country: str
    reach_length_km: float
    dist_from_sea_km: float
    mean_width_m: float
    mean_slope: float
    wse_ref: float
    dsi_nearest_station_id: Optional[str] = None
    coordinates: List[List[float]]
    nodes: Optional[List[SWOTNode]] = None


class SWOTObservation(BaseModel):
    reach_id: str
    time_str: str
    wse: float = Field(..., description="Water surface elevation in meters (WGS84/EGM2008)")
    wse_u: float = Field(..., description="WSE uncertainty in meters")
    width: float = Field(..., description="River surface width in meters")
    slope: float = Field(..., description="Water surface slope")
    reach_q: int = Field(..., description="Quality flag (0: Good, >0: Suspect)")
    discharge: float = Field(..., description="L4 SOS / DAAWG consensus discharge m3/s")
    is_valid: bool = True
    qc_notes: Optional[str] = None


class DSIStationThresholds(BaseModel):
    normal_max_m3s: float
    warning_m3s: float
    alarm_m3s: float
    flood_m3s: float


class DSIStation(BaseModel):
    station_id: str
    station_name: str
    river: str
    basin: str
    lat: float
    lon: float
    altitude_m: float
    datum_offset_m: float
    thresholds: DSIStationThresholds
    critical_stage_m: float
    lead_time_from_upstream_hrs: float
    description: str


class DSIObservation(BaseModel):
    station_id: str
    station_name: str
    river: str
    timestamp: str
    stage_m: float
    discharge_m3s: float
    status: str = Field(..., description="NORMAL, WARNING, ALARM, FLOOD")


class UpstreamDam(BaseModel):
    dam_id: str
    name: str
    river: str
    country: str
    lat: float
    lon: float
    capacity_million_m3: float
    current_occupancy_percent: float
    spillway_discharge_m3s: float
    distance_to_edirne_km: float
    wave_celerity_mps: float
    estimated_lead_time_hrs: float
    status: str
    alert_level: str


class HydrologicalMetrics(BaseModel):
    rmse: float
    pearson_r: float
    nse: float
    kge: float
    n_observations: int


class ContinuousHydrographPoint(BaseModel):
    date: str
    ground_discharge_m3s: Optional[float] = None
    swot_discharge_m3s: Optional[float] = None
    ml_continuous_m3s: float
    precipitation_mm: float
    temperature_c: float
    is_swot_pass: bool = False
    warning_threshold_m3s: float
    flood_threshold_m3s: float


class EarlyWarningAlert(BaseModel):
    alert_id: str
    severity: str  # INFO, WARNING, CRITICAL
    river: str
    source_origin: str
    target_station: str
    upstream_peak_discharge_m3s: float
    combined_edirne_discharge_m3s: float
    estimated_lead_time_hrs: float
    estimated_arrival_time: str
    headline: str
    action_recommendation: str


class BasinOverviewResponse(BaseModel):
    total_reaches: int
    total_stations: int
    active_alerts_count: int
    system_status: str
    current_edirne_total_flow_m3s: float
    alert_level: str
