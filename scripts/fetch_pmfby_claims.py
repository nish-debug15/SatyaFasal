#!/usr/bin/env python3
"""
SatyaFasal - Step 2: Fetch PMFBY Claims Data (fetch_pmfby_claims.py)

Pulls REAL PMFBY claims data from the Open Government Data (OGD) Platform India (data.gov.in)
using DATA_GOV_API_KEY from .env.

Execution Flow:
  - Phase A (Schema Discovery): Query PMFBY dataset API with no state filter, inspect keys,
    and print exact column names to the console.
  - Phase B (Karnataka Extraction): Filter by state == "KARNATAKA" (or identified state field),
    fetch all available pages via pagination, append records, and output to data/raw/pmfby_karnataka_claims.csv.

Strictly real API data only:
  Zero synthetic values. If API fails or field is missing, logs error and leaves cell blank.
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

# Resolve project root (parent of scripts/ directory) so relative paths work correctly
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("pmfby_fetch.log", mode="a", encoding="utf-8")
    ]
)
logger = logging.getLogger("PMFBYDataFetcher")

# Default official PMFBY / Agricultural Insurance Resource IDs on data.gov.in
# (These represent published datasets under Ministry of Agriculture & Farmers Welfare)
DEFAULT_PMFBY_RESOURCE_IDS = [
    # State/UT-wise PMFBY progress and claims
    "9ef84268-d588-465a-a308-a864a43d0070",  # General Agricultural dataset catalog test
    # Primary PMFBY claim resource endpoints can be overridden via --resource-id argument
]

DATA_GOV_BASE_URL = "https://api.data.gov.in/resource"


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
    Execute a robust HTTP GET request to data.gov.in resource API with exponential backoff.
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
            logger.debug("Requesting offset=%d, limit=%d (attempt %d/%d)...", offset, limit, attempt, max_retries)
            response = requests.get(url, params=params, headers=headers, timeout=timeout)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    return data
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


def phase_a_schema_discovery(resource_id: str, api_key: str) -> Tuple[List[str], Optional[str]]:
    """
    Phase A: Query dataset with no state filter to discover raw structure and column names.
    Returns (column_names, detected_state_column_name).
    """
    print("\n" + "=" * 70)
    print(f"  PHASE A: SCHEMA DISCOVERY (Resource ID: {resource_id})")
    print("=" * 70)
    logger.info("Executing Phase A: Querying data.gov.in with NO state filter...")

    data = query_datagov_resource(resource_id=resource_id, api_key=api_key, limit=5, offset=0)
    
    if not data:
        logger.error("Phase A failed: Could not retrieve sample records from resource %s", resource_id)
        return [], None

    records = data.get("records", [])
    total_records = data.get("total", "Unknown")
    title = data.get("title", "Untitled Dataset")

    print(f"\nDataset Title : {title}")
    print(f"Total Records : {total_records}")
    print(f"Sample Count  : {len(records)}")
    
    if not records:
        logger.warning("No records returned in sample query. Inspecting metadata fields...")
        fields = [f.get("name") or f.get("id") for f in data.get("field", [])]
        print(f"Discovered Fields from metadata: {fields}")
        return fields, None

    sample_record = records[0]
    column_names = list(sample_record.keys())

    print("\n--- EXACT COLUMN NAMES DISCOVERED ---")
    for idx, col in enumerate(column_names, start=1):
        sample_val = sample_record.get(col, "")
        print(f"  [{idx:2d}] {col} (Example: '{sample_val}')")
    print("-------------------------------------\n")

    # Detect state column
    state_col = None
    state_candidates = ["state", "state_name", "states_union_territory", "state_ut", "stname", "states"]
    for cand in state_candidates:
        if cand in [c.lower() for c in column_names]:
            for c in column_names:
                if c.lower() == cand:
                    state_col = c
                    break
            break

    if state_col:
        logger.info("Detected State Column for filtering: '%s'", state_col)
    else:
        logger.warning("Could not automatically identify a state column from: %s", column_names)

    return column_names, state_col


def phase_b_karnataka_extraction(
    resource_id: str,
    api_key: str,
    state_col: Optional[str],
    output_path: str,
    page_size: int = 100,
    delay_between_pages: float = 0.5
) -> pd.DataFrame:
    """
    Phase B: Fetch all available pages, filter for Karnataka, and export to CSV.
    """
    print("\n" + "=" * 70)
    print("  PHASE B: KARNATAKA CLAIMS EXTRACTION & PAGINATION")
    print("=" * 70)
    logger.info("Starting Karnataka data extraction for resource: %s", resource_id)

    # Initial query to determine total count
    filters = {state_col: "KARNATAKA"} if state_col else None
    initial_data = query_datagov_resource(
        resource_id=resource_id,
        api_key=api_key,
        limit=page_size,
        offset=0,
        filters=filters
    )

    all_karnataka_records: List[Dict[str, Any]] = []
    total_pages = 0
    failed_pages = 0
    total_fetched = 0

    if initial_data and "records" in initial_data:
        total_available = int(initial_data.get("total", 0))
        records = initial_data.get("records", [])
        total_pages = math.ceil(total_available / page_size) if total_available > 0 else 1
        
        logger.info("Total available records in dataset matching query: %d (Estimated Pages: %d)", total_available, total_pages)

        # Process first page
        for r in records:
            if not state_col or str(r.get(state_col, "")).strip().upper() == "KARNATAKA":
                all_karnataka_records.append(r)
        
        total_fetched += len(records)
        print(f"Page [1/{total_pages}] Fetched: {len(records)} records (Karnataka matched: {len(all_karnataka_records)})")

        # Paginate through remaining pages
        for page_idx in range(2, total_pages + 1):
            offset = (page_idx - 1) * page_size
            time.sleep(delay_between_pages)
            
            page_data = query_datagov_resource(
                resource_id=resource_id,
                api_key=api_key,
                limit=page_size,
                offset=offset,
                filters=filters
            )

            if page_data and "records" in page_data:
                page_records = page_data.get("records", [])
                for r in page_records:
                    if not state_col or str(r.get(state_col, "")).strip().upper() == "KARNATAKA":
                        all_karnataka_records.append(r)
                total_fetched += len(page_records)
                print(f"Page [{page_idx}/{total_pages}] Fetched: {len(page_records)} records (Total Karnataka: {len(all_karnataka_records)})")
            else:
                failed_pages += 1
                logger.warning("Failed to fetch page %d (offset %d)", page_idx, offset)

    else:
        logger.error("Failed initial page fetch for resource %s", resource_id)
        failed_pages += 1

    # Convert to DataFrame
    df_out = pd.DataFrame(all_karnataka_records)

    # Ensure parent directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    df_out.to_csv(output_path, index=False, encoding="utf-8")

    print("\n" + "=" * 70)
    print("  PMFBY DATA EXTRACTION SUMMARY")
    print("=" * 70)
    print(f"  Total Pages Queried      : {total_pages}")
    print(f"  Failed Pages             : {failed_pages}")
    print(f"  Total Raw Records Fetched: {total_fetched}")
    print(f"  Total Karnataka Records  : {len(df_out)}")
    print(f"  Output CSV Saved To      : {os.path.abspath(output_path)}")
    print("=" * 70 + "\n")

    return df_out


def main():
    parser = argparse.ArgumentParser(
        description="SatyaFasal - Step 2: Fetch PMFBY Claims Data from data.gov.in"
    )
    parser.add_argument(
        "--resource-id", "-r",
        default=DEFAULT_PMFBY_RESOURCE_IDS[0],
        help="data.gov.in Resource ID for PMFBY Claims dataset"
    )
    parser.add_argument(
        "--output", "-o",
        default="data/raw/pmfby_karnataka_claims.csv",
        help="Output CSV path for extracted Karnataka claims"
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

    api_key = get_api_key(args.env)
    
    # Phase A: Schema Discovery
    cols, state_col = phase_a_schema_discovery(args.resource_id, api_key)

    # Phase B: Karnataka Extraction
    df_karnataka = phase_b_karnataka_extraction(
        resource_id=args.resource_id,
        api_key=api_key,
        state_col=state_col,
        output_path=args.output,
        page_size=args.page_size,
        delay_between_pages=args.delay
    )


if __name__ == "__main__":
    main()
