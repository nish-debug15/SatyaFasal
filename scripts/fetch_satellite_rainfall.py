#!/usr/bin/env python3
"""
SatyaFasal - Satellite & Rainfall Data Extractor
Pulls real satellite (Sentinel-2 NDVI/NDWI, Sentinel-1 VV/VH backscatter fallback)
and actual + long-term normal rainfall data via API calls.

Strictly zero hallucinated or estimated values:
If an API fails or returns no data, cells remain blank and errors are logged.
"""

import os
import sys
import time
import math
import random
import logging
import argparse
import datetime
from typing import Dict, Any, Optional, Tuple, List

import requests
import pandas as pd
from dotenv import dotenv_values

# Resolve project root (parent of scripts/ directory) so relative paths work correctly
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("satellite_rainfall_fetch.log", mode="a", encoding="utf-8")
    ]
)
logger = logging.getLogger("SatyaFasalDataFetcher")

# --- Disk cache for successful API responses ----------------------------
# Keyed by (sensor/kind, rounded lat, rounded lon, date(s), window_days).
# Only successful results are ever cached - a failed/partial call is never
# stored, so re-running never "locks in" a bad or missing value. This means
# a PARTIAL row that succeeded on pre-loss but failed on post-loss will not
# re-spend an API call on the pre-loss half when you retry it.
import json

CACHE_PATH = os.path.join(PROJECT_ROOT, ".satyafasal_fetch_cache.json")
_cache: Dict[str, Any] = {}


def _load_cache() -> None:
    global _cache
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                _cache = json.load(f)
            logger.info("Loaded %d cached API responses from %s", len(_cache), CACHE_PATH)
        except Exception as e:
            logger.warning("Could not read cache file (%s). Starting with an empty cache.", e)
            _cache = {}


def _save_cache() -> None:
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_cache, f)
    except Exception as e:
        logger.warning("Could not write cache file: %s", e)


def _cache_get(key: str) -> Optional[Any]:
    return _cache.get(key)


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = value
    _save_cache()

# API Endpoints
CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_CLIMATE_URL = "https://climate-api.open-meteo.com/v1/climate"

# Evalscripts for Sentinel-2 and Sentinel-1 Statistical API
EVALSCRIPT_S2 = """//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B03", "B04", "B08", "B11", "SCL", "CLM", "dataMask"]
    }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "cloud", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}

function evaluatePixel(samples) {
  if (samples.dataMask === 0) {
    return { ndvi: [0], ndwi: [0], cloud: [0], dataMask: [0] };
  }
  let denom_ndvi = samples.B08 + samples.B04;
  let ndvi = denom_ndvi > 0 ? (samples.B08 - samples.B04) / denom_ndvi : 0;
  
  let denom_ndwi = samples.B03 + samples.B08;
  let ndwi = denom_ndwi > 0 ? (samples.B03 - samples.B08) / denom_ndwi : 0;
  
  // SCL cloud classes: 3 (cloud shadow), 8 (cloud medium prob), 9 (cloud high prob), 10 (thin cirrus)
  let isCloud = (samples.CLM === 1 || samples.SCL === 3 || samples.SCL === 8 || samples.SCL === 9 || samples.SCL === 10) ? 1.0 : 0.0;
  
  return {
    ndvi: [ndvi],
    ndwi: [ndwi],
    cloud: [isCloud],
    dataMask: [samples.dataMask]
  };
}
"""

EVALSCRIPT_S1 = """//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["VV", "VH", "dataMask"]
    }],
    output: [
      { id: "vv_db", bands: 1, sampleType: "FLOAT32" },
      { id: "vh_db", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}

function evaluatePixel(samples) {
  if (samples.dataMask === 0 || samples.VV <= 0 || samples.VH <= 0) {
    return { vv_db: [0], vh_db: [0], dataMask: [0] };
  }
  let vv_db = 10 * Math.log10(samples.VV);
  let vh_db = 10 * Math.log10(samples.VH);
  return {
    vv_db: [vv_db],
    vh_db: [vh_db],
    dataMask: [samples.dataMask]
  };
}
"""


class CopernicusAuth:
    """Handles OAuth 2.0 token acquisition and caching for Copernicus Data Space Ecosystem."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token: Optional[str] = None
        self.expires_at: float = 0

    def get_token(self) -> str:
        # Refresh 60 seconds before expiration
        if self.token and time.time() < self.expires_at - 60:
            return self.token

        logger.info("Acquiring fresh OAuth token from Copernicus CDSE...")
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        for attempt in range(1, 4):
            try:
                resp = requests.post(CDSE_TOKEN_URL, data=payload, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    self.token = data["access_token"]
                    expires_in = data.get("expires_in", 300)
                    self.expires_at = time.time() + expires_in
                    logger.info("OAuth token acquired successfully (expires in %ds).", expires_in)
                    return self.token
                else:
                    logger.warning("CDSE Auth failed (attempt %d/3): %d %s", attempt, resp.status_code, resp.text)
            except Exception as e:
                logger.warning("CDSE Auth request exception (attempt %d/3): %s", attempt, str(e))
            time.sleep(2 * attempt)

        raise RuntimeError("Failed to authenticate with Copernicus Data Space Ecosystem after 3 attempts.")


def retry_request(func, max_retries=3, backoff_factor=1.5, *args, **kwargs):
    """Executes a callable with exponential backoff on transient errors."""
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            if attempt == max_retries:
                raise e
            wait_time = backoff_factor ** attempt
            logger.warning("Request failed on attempt %d/%d: %s. Retrying in %.1fs...", attempt, max_retries, e, wait_time)
            time.sleep(wait_time)
        except Exception as e:
            raise e


# --- Rate limiting / 429-aware retry -----------------------------------
# The previous retry_request() only caught network-level exceptions, so a
# 429 response (a normal, successfully-received HTTP response) was never
# retried at all. That's the actual cause of most PARTIAL rows - not
# cloud cover. This wraps every outbound call with:
#   1. a minimum spacing between requests to the SAME host (so a single
#      village doesn't fire 4-6 calls in a burst), and
#   2. real retry-on-429/5xx with exponential backoff + jitter, honoring
#      the Retry-After header when the server sends one.
_last_call_by_domain: Dict[str, float] = {}
_domain_min_interval = {
    "copernicus": 2.0,       # Sentinel Hub Statistical API (S2 + S1)
    "open-meteo-archive": 1.0,
    "open-meteo-climate": 2.5,  # heaviest call (30yr daily series) - space it out more
}


def _throttle(domain: str) -> None:
    min_interval = _domain_min_interval.get(domain, 1.0)
    last = _last_call_by_domain.get(domain, 0.0)
    elapsed = time.time() - last
    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)
    _last_call_by_domain[domain] = time.time()


def request_with_backoff(func, domain: str, max_retries: int = 6, base_wait: float = 8.0):
    """
    Runs func() (a zero-arg callable that performs the HTTP call), paced by
    _throttle(domain), and retries on 429 / 5xx with exponential backoff.
    Honors the Retry-After header if the server provides one. Returns the
    final response object (which may still carry a non-200 status if every
    retry was exhausted - callers already handle that case downstream).

    Backoff schedule: base_wait * 2^(attempt-1) + jitter
    e.g., base_wait=2.0 → delays of ~2s, ~4s, ~8s, ~16s, ...
    """
    resp = None
    for attempt in range(1, max_retries + 1):
        _throttle(domain)
        try:
            resp = func()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries:
                raise e
            wait = base_wait * (2 ** (attempt - 1)) + random.uniform(0, 1.0)
            logger.warning("[%s] network error (%s), retrying in %.1fs (attempt %d/%d)...",
                           domain, e, wait, attempt, max_retries)
            time.sleep(wait)
            continue

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    wait = float(retry_after) + random.uniform(0, 1.0)
                except ValueError:
                    wait = base_wait * (2 ** (attempt - 1)) + random.uniform(0, 1.0)
            else:
                wait = base_wait * (2 ** (attempt - 1)) + random.uniform(0, 1.0)
            if attempt == max_retries:
                logger.warning("[%s] still rate limited after %d attempts, giving up.", domain, max_retries)
                return resp
            logger.warning("[%s] rate limited (429). Waiting %.1fs before retry %d/%d...",
                           domain, wait, attempt, max_retries)
            time.sleep(wait)
            continue

        if resp.status_code >= 500 and attempt < max_retries:
            wait = base_wait * (2 ** (attempt - 1)) + random.uniform(0, 1.0)
            logger.warning("[%s] server error %d, retrying in %.1fs (attempt %d/%d)...",
                           domain, resp.status_code, wait, attempt, max_retries)
            time.sleep(wait)
            continue

        return resp

    return resp


def fetch_sentinel2_stats(
    auth: CopernicusAuth,
    lat: float,
    lon: float,
    target_date_str: str,
    window_days: int = 7,
    delta_deg: float = 0.005
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Fetches Sentinel-2 Statistical API data within [target_date - window_days, target_date + window_days].
    Returns best scene stats dictionary (date, ndvi, ndwi, cloud_pct) or (None, error_message).
    """
    try:
        t_date = datetime.date.fromisoformat(target_date_str)
    except ValueError as e:
        return None, f"Invalid date format: {target_date_str}"

    cache_key = f"s2|{round(lat, 5)}|{round(lon, 5)}|{target_date_str}|{window_days}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Cache hit: S2 stats for (%.5f, %.5f) @ %s", lat, lon, target_date_str)
        return cached, None

    date_from = (t_date - datetime.timedelta(days=window_days)).isoformat() + "T00:00:00Z"
    date_to = (t_date + datetime.timedelta(days=window_days)).isoformat() + "T23:59:59Z"

    headers = {
        "Authorization": f"Bearer {auth.get_token()}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    payload = {
        "input": {
            "bounds": {
                "bbox": [lon - delta_deg, lat - delta_deg, lon + delta_deg, lat + delta_deg],
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                }
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "mosaickingOrder": "mostRecent"
                    }
                }
            ]
        },
        "aggregation": {
            "timeRange": {
                "from": date_from,
                "to": date_to
            },
            "aggregationInterval": {
                "of": "P1D"
            },
            "evalscript": EVALSCRIPT_S2,
            "resx": 0.0001,
            "resy": 0.0001
        }
    }

    def _do_post():
        return requests.post(CDSE_STATS_URL, headers=headers, json=payload, timeout=40)

    try:
        resp = request_with_backoff(_do_post, domain="copernicus")
        if resp.status_code != 200:
            return None, f"S2 Statistical API HTTP {resp.status_code}: {resp.text[:200]}"

        res_data = resp.json().get("data", [])
        if not res_data:
            return None, "No Sentinel-2 acquisitions in requested time window"

        # Parse available scenes
        scenes = []
        for item in res_data:
            interval = item.get("interval", {})
            from_str = interval.get("from", "")
            if not from_str:
                continue
            scene_date_str = from_str.split("T")[0]
            scene_date = datetime.date.fromisoformat(scene_date_str)

            outputs = item.get("outputs", {})
            cloud_stat = outputs.get("cloud", {}).get("bands", {}).get("B0", {}).get("stats", {})
            ndvi_stat = outputs.get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {})
            ndwi_stat = outputs.get("ndwi", {}).get("bands", {}).get("B0", {}).get("stats", {})

            # Check if scene has valid pixel samples
            sample_count = cloud_stat.get("sampleCount", 0)
            no_data_count = cloud_stat.get("noDataCount", 0)
            if sample_count - no_data_count <= 0:
                continue

            cloud_mean = cloud_stat.get("mean")
            ndvi_mean = ndvi_stat.get("mean")
            ndwi_mean = ndwi_stat.get("mean")

            if cloud_mean is None or ndvi_mean is None or ndwi_mean is None:
                continue

            cloud_pct = cloud_mean * 100.0
            day_diff = abs((scene_date - t_date).days)

            scenes.append({
                "date": scene_date_str,
                "day_diff": day_diff,
                "cloud_pct": round(cloud_pct, 2),
                "ndvi_mean": round(ndvi_mean, 4),
                "ndwi_mean": round(ndwi_mean, 4)
            })

        if not scenes:
            return None, "No valid Sentinel-2 pixels found in window"

        # Selection priority: scenes with cloud <= 50% sorted by distance to target date
        clear_scenes = [s for s in scenes if s["cloud_pct"] <= 50.0]
        if clear_scenes:
            clear_scenes.sort(key=lambda s: (s["day_diff"], s["cloud_pct"]))
            best = clear_scenes[0]
        else:
            # All scenes had > 50% cloud cover, return the least cloudy one closest to target date
            scenes.sort(key=lambda s: (s["cloud_pct"], s["day_diff"]))
            best = scenes[0]

        _cache_set(cache_key, best)
        return best, None

    except Exception as e:
        return None, f"S2 Fetch Exception: {str(e)}"


def fetch_sentinel1_stats(
    auth: CopernicusAuth,
    lat: float,
    lon: float,
    target_date_str: str,
    window_days: int = 7,
    delta_deg: float = 0.005
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Fetches Sentinel-1 GRD Statistical API (VV & VH in dB) within [target_date - window_days, target_date + window_days].
    Returns best scene stats (date, vv_db_mean, vh_db_mean) or (None, error_message).
    """
    try:
        t_date = datetime.date.fromisoformat(target_date_str)
    except ValueError as e:
        return None, f"Invalid date format: {target_date_str}"

    cache_key = f"s1|{round(lat, 5)}|{round(lon, 5)}|{target_date_str}|{window_days}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Cache hit: S1 stats for (%.5f, %.5f) @ %s", lat, lon, target_date_str)
        return cached, None

    date_from = (t_date - datetime.timedelta(days=window_days)).isoformat() + "T00:00:00Z"
    date_to = (t_date + datetime.timedelta(days=window_days)).isoformat() + "T23:59:59Z"

    headers = {
        "Authorization": f"Bearer {auth.get_token()}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    payload = {
        "input": {
            "bounds": {
                "bbox": [lon - delta_deg, lat - delta_deg, lon + delta_deg, lat + delta_deg],
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                }
            },
            "data": [
                {
                    "type": "sentinel-1-grd",
                    "dataFilter": {
                        "acquisitionMode": "IW",
                        "polarization": "DV"
                    }
                }
            ]
        },
        "aggregation": {
            "timeRange": {
                "from": date_from,
                "to": date_to
            },
            "aggregationInterval": {
                "of": "P1D"
            },
            "evalscript": EVALSCRIPT_S1,
            "resx": 0.0001,
            "resy": 0.0001
        }
    }

    def _do_post():
        return requests.post(CDSE_STATS_URL, headers=headers, json=payload, timeout=40)

    try:
        resp = request_with_backoff(_do_post, domain="copernicus")
        if resp.status_code != 200:
            return None, f"S1 Statistical API HTTP {resp.status_code}: {resp.text[:200]}"

        res_data = resp.json().get("data", [])
        if not res_data:
            return None, "No Sentinel-1 acquisitions in requested time window"

        scenes = []
        for item in res_data:
            interval = item.get("interval", {})
            from_str = interval.get("from", "")
            if not from_str:
                continue
            scene_date_str = from_str.split("T")[0]
            scene_date = datetime.date.fromisoformat(scene_date_str)

            outputs = item.get("outputs", {})
            vv_stat = outputs.get("vv_db", {}).get("bands", {}).get("B0", {}).get("stats", {})
            vh_stat = outputs.get("vh_db", {}).get("bands", {}).get("B0", {}).get("stats", {})

            sample_count = vv_stat.get("sampleCount", 0)
            no_data_count = vv_stat.get("noDataCount", 0)
            if sample_count - no_data_count <= 0:
                continue

            vv_mean = vv_stat.get("mean")
            vh_mean = vh_stat.get("mean")

            if vv_mean is None or vh_mean is None:
                continue

            day_diff = abs((scene_date - t_date).days)
            scenes.append({
                "date": scene_date_str,
                "day_diff": day_diff,
                "vv_db_mean": round(vv_mean, 2),
                "vh_db_mean": round(vh_mean, 2)
            })

        if not scenes:
            return None, "No valid Sentinel-1 backscatter pixels found in window"

        # Pick the S1 scene closest to target date
        scenes.sort(key=lambda s: s["day_diff"])
        best = scenes[0]
        _cache_set(cache_key, best)
        return best, None

    except Exception as e:
        return None, f"S1 Fetch Exception: {str(e)}"


def fetch_rainfall_data(
    lat: float,
    lon: float,
    sowing_date_str: str,
    loss_start_str: str,
    loss_end_str: str
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Fetches real actual rainfall (mm) and 30-year long-term normal rainfall (mm)
    via Open-Meteo High-Resolution Gridded Reanalysis for the exact coordinates and periods.
    """
    try:
        d_sowing = datetime.date.fromisoformat(sowing_date_str)
        d_loss_start = datetime.date.fromisoformat(loss_start_str)
        d_loss_end = datetime.date.fromisoformat(loss_end_str)
    except ValueError as e:
        return {}, f"Invalid rainfall date format: {e}"

    if d_sowing > d_loss_end:
        return {}, f"Sowing date {sowing_date_str} is after loss end date {loss_end_str}"

    cache_key = f"rain|{round(lat, 5)}|{round(lon, 5)}|{sowing_date_str}|{loss_start_str}|{loss_end_str}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Cache hit: rainfall data for (%.5f, %.5f) %s..%s", lat, lon, sowing_date_str, loss_end_str)
        return cached, None

    results = {
        "actual_rainfall_total_mm": None,
        "actual_rainfall_loss_window_mm": None,
        "normal_rainfall_total_mm": None,
        "normal_rainfall_loss_window_mm": None,
        "rainfall_deviation_pct": None
    }
    errors = []

    # 1. Fetch Actual Daily Rainfall
    url_actual = (
        f"{OPEN_METEO_ARCHIVE_URL}?latitude={lat}&longitude={lon}"
        f"&start_date={sowing_date_str}&end_date={loss_end_str}"
        f"&daily=precipitation_sum&timezone=Asia/Kolkata"
    )

    try:
        def _get_actual():
            return requests.get(url_actual, timeout=25)

        # Exponential backoff retry: 2s, 4s, 8s; max 3 retries (per spec for Open-Meteo 429 errors)
        r_act = request_with_backoff(_get_actual, domain="open-meteo-archive", max_retries=3, base_wait=2.0)
        if r_act.status_code == 200:
            act_json = r_act.json()
            daily_times = act_json.get("daily", {}).get("time", [])
            daily_precip = act_json.get("daily", {}).get("precipitation_sum", [])

            # Total sowing to loss_end
            valid_precips = [p for p in daily_precip if p is not None]
            if valid_precips:
                results["actual_rainfall_total_mm"] = round(sum(valid_precips), 2)

            # Loss window sum (loss_start to loss_end)
            loss_precips = []
            for t_str, p in zip(daily_times, daily_precip):
                if p is not None and loss_start_str <= t_str <= loss_end_str:
                    loss_precips.append(p)
            if loss_precips:
                results["actual_rainfall_loss_window_mm"] = round(sum(loss_precips), 2)
        else:
            errors.append(f"Actual rainfall HTTP {r_act.status_code}")
    except Exception as e:
        errors.append(f"Actual rainfall error: {str(e)}")

    # 2. Fetch 30-Year Climate Baseline (1991-2020) for Long-Term Normal Comparison
    url_climate = (
        f"{OPEN_METEO_CLIMATE_URL}?latitude={lat}&longitude={lon}"
        f"&start_date=1991-01-01&end_date=2020-12-31"
        f"&models=EC_Earth3P_HR&daily=precipitation_sum"
    )

    try:
        def _get_climate():
            return requests.get(url_climate, timeout=35)

        # Exponential backoff retry: 2s, 4s, 8s; max 3 retries (per spec for Open-Meteo 429 errors)
        r_clim = request_with_backoff(_get_climate, domain="open-meteo-climate", max_retries=3, base_wait=2.0)
        if r_clim.status_code == 200:
            clim_json = r_clim.json()
            c_times = clim_json.get("daily", {}).get("time", [])
            c_precip = clim_json.get("daily", {}).get("precipitation_sum", [])

            total_normal_sums = []
            loss_normal_sums = []

            # Calculate normal over 30 years for matching day-of-year windows
            for yr in range(1991, 2021):
                try:
                    # Construct matching calendar dates for that year
                    yr_sowing = datetime.date(yr, d_sowing.month, d_sowing.day).isoformat()
                    yr_loss_start = datetime.date(yr, d_loss_start.month, d_loss_start.day).isoformat()
                    yr_loss_end = datetime.date(yr, d_loss_end.month, d_loss_end.day).isoformat()

                    idx_s = c_times.index(yr_sowing)
                    idx_e = c_times.index(yr_loss_end)
                    yr_total_p = [p for p in c_precip[idx_s:idx_e+1] if p is not None]
                    if yr_total_p:
                        total_normal_sums.append(sum(yr_total_p))

                    idx_ls = c_times.index(yr_loss_start)
                    yr_loss_p = [p for p in c_precip[idx_ls:idx_e+1] if p is not None]
                    if yr_loss_p:
                        loss_normal_sums.append(sum(yr_loss_p))
                except (ValueError, KeyError):
                    continue

            if total_normal_sums:
                avg_norm_total = sum(total_normal_sums) / len(total_normal_sums)
                results["normal_rainfall_total_mm"] = round(avg_norm_total, 2)

            if loss_normal_sums:
                avg_norm_loss = sum(loss_normal_sums) / len(loss_normal_sums)
                results["normal_rainfall_loss_window_mm"] = round(avg_norm_loss, 2)

            # Calculate rainfall deviation %: (actual - normal) / normal * 100
            if results["actual_rainfall_total_mm"] is not None and results["normal_rainfall_total_mm"] is not None:
                norm_val = results["normal_rainfall_total_mm"]
                if norm_val > 0:
                    dev_pct = ((results["actual_rainfall_total_mm"] - norm_val) / norm_val) * 100.0
                    results["rainfall_deviation_pct"] = round(dev_pct, 2)
        else:
            errors.append(f"Climate normal HTTP {r_clim.status_code}")
    except Exception as e:
        errors.append(f"Climate normal error: {str(e)}")

    err_str = "; ".join(errors) if errors else None
    if err_str is None:
        # Only cache a fully clean result - a partial one should be retried next run.
        _cache_set(cache_key, results)
    return results, err_str


def process_village_row(
    row: pd.Series,
    auth: CopernicusAuth,
    window_days: int = 7,
    cloud_threshold: float = 50.0
) -> Dict[str, Any]:
    """Processes a single row from input CSV, querying satellite and rainfall APIs."""
    village_name = str(row.get("village_name", "")).strip()
    lat = float(row["latitude"])
    lon = float(row["longitude"])
    sowing_date = str(row["sowing_date"]).strip()
    loss_start = str(row["loss_window_start"]).strip()
    loss_end = str(row["loss_window_end"]).strip()

    logger.info("------------------------------------------------------------")
    logger.info("Processing village: %s (Lat: %.4f, Lon: %.4f)", village_name, lat, lon)
    logger.info("Dates - Sowing: %s | Loss Start: %s | Loss End: %s", sowing_date, loss_start, loss_end)

    out_record = {
        "village_name": village_name,
        "latitude": lat,
        "longitude": lon,
        "sowing_date": sowing_date,
        "loss_window_start": loss_start,
        "loss_window_end": loss_end,
        # Pre-loss Sentinel-2
        "s2_pre_date": None,
        "s2_pre_ndvi_mean": None,
        "s2_pre_ndwi_mean": None,
        "s2_pre_cloud_pct": None,
        "s1_pre_fallback_used": False,
        "s1_pre_date": None,
        "s1_pre_vv_db_mean": None,
        "s1_pre_vh_db_mean": None,
        # Post-loss Sentinel-2
        "s2_post_date": None,
        "s2_post_ndvi_mean": None,
        "s2_post_ndwi_mean": None,
        "s2_post_cloud_pct": None,
        "s1_post_fallback_used": False,
        "s1_post_date": None,
        "s1_post_vv_db_mean": None,
        "s1_post_vh_db_mean": None,
        # Rainfall signals
        "actual_rainfall_total_mm": None,
        "actual_rainfall_loss_window_mm": None,
        "normal_rainfall_total_mm": None,
        "normal_rainfall_loss_window_mm": None,
        "rainfall_deviation_pct": None,
        # NDVI reliability flag: False when cloud contamination makes NDVI untrustworthy
        "ndvi_reliable": True,
        # Status & logs
        "fetch_status": "SUCCESS",
        "error_log": ""
    }

    errors = []

    # 1. Fetch Pre-Loss Satellite (near sowing_date)
    logger.info("Querying Pre-loss Sentinel-2 (near %s)...", sowing_date)
    s2_pre, s2_pre_err = fetch_sentinel2_stats(auth, lat, lon, sowing_date, window_days)
    if s2_pre_err:
        errors.append(f"Pre-loss S2: {s2_pre_err}")

    if s2_pre:
        out_record["s2_pre_date"] = s2_pre["date"]
        out_record["s2_pre_ndvi_mean"] = s2_pre["ndvi_mean"]
        out_record["s2_pre_ndwi_mean"] = s2_pre["ndwi_mean"]
        out_record["s2_pre_cloud_pct"] = s2_pre["cloud_pct"]
        logger.info("Pre-loss S2 found: Date=%s, NDVI=%.4f, NDWI=%.4f, Cloud=%.1f%%",
                    s2_pre["date"], s2_pre["ndvi_mean"], s2_pre["ndwi_mean"], s2_pre["cloud_pct"])

    # Check if S1 Fallback is required for Pre-loss (>50% cloud or no S2 scene)
    trigger_s1_pre = (s2_pre is None) or (s2_pre["cloud_pct"] > cloud_threshold)
    if trigger_s1_pre:
        reason = "Cloud cover > 50%" if s2_pre else "No S2 scene available"
        logger.info("Triggering Sentinel-1 fallback for Pre-loss (%s)...", reason)
        out_record["s1_pre_fallback_used"] = True
        s1_pre, s1_pre_err = fetch_sentinel1_stats(auth, lat, lon, sowing_date, window_days)
        # Progressive window widening: try ±3, ±6, ±9 days before giving up
        if not s1_pre and s1_pre_err and "No Sentinel-1 acquisitions" in s1_pre_err:
            for extra in [3, 6, 9]:
                wider = window_days + extra
                logger.info("No S1 pre-loss with ±%d days. Widening to ±%d days...", window_days + extra - 3, wider)
                s1_pre, s1_pre_err = fetch_sentinel1_stats(auth, lat, lon, sowing_date, wider)
                if s1_pre:
                    logger.info("S1 pre-loss found after widening to ±%d days.", wider)
                    break
            if not s1_pre:
                logger.warning("S1 pre-loss: STILL NO ACQUISITIONS after widening to ±%d days. Giving up.", window_days + 9)
        if s1_pre:
            out_record["s1_pre_date"] = s1_pre["date"]
            out_record["s1_pre_vv_db_mean"] = s1_pre["vv_db_mean"]
            out_record["s1_pre_vh_db_mean"] = s1_pre["vh_db_mean"]
            logger.info("Pre-loss S1 found: Date=%s, VV=%.2f dB, VH=%.2f dB",
                        s1_pre["date"], s1_pre["vv_db_mean"], s1_pre["vh_db_mean"])
        else:
            if s1_pre_err:
                errors.append(f"Pre-loss S1 Fallback: {s1_pre_err}")

    # 2. Fetch Post-Loss Satellite (near loss_window_end)
    logger.info("Querying Post-loss Sentinel-2 (near %s)...", loss_end)
    s2_post, s2_post_err = fetch_sentinel2_stats(auth, lat, lon, loss_end, window_days)
    if s2_post_err:
        errors.append(f"Post-loss S2: {s2_post_err}")

    if s2_post:
        out_record["s2_post_date"] = s2_post["date"]
        out_record["s2_post_ndvi_mean"] = s2_post["ndvi_mean"]
        out_record["s2_post_ndwi_mean"] = s2_post["ndwi_mean"]
        out_record["s2_post_cloud_pct"] = s2_post["cloud_pct"]
        logger.info("Post-loss S2 found: Date=%s, NDVI=%.4f, NDWI=%.4f, Cloud=%.1f%%",
                    s2_post["date"], s2_post["ndvi_mean"], s2_post["ndwi_mean"], s2_post["cloud_pct"])

    # Check if S1 Fallback is required for Post-loss (>50% cloud or no S2 scene)
    trigger_s1_post = (s2_post is None) or (s2_post["cloud_pct"] > cloud_threshold)
    if trigger_s1_post:
        reason = "Cloud cover > 50%" if s2_post else "No S2 scene available"
        logger.info("Triggering Sentinel-1 fallback for Post-loss (%s)...", reason)
        out_record["s1_post_fallback_used"] = True
        s1_post, s1_post_err = fetch_sentinel1_stats(auth, lat, lon, loss_end, window_days)
        # Progressive window widening: try ±3, ±6, ±9 days before giving up
        if not s1_post and s1_post_err and "No Sentinel-1 acquisitions" in s1_post_err:
            for extra in [3, 6, 9]:
                wider = window_days + extra
                logger.info("No S1 post-loss with ±%d days. Widening to ±%d days...", window_days + extra - 3, wider)
                s1_post, s1_post_err = fetch_sentinel1_stats(auth, lat, lon, loss_end, wider)
                if s1_post:
                    logger.info("S1 post-loss found after widening to ±%d days.", wider)
                    break
            if not s1_post:
                logger.warning("S1 post-loss: STILL NO ACQUISITIONS after widening to ±%d days. Giving up.", window_days + 9)
        if s1_post:
            out_record["s1_post_date"] = s1_post["date"]
            out_record["s1_post_vv_db_mean"] = s1_post["vv_db_mean"]
            out_record["s1_post_vh_db_mean"] = s1_post["vh_db_mean"]
            logger.info("Post-loss S1 found: Date=%s, VV=%.2f dB, VH=%.2f dB",
                        s1_post["date"], s1_post["vv_db_mean"], s1_post["vh_db_mean"])
        else:
            if s1_post_err:
                errors.append(f"Post-loss S1 Fallback: {s1_post_err}")

    # --- Compute NDVI reliability flag ---
    # NDVI is unreliable (cloud-contaminated) when EITHER the pre-loss OR post-loss
    # Sentinel-2 scene has >50% cloud cover, OR when no S2 scene was found at all.
    # When ndvi_reliable=False, downstream consumers (fraud_classifier, pipeline)
    # must NOT use NDVI as evidence — they should fall back to SAR VV/VH delta.
    pre_cloud = out_record.get("s2_pre_cloud_pct")
    post_cloud = out_record.get("s2_post_cloud_pct")
    out_record["ndvi_reliable"] = (
        pre_cloud is not None and post_cloud is not None
        and pre_cloud <= cloud_threshold and post_cloud <= cloud_threshold
    )
    if not out_record["ndvi_reliable"]:
        logger.info("NDVI marked UNRELIABLE: pre_cloud=%s%%, post_cloud=%s%% (threshold=%.0f%%)",
                     pre_cloud, post_cloud, cloud_threshold)

    # 3. Fetch Rainfall Data (Actual & Normal)
    logger.info("Querying Rainfall Data (%s to %s)...", sowing_date, loss_end)
    rain_data, rain_err = fetch_rainfall_data(lat, lon, sowing_date, loss_start, loss_end)
    if rain_data:
        out_record.update(rain_data)
        logger.info("Rainfall Fetched: Actual Total=%.1f mm, Normal Total=%.1f mm, Deviation=%s%%",
                    out_record["actual_rainfall_total_mm"] or 0,
                    out_record["normal_rainfall_total_mm"] or 0,
                    out_record["rainfall_deviation_pct"])
    if rain_err:
        errors.append(f"Rainfall: {rain_err}")

    # Set overall status
    if errors:
        out_record["error_log"] = " | ".join(errors)
        has_sat = (out_record["s2_pre_ndvi_mean"] is not None or out_record["s1_pre_vv_db_mean"] is not None)
        has_rain = (out_record["actual_rainfall_total_mm"] is not None)
        if has_sat or has_rain:
            out_record["fetch_status"] = "PARTIAL"
        else:
            out_record["fetch_status"] = "FAILED"
    else:
        out_record["fetch_status"] = "SUCCESS"

    return out_record


def main():
    parser = argparse.ArgumentParser(
        description="SatyaFasal - Fetch REAL satellite (S2/S1) and rainfall (actual & normal) data."
    )
    parser.add_argument(
        "--input", "-i",
        default="data/raw/karnataka_villages.csv",
        help="Path to input CSV containing (village_name, latitude, longitude, sowing_date, loss_window_start, loss_window_end)"
    )
    parser.add_argument(
        "--output", "-o",
        default="data/processed/satyafasal_satellite_rainfall_output.csv",
        help="Path to output CSV for raw fetched data"
    )
    parser.add_argument(
        "--env", "-e",
        default=".env",
        help="Path to .env file containing COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET"
    )
    parser.add_argument(
        "--window-days", "-w",
        type=int,
        default=7,
        help="Search window radius (days) around target date for satellite scenes (default: 7)"
    )
    parser.add_argument(
        "--cloud-threshold", "-c",
        type=float,
        default=50.0,
        help="Cloud cover percentage threshold to trigger Sentinel-1 fallback (default: 50.0)"
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=0.5,
        help="Delay in seconds between processing rows to respect rate limits (default: 0.5s)"
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Ignore any existing output file and re-fetch every row from scratch "
             "(by default, rows already marked SUCCESS in an existing --output file are skipped)"
    )
    args = parser.parse_args()

    # Load credentials
    env_vars = dotenv_values(args.env)
    client_id = env_vars.get("COPERNICUS_CLIENT_ID") or os.environ.get("COPERNICUS_CLIENT_ID")
    client_secret = env_vars.get("COPERNICUS_CLIENT_SECRET") or os.environ.get("COPERNICUS_CLIENT_SECRET")

    if not client_id or not client_secret:
        logger.error("Missing COPERNICUS_CLIENT_ID or COPERNICUS_CLIENT_SECRET in .env or environment.")
        sys.exit(1)

    auth = CopernicusAuth(client_id, client_secret)
    _load_cache()

    # Validate input file
    if not os.path.exists(args.input):
        logger.error("Input CSV file not found: %s", args.input)
        sys.exit(1)

    try:
        df_in = pd.read_csv(args.input)
    except Exception as e:
        logger.error("Failed to read input CSV: %s", e)
        sys.exit(1)

    required_cols = {"village_name", "latitude", "longitude", "sowing_date", "loss_window_start", "loss_window_end"}
    missing_cols = required_cols - set(df_in.columns)
    if missing_cols:
        logger.error("Input CSV is missing required columns: %s", missing_cols)
        sys.exit(1)

    total_rows = len(df_in)

    # --- Resume support -------------------------------------------------
    # Rows already SUCCESS in a prior run are kept as-is and skipped, so a
    # re-run only spends API calls on the rows that were PARTIAL/FAILED.
    prior_success: Dict[str, Dict[str, Any]] = {}
    if not args.no_resume and os.path.exists(args.output):
        try:
            df_prior = pd.read_csv(args.output)
            if "village_name" in df_prior.columns and "fetch_status" in df_prior.columns:
                df_prior_success = df_prior[df_prior["fetch_status"] == "SUCCESS"]
                prior_success = {
                    row["village_name"]: row.to_dict()
                    for _, row in df_prior_success.iterrows()
                }
                logger.info("Resume mode: found %d already-SUCCESS rows in existing %s, will skip re-fetching them.",
                            len(prior_success), args.output)
        except Exception as e:
            logger.warning("Could not read existing output for resume (%s). Proceeding without resume.", e)

    rows_to_fetch = df_in[~df_in["village_name"].isin(prior_success.keys())] if prior_success else df_in
    logger.info("Starting satellite and rainfall data extraction for %d/%d locations (%d skipped via resume)...",
                len(rows_to_fetch), total_rows, total_rows - len(rows_to_fetch))
    start_time = time.time()

    results = list(prior_success.values())
    success_count = len(prior_success)
    partial_count = 0
    failed_count = 0
    s1_pre_fallback_count = sum(1 for r in prior_success.values() if r.get("s1_pre_fallback_used"))
    s1_post_fallback_count = sum(1 for r in prior_success.values() if r.get("s1_post_fallback_used"))

    # Ensure output directory exists up front so checkpoint saves can land immediately
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    def _checkpoint():
        """Write current results to --output after every row, so a crash, a
        Ctrl+C, or a dead network connection partway through never loses
        progress - the next run just resumes from here."""
        pd.DataFrame(results).to_csv(args.output, index=False)

    fetch_rows = list(rows_to_fetch.iterrows())
    n_fetch = len(fetch_rows)
    interrupted = False
    try:
        for i, (idx, row) in enumerate(fetch_rows):
            logger.info("\n>>> Processing [%d/%d] %s", i + 1, n_fetch, row.get("village_name", ""))
            try:
                record = process_village_row(
                    row=row,
                    auth=auth,
                    window_days=args.window_days,
                    cloud_threshold=args.cloud_threshold
                )
            except Exception as e:
                # A single malformed row (bad date, bad coordinate, unexpected
                # API shape, etc.) should never take down the other 99 rows.
                logger.error("Row %s raised an unhandled error: %s. Marking FAILED and continuing.",
                             row.get("village_name", "?"), e)
                record = {
                    "village_name": str(row.get("village_name", "")).strip(),
                    "latitude": row.get("latitude"),
                    "longitude": row.get("longitude"),
                    "sowing_date": row.get("sowing_date"),
                    "loss_window_start": row.get("loss_window_start"),
                    "loss_window_end": row.get("loss_window_end"),
                    "s1_pre_fallback_used": False,
                    "s1_post_fallback_used": False,
                    "fetch_status": "FAILED",
                    "error_log": f"Unhandled exception: {e}"
                }

            results.append(record)

            if record["fetch_status"] == "SUCCESS":
                success_count += 1
            elif record["fetch_status"] == "PARTIAL":
                partial_count += 1
            else:
                failed_count += 1

            if record.get("s1_pre_fallback_used"):
                s1_pre_fallback_count += 1
            if record.get("s1_post_fallback_used"):
                s1_post_fallback_count += 1

            _checkpoint()

            # Rate-limiting pacing delay
            if i < n_fetch - 1:
                time.sleep(args.delay)
    except KeyboardInterrupt:
        interrupted = True
        logger.warning("Interrupted by user - progress through this point is already saved to %s. "
                        "Just re-run the same command to resume.", args.output)

    # Final save (checkpoint already covers this, but be explicit)
    _checkpoint()
    elapsed_time = time.time() - start_time
    if interrupted:
        print(f"\nStopped early - {len(results)}/{total_rows} rows saved to {os.path.abspath(args.output)}. "
              f"Re-run the same command to pick up where you left off.\n")
        return

    # Summary Report
    print("\n" + "=" * 65)
    print("                SATYAFASAL DATA FETCH SUMMARY")
    print("=" * 65)
    print(f"Total Rows Processed         : {total_rows}")
    print(f"Fully Successful (SUCCESS)   : {success_count}")
    print(f"Partial Fetches  (PARTIAL)   : {partial_count}")
    print(f"Failed Fetches   (FAILED)    : {failed_count}")
    print(f"Sentinel-1 Pre-loss Fallbacks: {s1_pre_fallback_count}")
    print(f"Sentinel-1 Post-loss Fallback: {s1_post_fallback_count}")
    print(f"Total Execution Time         : {elapsed_time:.2f} seconds")
    print(f"Output Saved To              : {os.path.abspath(args.output)}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
