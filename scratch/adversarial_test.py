import pandas as pd
from scripts.run_satyafasal_pipeline import build_master_multimodal_dataset

# Create a small adversarial input with a non-Rice crop
pmfby_df = pd.read_csv("data/processed/pmfby_karnataka_claims_agg.csv")
# Take the first row, change it to Maize/Rabi
adv_row = pmfby_df.iloc[0].copy()
adv_row["crop_name"] = "Maize"
adv_row["season"] = "Rabi"
adv_df = pd.DataFrame([adv_row])
adv_df.to_csv("scratch/adv_claims.csv", index=False)

# Run the pipeline with just 1 village (the one corresponding to the adversarial row)
villages_df = pd.read_csv("data/raw/karnataka_villages.csv")
villages_df = villages_df[villages_df["village_name"] == adv_row["village_name"]]
villages_df.to_csv("scratch/adv_villages.csv", index=False)

out_df = build_master_multimodal_dataset(
    villages_csv="scratch/adv_villages.csv",
    pmfby_csv="scratch/adv_claims.csv",
    ksdma_csv="data/processed/ksdma_drought_declarations.csv",
    des_yield_csv="data/processed/des_yield_loss.csv",
    sat_rainfall_csv="data/processed/satyafasal_satellite_rainfall_output.csv",
    output_path="scratch/adv_output.csv"
)

res = out_df.iloc[0]
print("\n--- ADVERSARIAL TEST RESULTS ---")
print(f"Village: {res['village_name']}")
print(f"Claimed Crop/Season: {res['crop_name']} / {res.get('season', 'Unknown')}")
print(f"DES Yield Found: {res['des_current_yield_kg_ha']}")
print(f"Yield Supports Loss: {res['yield_supports_loss']}")
