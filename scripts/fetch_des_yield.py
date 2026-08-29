#!/usr/bin/env python3
"""
SatyaFasal - Step 4: Fetch DES Karnataka Crop Yield Data

This script downloads (optionally) a raw Karnataka crop‑yield CSV from a public
source, processes it to compute a year‑over‑year yield‑loss percentage and saves
the result as a clean, structured CSV.

The calculation is:
    yield_loss_pct = (historical_avg_yield - current_yield) / historical_avg_yield * 100
where *historical_avg_yield* is the mean yield of the same district & crop across
all available years *except* the target year.

The script contains no synthetic data – it works entirely on the official
statistics you provide.
"""

import os
import sys
import argparse
import logging
from typing import Optional
import pandas as pd
import requests

# Resolve project root (parent of scripts/ directory) so relative paths work correctly
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)

# ---------------------------------------------------------------------------
# Logging configuration – mirrors the style used in the other scripts
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("des_yield_fetch.log", mode="a", encoding="utf-8")
    ]
)
logger = logging.getLogger("DESYieldFetcher")

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def download_csv(url: str, dest_path: str) -> None:
    """Download a CSV from *url* and write it to *dest_path*.

    The function streams the response to avoid loading the whole file into memory.
    It raises an exception if the HTTP status is not 200.
    """
    logger.info("Downloading raw yield CSV from %s", url)
    resp = requests.get(url, stream=True, timeout=30)
    resp.raise_for_status()
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    logger.info("Saved raw CSV to %s", os.path.abspath(dest_path))

def load_raw_csv(path: str) -> pd.DataFrame:
    logger.info("Loading wide-format raw CSV from %s", path)
    df = pd.read_csv(path)
    # Filter for Yield columns only
    yield_cols = [c for c in df.columns if c.startswith("Yield-")]
    keep_cols = ["Crop", "Season"] + yield_cols
    df_yield = df[keep_cols].copy()
    
    # Melt to long format
    df_long = df_yield.melt(id_vars=["Crop", "Season"], var_name="YearStr", value_name="yield")
    
    # Extract start year as integer (e.g., 'Yield-2019-20' -> 2019)
    df_long["year"] = df_long["YearStr"].str.extract(r'Yield-(\d{4})').astype(float)
    df_long["yield"] = pd.to_numeric(df_long["yield"], errors="coerce")
    
    # Drop NAs
    df_long = df_long.dropna(subset=["year", "yield"])
    df_long["year"] = df_long["year"].astype(int)
    
    return df_long

def compute_yield_loss(df: pd.DataFrame, target_year: Optional[int] = None) -> pd.DataFrame:
    logger.info("Computing yield loss percentages")
    
    # Sort to ensure chronological order
    df = df.sort_values(by=["Crop", "Season", "year"])
    
    results = []
    
    for (crop, season), group in df.groupby(["Crop", "Season"]):
        group = group.copy()
        # Compute expanding mean for historical average (excluding current year)
        # Shift by 1 so the current year is not included in its own historical average
        group["historical_avg_yield"] = group["yield"].expanding().mean().shift(1)
        results.append(group)
        
    res_df = pd.concat(results, ignore_index=True)
    
    def loss_pct(row):
        if pd.isna(row["historical_avg_yield"]) or row["historical_avg_yield"] == 0:
            return None
        return (row["historical_avg_yield"] - row["yield"]) / row["historical_avg_yield"] * 100

    res_df["yield_loss_pct"] = res_df.apply(loss_pct, axis=1)
    res_df = res_df.rename(columns={"yield": "current_yield", "Crop": "crop", "Season": "season"})
    
    if target_year is not None:
        res_df = res_df[res_df["year"] == target_year]

    result = res_df[["crop", "season", "year", "historical_avg_yield", "current_yield", "yield_loss_pct"]]
    return result

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="SatyaFasal - Step 4: Fetch and process Karnataka crop‑yield data"
    )
    parser.add_argument(
        "--raw-path",
        default="data/raw/karnataka_yield_raw.csv",
        help="Path to the raw CSV (downloaded or manually placed)"
    )
    parser.add_argument(
        "--download-url",
        default=None,
        help="Optional public URL to a raw Karnataka yield CSV. If supplied, the script will download it before processing."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Specific year to compute loss for (e.g., 2023). If omitted, all years are processed."
    )
    parser.add_argument(
        "--output",
        default="data/processed/des_karnataka_yield.csv",
        help="Destination CSV for the processed yield‑loss data"
    )
    args = parser.parse_args()

    # Step 1 – optional download
    if args.download_url:
        try:
            download_csv(args.download_url, args.raw_path)
        except Exception as e:
            logger.error("Failed to download raw CSV: %s", e)
            sys.exit(1)

    # Step 2 – load raw data
    raw_df = load_raw_csv(args.raw_path)

    # Step 3 – compute loss percentages
    processed_df = compute_yield_loss(raw_df, target_year=args.year)

    # Step 4 – write output
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    processed_df.to_csv(args.output, index=False, float_format="%.3f")
    logger.info("Processed yield loss data saved to %s", os.path.abspath(args.output))
    logger.info("--- Summary ---")
    logger.info("Rows written: %d", len(processed_df))
    if args.year:
        logger.info("Year filtered: %d", args.year)
    else:
        logger.info("All available years processed")

if __name__ == "__main__":
    main()