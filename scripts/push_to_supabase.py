#!/usr/bin/env python3
"""
SatyaFasal - Push Evaluated Dataset to Supabase (push_to_supabase.py)

Reads the evaluated master CSV and upserts all rows into the
`master_eval_dataset` table in Supabase (PostgreSQL).

Usage:
    python scripts/push_to_supabase.py
"""

import os
import sys
import math
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)

try:
    from dotenv import dotenv_values
    env_vars = dotenv_values(os.path.join(PROJECT_ROOT, ".env"))
except ImportError:
    env_vars = {}

SUPABASE_URL = env_vars.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = env_vars.get("SUPABASE_KEY") or os.environ.get("SUPABASE_KEY", "")

EVALUATED_CSV = os.path.join(PROJECT_ROOT, "data", "satyafasal_master_multimodal_dataset_evaluated.csv")
TABLE_NAME = "master_eval_dataset"


def clean_value(val):
    """Convert pandas NaN/None/empty to None for JSON serialization."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, str) and val.strip() in ("", "NO_DATA"):
        return None
    return val


def clean_row(row_dict: dict) -> dict:
    """Clean an entire row dict for Supabase insertion."""
    cleaned = {}
    for key, val in row_dict.items():
        cleaned[key] = clean_value(val)

    # Ensure boolean fields are actual booleans
    if cleaned.get("ndvi_reliable") is not None:
        v = cleaned["ndvi_reliable"]
        if isinstance(v, str):
            cleaned["ndvi_reliable"] = v.lower() in ("true", "1", "yes")

    if cleaned.get("llm_is_simulated") is not None:
        v = cleaned["llm_is_simulated"]
        if isinstance(v, str):
            cleaned["llm_is_simulated"] = v.lower() in ("true", "1", "yes")

    # Ensure numeric fields that might be strings are converted
    numeric_fields = [
        "latitude", "longitude", "pre_loss_ndvi", "post_loss_ndvi", "ndvi_change",
        "pre_loss_ndwi", "post_loss_ndwi", "s2_cloud_pct_pre", "s2_cloud_pct_post",
        "s1_vv_db_pre", "s1_vh_db_pre", "s1_vv_db_post", "s1_vh_db_post",
        "actual_rainfall_mm", "normal_rainfall_mm", "rainfall_deficit_pct",
        "des_historical_avg_yield_kg_ha", "des_current_yield_kg_ha", "des_yield_loss_pct"
    ]
    for field in numeric_fields:
        if field in cleaned and cleaned[field] is not None:
            try:
                cleaned[field] = float(cleaned[field])
            except (ValueError, TypeError):
                cleaned[field] = None

    int_fields = [
        "s1_fallback_used", "drought_rainfall_flag", "ksdma_officially_declared_drought",
        "pmfby_claims_reported", "year", "pmfby_claim_amount_inr", "pmfby_sum_insured_inr"
    ]
    for field in int_fields:
        if field in cleaned and cleaned[field] is not None:
            try:
                cleaned[field] = int(float(cleaned[field]))
            except (ValueError, TypeError):
                cleaned[field] = None

    return cleaned


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)

    if not os.path.exists(EVALUATED_CSV):
        print(f"ERROR: Evaluated CSV not found at {EVALUATED_CSV}")
        sys.exit(1)

    # Import supabase client
    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase-py is not installed. Run: pip install supabase")
        sys.exit(1)

    print(f"Connecting to Supabase: {SUPABASE_URL}")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Load CSV
    df = pd.read_csv(EVALUATED_CSV)
    print(f"Loaded {len(df)} rows from {EVALUATED_CSV}")
    print(f"Columns: {list(df.columns)}")

    # Add sequential ID if not present
    if "id" not in df.columns:
        df.insert(0, "id", range(1, len(df) + 1))

    # Clean and prepare rows
    rows = []
    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        row_dict["id"] = idx + 1  # 1-based ID
        cleaned = clean_row(row_dict)
        rows.append(cleaned)

    # Push to Supabase in batches of 50
    BATCH_SIZE = 50
    total_pushed = 0
    errors = []

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            result = client.table(TABLE_NAME).upsert(batch, on_conflict="id").execute()
            total_pushed += len(batch)
            print(f"  Pushed batch {i // BATCH_SIZE + 1}: {len(batch)} rows (total: {total_pushed}/{len(rows)})")
        except Exception as e:
            error_msg = str(e)
            errors.append(f"Batch {i // BATCH_SIZE + 1}: {error_msg}")
            print(f"  ERROR on batch {i // BATCH_SIZE + 1}: {error_msg}")

    print(f"\n{'=' * 60}")
    print(f"  SUPABASE PUSH COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Table:        {TABLE_NAME}")
    print(f"  Rows pushed:  {total_pushed}/{len(rows)}")
    if errors:
        print(f"  Errors:       {len(errors)}")
        for e in errors:
            print(f"    - {e}")
    else:
        print(f"  Errors:       None")
    print(f"{'=' * 60}")

    # Verify by reading back
    try:
        verify = client.table(TABLE_NAME).select("id", count="exact").execute()
        print(f"\n  Verification: {verify.count} rows in Supabase table '{TABLE_NAME}'")
    except Exception as e:
        print(f"\n  Verification query failed: {e}")


if __name__ == "__main__":
    main()
