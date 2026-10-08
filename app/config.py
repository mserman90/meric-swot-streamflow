import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"

REACHES_FILE = DATA_DIR / "reaches_seed.json"
STATIONS_FILE = DATA_DIR / "stations_seed.json"
DAMS_FILE = DATA_DIR / "dams_seed.json"
GEOJSON_FILE = DATA_DIR / "reaches_geojson.json"

# NASA Hydrocron API
HYDROCRON_API_BASE = "https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1.0/timeseries"

# DSİ Edirne Portal
DSI_EDIRNE_PORTAL_URL = "https://edirnenehir.dsi.gov.tr"

# Copernicus / Open-Meteo ERA5 Land fallback API
METEO_API_URL = "https://archive-api.open-meteo.com/v1/archive"

# Basin Coordinates (Center around Edirne / Transboundary junction)
BASIN_CENTER_LAT = 41.67
BASIN_CENTER_LON = 26.56
ZOOM_DEFAULT = 10

# Hydrology Quality Filtering Constants
MIN_RIVER_WIDTH_METERS = 50.0
MAX_WSE_UNCERTAINTY_METERS = 1.0
IQR_OUTLIER_FACTOR = 1.5

# Wave Celerity / Lead Time Constants (m/s)
ARDA_WAVE_CELERITY_MPS = 1.45  # ~5.2 km/h -> ~42 km -> ~8 hours
MERIC_WAVE_CELERITY_MPS = 1.25  # ~4.5 km/h -> ~60 km Svilengrad to Kirişhane -> ~13.5 hours
TUNCA_WAVE_CELERITY_MPS = 1.10  # ~4.0 km/h -> ~40 km Elhovo to Suakacağı -> ~10 hours

# NASA Earthdata Authentication & CMR API
EARTHDATA_USER = os.getenv("EARTHDATA_USER", "mserman")
EARTHDATA_TOKEN = os.getenv(
    "EARTHDATA_TOKEN",
    "eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6Im1zZXJtYW4iLCJleHAiOjE3NzcwMjc5NjQsImlhdCI6MTc3MTg0Mzk2NCwiaXNzIjoiaHR0cHM6Ly91cnMuZWFydGhkYXRhLm5hc2EuZ292IiwiaWRlbnRpdHlfcHJvdmlkZXIiOiJlZGxfb3BzIiwiYWNyIjoiZWRsIiwiYXNzdXJhbmNlX2xldmVsIjozfQ.TJzjvfeT7T-HH9NETllkg3Lst4iKqB4KlJlWCaTs3Q7Rmdo7FbqAZjv934Wubq9HSu2NoCfn3SoJIZtjuJV53yZ1Es12y8QfFR4VaBfmPnO1t8eRnvmzop6_cyrhwIl0fiYPBFmdEwFNUUujAZDvnfsjBIHZAtGh63OvdXCrEvxsii-bVRMbIRDTKyT7FaOQIwH1RBVJd9PENygDc3jNp0vt2KjI0-QZlO2qNrIbJCESzdc71e25NMykY6nEiOUlbzffcRHWvPdmaN_TOI47Ps_rekgn8JCFetz8GOFWxcHDGwzgyIcoHyiM0FbH55ebpTaCyjpvWVK9nHjNXJbUnw",
)
NASA_CMR_API_BASE = "https://cmr.earthdata.nasa.gov/search"
MERIC_BASIN_BBOX = "25.8,40.8,27.2,42.4"  # [min_lon, min_lat, max_lon, max_lat]

