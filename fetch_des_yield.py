#!/usr/bin/env python3
"""
SatyaFasal - Step 4: Fetch & Compute DES Karnataka Crop Yield Data (fetch_des_yield.py)

Fetches official Directorate of Economics and Statistics (DES) / Crop Cutting Experiment (CCE)
crop yield statistics for Karnataka districts from data.gov.in, computes a historical baseline
average yield per (district, taluk, crop, season) group, and calculates percentage yield loss
against the most recent season available in the fetched data.

Formula:
  yield_loss_pct = (historical_avg_yield - current_yield) / historical_avg_yield * 100

Target Schema Output (data/processed/des_yield_loss.csv):
  district              (String)
  taluk                 (String, blank if not present in the source dataset)
  crop_name             (String)
  season                (String, blank if not present in the source dataset)
  year                  (Integer)  -- the "current" year used for the loss calculation
  years_in_baseline     (Integer)  -- how many prior years fed historical_avg_yield
  historical_avg_yield  (Float: kg/ha, blank if fewer than 2 years of prior data exist)
  current_yield         (Float: kg/ha)
  yield_loss_pct        (Float: %, blank whenever historical_avg_yield is blank)

STRICTLY REAL DATA ONLY. This script makes live HTTP requests to api.data.gov.in.
There is no hardcoded fallback record list. If the API is unreachable, the resource ID is
wrong, or a district/taluk has no matching record, the corresponding cells are left blank
and the gap is logged -- never filled with an invented number.

You must supply a real data.gov.in resource ID for a Karnataka (or all-India, filterable to
Karnataka) crop yield / Crop Cutting Experiment dataset via --resource-id. Find it by
searching the data.gov.in catalog UI (e.g. "District-wise Season-wise Crop Production
Statistics" or "Crop Cutting Experiment Karnataka") and copying the resource's UUID from its
page URL or its API tab. This script does not guess or invent that ID.
"""

import os
import sys
import time
import math
import logging
import argparse
from typing import Dict, Any, List, Optional, Tuple

import requests
import pandas as pd
from dotenv import dotenv_values

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("des_yield_fetch.log", mode="a", encoding="utf-8")
    ]
)
logger = logging.getLogger("DESYieldFetcher")

DATA_GOV_BASE_URL = "https://api.data.gov.in/resource"

# Candidate column names we look for in whatever schema the real API returns.
# Populated only after Phase A schema discovery inspects the actual response --
# nothing here is assumed to be correct until it's matched against real column names.
DISTRICT_CANDIDATES = ["district", "district_name", "dist_name", "dtname"]
TALUK_CANDIDATES = ["taluk", "taluka", "tehsil", "block", "sub_district"]
CROP_CANDIDATES = ["crop", "crop_name", "cropname"]
SEASON_CANDIDATES = ["season", "crop_season"]
YEAR_CANDIDATES = ["year", "crop_year", "fiscal_year", "agri_year"]
YIELD_CANDIDATES = ["yield", "yield_kg_ha", "yield_kg_per_ha", "productivity", "yield_qtl_ha"]
STATE_CANDIDATES = ["state", "state_name", "states_union_territory", "state_ut", "stname", "states"]


def get_api_key(env_path: str = ".env") -> str:
    """Load DATA_GOV_API_KEY from .env or system environment."""
    env_vars = dotenv_values(env_path)
    api_key = env_vars.get("DATA_GOV_API_KEY") or os.environ.get("DATA_GOV_API_KEY")
    if not api_key:
        logger.error("DATA_GOV_API_KEY not found in %s or environment variables.", env_path)
        sys.exit(1)
    return api_key.strip()


def query_datagov_resource(
    resource_id: str,
    api_key: str,
    limit: int = 100,
    offset: int = 0,
    filters: Optional[Dict[str, str]] = None,
    max_retries: int = 3,
    backoff_factor: float = 2.0,
    timeout: int = 25
) -> Optional[Dict[str, Any]]:
    """
    Execute a real HTTP GET request to the data.gov.in resource API with exponential backoff.
    Returns None (never fabricated data) if every retry fails.
    """
    url = f"{DATA_GOV_BASE_URL}/{resource_id}"
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "offset": offset
    }
    if filters:
        for k, v in filters.items():
            params[f"filters[{k}]"] = v

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Requesting resource=%s offset=%d limit=%d (attempt %d/%d)...",
                        resource_id, offset, limit, attempt, max_retries)
            response = requests.get(url, params=params, headers=headers, timeout=timeout)

            if response.status_code == 200:
                try:
                    return response.json()
                except Exception as json_err:
                    logger.warning("Failed to parse JSON response: %s", json_err)
            elif response.status_code == 429:
                wait_time = backoff_factor ** attempt + 1.0
                logger.warning("Rate limited (HTTP 429). Backing off for %.1f seconds...", wait_time)
                time.sleep(wait_time)
            else:
                logger.warning("API returned HTTP %d: %s", response.status_code, response.text[:200])
                time.sleep(backoff_factor ** attempt)

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as req_err:
            wait_time = backoff_factor ** attempt
            logger.warning("Network timeout/error (%s). Retrying in %.1f seconds...", type(req_err).__name__, wait_time)
            time.sleep(wait_time)
        except Exception as e:
            logger.error("Unexpected error during API call: %s", e)
            break

    return None


def _match_column(column_names: List[str], candidates: List[str]) -> Optional[str]:
    lower_map = {c.lower(): c for c in column_names}
    for cand in candidates:
        if cand in lower_map:
            return lower_map[cand]
    # loose substring match as a second pass
    for col in column_names:
        for cand in candidates:
            if cand in col.lower():
                return col
    return None


def phase_a_schema_discovery(resource_id: str, api_key: str) -> Tuple[List[str], Dict[str, Optional[str]]]:
    """
    Phase A: Query the dataset with no filter, print the real column names the API
    actually returned, and heuristically map them to the fields this script needs.
    """
    print("\n" + "=" * 70)
    print(f"  PHASE A: SCHEMA DISCOVERY (Resource ID: {resource_id})")
    print("=" * 70)
    logger.info("Executing Phase A: Querying data.gov.in with NO filters...")

    data = query_datagov_resource(resource_id=resource_id, api_key=api_key, limit=5, offset=0)

    if not data:
        logger.error("Phase A failed: Could not retrieve sample records from resource %s. "
                      "No fallback data will be used -- verify the resource ID on data.gov.in.",
                      resource_id)
        return [], {}

    records = data.get("records", [])
    total_records = data.get("total", "Unknown")
    title = data.get("title", "Untitled Dataset")

    print(f"\nDataset Title : {title}")
    print(f"Total Records : {total_records}")
    print(f"Sample Count  : {len(records)}")

    if not records:
        logger.warning("No records returned in sample query for resource %s.", resource_id)
        fields = [f.get("name") or f.get("id") for f in data.get("field", [])]
        print(f"Discovered Fields from metadata: {fields}")
        return fields, {}

    sample_record = records[0]
    column_names = list(sample_record.keys())

    print("\n--- EXACT COLUMN NAMES DISCOVERED ---")
    for idx, col in enumerate(column_names, start=1):
        sample_val = sample_record.get(col, "")
        print(f"  [{idx:2d}] {col} (Example: '{sample_val}')")
    print("-------------------------------------\n")

    col_map = {
        "state": _match_column(column_names, STATE_CANDIDATES),
        "district": _match_column(column_names, DISTRICT_CANDIDATES),
        "taluk": _match_column(column_names, TALUK_CANDIDATES),
        "crop": _match_column(column_names, CROP_CANDIDATES),
        "season": _match_column(column_names, SEASON_CANDIDATES),
        "year": _match_column(column_names, YEAR_CANDIDATES),
        "yield": _match_column(column_names, YIELD_CANDIDATES),
    }

    print("--- FIELD MAPPING (auto-detected, verify against the columns above) ---")
    for logical_name, actual_col in col_map.items():
        status = actual_col if actual_col else "NOT FOUND"
        print(f"  {logical_name:10s} -> {status}")
    print("-------------------------------------\n")

    missing_required = [k for k in ("district", "crop", "year", "yield") if not col_map.get(k)]
    if missing_required:
        logger.error(
            "Could not auto-detect required column(s) %s from this resource's schema. "
            "This dataset may not be the right one, or its columns need to be added to the "
            "candidate lists (DISTRICT_CANDIDATES / CROP_CANDIDATES / etc.) at the top of this "
            "script. No data will be fabricated to compensate.",
            missing_required
        )

    return column_names, col_map


def phase_b_fetch_karnataka_records(
    resource_id: str,
    api_key: str,
    col_map: Dict[str, Optional[str]],
    page_size: int = 100,
    delay_between_pages: float = 0.5
) -> pd.DataFrame:
    """
    Phase B: Paginate through the real API, keep only rows whose state column says
    Karnataka (if a state column exists -- some resources are already Karnataka-only
    and won't have one), and return the raw rows as fetched.
    """
    print("\n" + "=" * 70)
    print("  PHASE B: KARNATAKA YIELD RECORD EXTRACTION & PAGINATION")
    print("=" * 70)

    state_col = col_map.get("state")
    filters = {state_col: "KARNATAKA"} if state_col else None

    initial_data = query_datagov_resource(
        resource_id=resource_id, api_key=api_key, limit=page_size, offset=0, filters=filters
    )

    all_records: List[Dict[str, Any]] = []
    total_pages = 0
    failed_pages = 0
    total_fetched = 0

    if initial_data and "records" in initial_data:
        total_available = int(initial_data.get("total", 0))
        records = initial_data.get("records", [])
        total_pages = math.ceil(total_available / page_size) if total_available > 0 else 1

        logger.info("Total available records matching query: %d (Estimated Pages: %d)",
                     total_available, total_pages)

        def _keep(r: Dict[str, Any]) -> bool:
            if not state_col:
                return True
            return str(r.get(state_col, "")).strip().upper() == "KARNATAKA"

        all_records.extend([r for r in records if _keep(r)])
        total_fetched += len(records)
        print(f"Page [1/{total_pages}] Fetched: {len(records)} (Karnataka matched: {len(all_records)})")

        for page_idx in range(2, total_pages + 1):
            offset = (page_idx - 1) * page_size
            time.sleep(delay_between_pages)
            page_data = query_datagov_resource(
                resource_id=resource_id, api_key=api_key, limit=page_size, offset=offset, filters=filters
            )
            if page_data and "records" in page_data:
                page_records = page_data.get("records", [])
                all_records.extend([r for r in page_records if _keep(r)])
                total_fetched += len(page_records)
                print(f"Page [{page_idx}/{total_pages}] Fetched: {len(page_records)} "
                      f"(Total Karnataka: {len(all_records)})")
            else:
                failed_pages += 1
                logger.warning("Failed to fetch page %d (offset %d)", page_idx, offset)
    else:
        logger.error("Failed initial fetch for resource %s -- returning empty result, no fallback data used.",
                      resource_id)
        failed_pages += 1

    print(f"\nTotal Pages Queried : {total_pages}")
    print(f"Failed Pages        : {failed_pages}")
    print(f"Total Raw Fetched   : {total_fetched}")
    print(f"Total Karnataka Rows: {len(all_records)}\n")

    return pd.DataFrame(all_records)


def compute_yield_loss_from_real_data(
    df_raw: pd.DataFrame,
    col_map: Dict[str, Optional[str]],
    output_path: str,
    state_baseline_csv: Optional[str] = None
) -> pd.DataFrame:
    """
    Groups real fetched rows by (district, taluk[if present], crop, season[if present]),
    treats the single most recent year in each group as 'current' and the mean of every
    earlier year in that same group as the historical baseline.

    A group with only one year of data gets historical_avg_yield left blank -- there is
    no baseline to compare against, and no value is invented to fill it.
    """
    required = ["district", "crop", "year", "yield"]
    if df_raw.empty or any(not col_map.get(k) for k in required):
        logger.error("Cannot compute yield loss: no usable real data was fetched, or required "
                      "columns weren't found. Writing an empty output file -- no fabricated rows.")
        df_empty = pd.DataFrame(columns=[
            "district", "taluk", "crop_name", "season", "year", "years_in_baseline",
            "historical_avg_yield", "current_yield", "yield_loss_pct"
        ])
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
        df_empty.to_csv(output_path, index=False, encoding="utf-8")
        return df_empty

    d_col, t_col, c_col, s_col, y_col, yld_col = (
        col_map["district"], col_map.get("taluk"), col_map["crop"],
        col_map.get("season"), col_map["year"], col_map["yield"]
    )

    state_baselines = {}
    if state_baseline_csv and os.path.exists(state_baseline_csv):
        try:
            sb_df = pd.read_csv(state_baseline_csv)
            for _, row in sb_df.iterrows():
                yields = []
                for y in range(2019, 2024):
                    col = f"Yield-{y}-{str(y+1)[2:]}"
                    if col in row and pd.notna(row[col]) and str(row[col]).strip() != "":
                        try:
                            yields.append(float(row[col]))
                        except ValueError:
                            pass
                if yields:
                    c = str(row.get("Crop", "")).strip().lower()
                    s = str(row.get("Season", "")).strip().lower()
                    if s != "total":
                        state_baselines[(c, s)] = sum(yields) / len(yields)
            logger.info("Loaded %d crop-season state baselines from %s", len(state_baselines), state_baseline_csv)
        except Exception as e:
            logger.warning("Could not read state baseline CSV: %s", e)

    work = df_raw.copy()
    work["_district"] = work[d_col].astype(str).str.strip()
    work["_taluk"] = work[t_col].astype(str).str.strip() if t_col else ""
    work["_crop"] = work[c_col].astype(str).str.strip()
    work["_season"] = work[s_col].astype(str).str.strip() if s_col else ""
    work["_year"] = pd.to_numeric(work[y_col], errors="coerce")
    work["_yield"] = pd.to_numeric(work[yld_col], errors="coerce")

    before_drop = len(work)
    work = work.dropna(subset=["_district", "_crop", "_year", "_yield"])
    dropped = before_drop - len(work)
    if dropped:
        logger.warning("Dropped %d real rows with missing/unparseable district, crop, year, or yield.", dropped)

    group_cols = ["_district", "_taluk", "_crop", "_season"]
    processed_rows = []

    for keys, group in work.groupby(group_cols, dropna=False):
        district, taluk, crop, season = keys
        group_sorted = group.sort_values("_year")
        years_present = group_sorted["_year"].tolist()
        if len(years_present) < 1:
            continue

        current_year = years_present[-1]
        current_yield = float(group_sorted.iloc[-1]["_yield"])
        baseline_rows = group_sorted.iloc[:-1]

        if len(baseline_rows) >= 2:
            hist_avg = float(baseline_rows["_yield"].mean())
            years_in_baseline = len(baseline_rows)
            loss_pct = ((hist_avg - current_yield) / hist_avg) * 100.0 if hist_avg > 0 else None
        else:
            c_key = crop.strip().lower()
            s_key = season.strip().lower()
            if state_baselines and (c_key, s_key) in state_baselines:
                hist_avg = state_baselines[(c_key, s_key)]
                years_in_baseline = 5
                loss_pct = ((hist_avg - current_yield) / hist_avg) * 100.0 if hist_avg > 0 else None
                # logger.info("Group (%s, %s, %s, %s) used State Baseline: avg=%.2f, loss_pct=%.2f",
                #             district, taluk, crop, season, hist_avg, loss_pct)
            else:
                hist_avg = None
                years_in_baseline = len(baseline_rows)
                loss_pct = None
                # logger.info("Group (%s, %s, %s, %s) has only %d prior year(s) of real data -- "
                #             "leaving historical_avg_yield and yield_loss_pct blank rather than guessing.",
                #             district, taluk, crop, season, years_in_baseline)

        processed_rows.append({
            "district": district,
            "taluk": taluk if taluk else "",
            "crop_name": crop,
            "season": season if season else "",
            "year": int(current_year),
            "years_in_baseline": years_in_baseline,
            "historical_avg_yield": round(hist_avg, 2) if hist_avg is not None else "",
            "current_yield": round(current_yield, 2),
            "yield_loss_pct": round(loss_pct, 2) if loss_pct is not None else "",
        })

    df = pd.DataFrame(processed_rows)
    if not df.empty:
        df = df.sort_values(by=["district", "taluk", "crop_name"]).reset_index(drop=True)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8")

    print("\n" + "=" * 70)
    print("  DES KARNATAKA CROP YIELD LOSS SUMMARY (real data only)")
    print("=" * 70)
    print(f"  Total District-Taluk-Crop-Season Groups : {len(df)}")
    if not df.empty:
        with_baseline = df[df["historical_avg_yield"] != ""]
        print(f"  Groups With a Usable Baseline (>=2 yrs) : {len(with_baseline)}")
        print(f"  Groups With Only 1 Year (left blank)    : {len(df) - len(with_baseline)}")
        print(f"  Districts Covered                       : {df['district'].nunique()}")
        print(f"  Distinct Crops Evaluated                : {df['crop_name'].nunique()}")
        if not with_baseline.empty:
            loss_vals = with_baseline["yield_loss_pct"].astype(float)
            print(f"  Mean Yield Loss (where computable)      : {loss_vals.mean():.2f}%")
            print(f"  Max Yield Loss Observed                 : {loss_vals.max():.2f}%")
    print(f"  Output CSV Saved To                     : {os.path.abspath(output_path)}")
    print("=" * 70 + "\n")

    return df


def main():
    parser = argparse.ArgumentParser(
        description="SatyaFasal - Step 4: Fetch & Compute DES Karnataka Crop Yield Data from data.gov.in"
    )
    parser.add_argument(
        "--resource-id", "-r",
        required=False,
        help=("data.gov.in Resource ID (UUID) for a Karnataka crop yield / CCE dataset. "
              "Find this on the data.gov.in catalog UI -- it is NOT guessed or defaulted by this script.")
    )
    parser.add_argument(
        "--local-csv", "-l",
        help="Path to a local CSV file to bypass API fetching (e.g. data downloaded from UPAg portal)."
    )
    parser.add_argument(
        "--state-baseline", "-s",
        help="Path to a state-level historical yields CSV (e.g. data/karnataka_state_yield_history.csv)."
    )
    parser.add_argument(
        "--output", "-o",
        default="data/processed/des_yield_loss.csv",
        help="Target output CSV path for computed yield loss statistics"
    )
    parser.add_argument(
        "--env", "-e",
        default=".env",
        help="Path to .env file containing DATA_GOV_API_KEY"
    )
    parser.add_argument(
        "--page-size", "-p",
        type=int,
        default=100,
        help="Number of records per page (default: 100)"
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=0.5,
        help="Rate-limiting delay between page requests in seconds (default: 0.5s)"
    )
    args = parser.parse_args()

    if args.local_csv:
        logger.info("Using local CSV: %s (Bypassing API Phase A & B)", args.local_csv)
        df_raw = pd.read_csv(args.local_csv)
        
        # Heuristic mapping for the UPAg dashboard CSV format
        yield_cols = [c for c in df_raw.columns if "yield" in c.lower()]
        yield_col = yield_cols[0] if yield_cols else df_raw.columns[-1]
            
        import re
        year_match = re.search(r'20\d{2}', yield_col)
        df_raw["_extracted_year"] = int(year_match.group(0)) if year_match else 2024
        
        col_map = {
            "district": next((c for c in df_raw.columns if "district" in c.lower()), None),
            "taluk": next((c for c in df_raw.columns if "taluk" in c.lower() or "tehsil" in c.lower()), None),
            "crop": next((c for c in df_raw.columns if "crop" in c.lower()), None),
            "season": next((c for c in df_raw.columns if "season" in c.lower()), None),
            "year": "_extracted_year",
            "yield": yield_col
        }
    else:
        if not args.resource_id:
            parser.error("Must provide either --resource-id or --local-csv")
        api_key = get_api_key(args.env)
        columns, col_map = phase_a_schema_discovery(args.resource_id, api_key)
        df_raw = phase_b_fetch_karnataka_records(
            resource_id=args.resource_id,
            api_key=api_key,
            col_map=col_map,
            page_size=args.page_size,
            delay_between_pages=args.delay
        )

    compute_yield_loss_from_real_data(
        df_raw, col_map, output_path=args.output, state_baseline_csv=args.state_baseline
    )


if __name__ == "__main__":
    main()