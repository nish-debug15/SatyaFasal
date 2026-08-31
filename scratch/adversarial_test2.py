import pandas as pd
from scripts.run_satyafasal_pipeline import build_master_multimodal_dataset

pmfby_df = pd.read_csv("data/processed/pmfby_karnataka_claims_agg.csv")
adv_row = pmfby_df.iloc[0].copy()
adv_row["crop_name"] = "Dragonfruit"
adv_row["season"] = "Kharif"
adv_df = pd.DataFrame([adv_row])
adv_df.to_csv("scratch/adv_claims.csv", index=False)

out_df = build_master_multimodal_dataset(
    villages_csv="scratch/adv_villages.csv",
    pmfby_csv="scratch/adv_claims.csv",
    ksdma_csv="data/processed/ksdma_drought_declarations.csv",
    des_yield_csv="data/processed/des_yield_loss.csv",
    sat_rainfall_csv="data/processed/satyafasal_satellite_rainfall_output.csv",
    output_path="scratch/adv_output.csv"
)

res = out_df.iloc[0]
print("\n--- TEST 2: MISSING CROP ---")
print(f"Claimed Crop/Season: {res['crop_name']}")
print(f"DES Yield Found: {res['des_current_yield_kg_ha']}")
