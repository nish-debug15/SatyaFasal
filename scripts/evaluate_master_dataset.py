#!/usr/bin/env python3
import pandas as pd
import sys
import os

# Resolve project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)

from scripts.fraud_classifier import classify_fraud_signal
from scripts.groq_explainer import generate_explanation_for_row

master_csv = 'data/satyafasal_master_multimodal_dataset.csv'
if not os.path.exists(master_csv):
    print(f"File not found: {master_csv}")
    sys.exit(1)

df = pd.read_csv(master_csv)

print(f"Loaded master dataset: {len(df)} rows")

# We will apply fraud_classifier to each row to generate fraud_label, fraud_confidence, fraud_reason
# And we will apply groq_explainer to generate an explanation

results = []
for idx, row in df.iterrows():
    r_dict = row.to_dict()
    
    # 1. Classification
    # Prepare args
    ndvi_reliable = r_dict.get('ndvi_reliable', True)
    if isinstance(ndvi_reliable, str):
        ndvi_reliable = ndvi_reliable.lower() in ('true', '1')
        
    def _parse_float(val):
        try:
            return float(val) if pd.notna(val) and val != '' else None
        except:
            return None

    def _parse_int(val):
        try:
            return int(float(val)) if pd.notna(val) and val != '' else None
        except:
            return None
            
    ndvi_change = _parse_float(r_dict.get('ndvi_change'))
    rain_def = _parse_float(r_dict.get('rainfall_deficit_pct'))
    ksdma = _parse_int(r_dict.get('ksdma_officially_declared_drought'))
    yield_loss = _parse_float(r_dict.get('des_yield_loss_pct'))
    
    pre_vv = _parse_float(r_dict.get('s1_vv_db_pre'))
    post_vv = _parse_float(r_dict.get('s1_vv_db_post'))
    sar_vv_delta = (post_vv - pre_vv) if (pre_vv is not None and post_vv is not None) else None
    
    class_res = classify_fraud_signal(
        ndvi_change=ndvi_change,
        rainfall_deficit_pct=rain_def,
        ksdma_officially_declared_drought=ksdma,
        des_yield_loss_pct=yield_loss,
        ndvi_reliable=ndvi_reliable,
        sar_vv_delta=sar_vv_delta
    )
    
    # 2. Explanation
    # groq_explainer takes the row dict, but it looks for multimodal_verdict instead of fraud_label.
    # Let's just pass r_dict as is, groq_explainer prompt will use whatever multimodal_verdict is there 
    
    explanation, is_sim = generate_explanation_for_row(r_dict)
    
    r_dict['fraud_label'] = class_res['label']
    r_dict['fraud_confidence'] = class_res['confidence']
    r_dict['fraud_reason'] = class_res['reason']
    r_dict['llm_explanation'] = explanation
    r_dict['llm_is_simulated'] = is_sim
    
    results.append(r_dict)

df_out = pd.DataFrame(results)
out_path = 'data/satyafasal_master_multimodal_dataset_evaluated.csv'
df_out.to_csv(out_path, index=False)

print(f"Classification and Explanation complete. Saved to {out_path}")

print("\n--- SAMPLE OUTPUT (10 rows) ---")
cols_to_show = ['village_name', 'multimodal_verdict', 'fraud_label', 'fraud_confidence', 'llm_explanation']
print(df_out[cols_to_show].head(10).to_string(index=False))

print("\n--- FRAUD LABEL DISTRIBUTION ---")
print(df_out['fraud_label'].value_counts())
