#!/usr/bin/env python3
"""
SatyaFasal - Step 3.5: Generate Synthetic PMFBY Claims
Generates synthetic farmer claims for testing the pipeline since real PII claim microdata is private.
Mixes matching cases (where claim narrative matches satellite signals) and contradicting cases.
"""

import os
import random
import hashlib
import pandas as pd

def generate_claims():
    fetch_csv = 'data/processed/satyafasal_satellite_rainfall_output.csv'
    if not os.path.exists(fetch_csv):
        print(f"Error: {fetch_csv} not found.")
        return

    df = pd.read_csv(fetch_csv)
    claims = []

    # Claim narratives pool
    drought_narratives = [
        "Severe drought during flowering stage destroyed crop.",
        "No rain for 30 days, total crop failure.",
        "Crop dried up due to prolonged moisture stress.",
        "Inadequate rainfall led to stunted growth and withering."
    ]
    healthy_narratives = [
        "Crop is healthy, minor pest attack but yield unaffected.",
        "Good rains, expecting normal yield.",
        "Slight waterlogging initially but crop recovered fully."
    ]
    flood_narratives = [
        "Heavy unseasonal rains washed away the topsoil and crop.",
        "Fields submerged for 5 days due to flash floods."
    ]

    for _, row in df.iterrows():
        village = row['village_name']
        dist = village.split('(')[-1].replace(')', '').strip() if '(' in village else village
        taluk = village.split('(')[0].strip() if '(' in village else village
        
        # Determine actual signal reality
        ndvi_reliable = row.get('ndvi_reliable', False)
        
        has_veg_loss = False
        if ndvi_reliable and pd.notna(row.get('s2_pre_ndvi_mean')) and pd.notna(row.get('s2_post_ndvi_mean')):
            if float(row['s2_post_ndvi_mean']) < float(row['s2_pre_ndvi_mean']) - 0.10:
                has_veg_loss = True
        elif not ndvi_reliable and pd.notna(row.get('s1_pre_vv_db_mean')) and pd.notna(row.get('s1_post_vv_db_mean')):
            if float(row['s1_post_vv_db_mean']) < float(row['s1_pre_vv_db_mean']) - 1.5:
                has_veg_loss = True
                
        has_rain_deficit = False
        if pd.notna(row.get('rainfall_deviation_pct')) and float(row['rainfall_deviation_pct']) > 25.0:
            has_rain_deficit = True

        # Generate 1 to 4 claims per village
        num_claims = random.randint(1, 4)
        for i in range(num_claims):
            farmer_id = f"FMR-{hashlib.md5(f'{village}-{i}'.encode()).hexdigest()[:8].upper()}"
            sum_insured = random.choice([35000, 42000, 50000, 65000])
            claim_amount = round(sum_insured * random.uniform(0.3, 1.0), 2)
            
            # Determine if this claim should match reality or contradict it
            # Let's make ~70% matching, 30% contradicting
            is_matching = random.random() < 0.70
            
            if is_matching:
                if has_veg_loss or has_rain_deficit:
                    narrative = random.choice(drought_narratives)
                    test_label = "MATCH_LOSS"
                else:
                    narrative = random.choice(healthy_narratives)
                    claim_amount = 0.0 # No claim if healthy
                    test_label = "MATCH_HEALTHY"
            else:
                if has_veg_loss or has_rain_deficit:
                    # Reality is loss, but farmer says healthy or claims flood (wrong peril)
                    narrative = random.choice(healthy_narratives + flood_narratives)
                    claim_amount = 0.0 if "healthy" in narrative else claim_amount
                    test_label = "CONTRADICT_REALITY_LOSS"
                else:
                    # Reality is healthy, but farmer claims severe drought
                    narrative = random.choice(drought_narratives)
                    test_label = "CONTRADICT_REALITY_HEALTHY"

            claims.append({
                'village_name': village,
                'district': dist,
                'taluk': taluk,
                'farmer_id_hash': farmer_id,
                'pmfby_sum_insured_inr': sum_insured,
                'pmfby_claim_amount_inr': claim_amount,
                'claim_narrative': narrative,
                'internal_test_label': test_label,
                'crop_name': 'Rice',
                'season': 'Kharif'
            })

    df_claims = pd.DataFrame(claims)
    
    # We need to aggregate them to village level for the master pipeline 
    # (since the master pipeline joins on village/district/taluk). 
    # Or, the master pipeline currently expects pmfby_claims_reported, pmfby_claim_amount_inr, pmfby_sum_insured_inr.
    # We will write the raw claims to a raw CSV, and an aggregated version that the pipeline can use.
    os.makedirs('data/processed', exist_ok=True)
    raw_claims_path = 'data/processed/synthetic_claims.csv'
    df_claims.to_csv(raw_claims_path, index=False)
    
    # Aggregate for pipeline
    df_agg = df_claims.groupby(['district', 'taluk', 'village_name', 'crop_name', 'season']).agg(
        pmfby_claims_reported=('farmer_id_hash', 'count'),
        pmfby_claim_amount_inr=('pmfby_claim_amount_inr', 'sum'),
        pmfby_sum_insured_inr=('pmfby_sum_insured_inr', 'sum')
    ).reset_index()
    
    agg_claims_path = 'data/processed/pmfby_karnataka_claims_agg.csv'
    df_agg.to_csv(agg_claims_path, index=False)
    
    print(f"Generated {len(df_claims)} synthetic claims across {df['village_name'].nunique()} villages.")
    print("Label distribution:")
    print(df_claims['internal_test_label'].value_counts())
    print("\nSample rows:")
    print(df_claims[['village_name', 'claim_amount_inr', 'claim_narrative', 'internal_test_label']].head(5))

if __name__ == "__main__":
    generate_claims()
