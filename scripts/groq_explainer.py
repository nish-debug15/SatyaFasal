#!/usr/bin/env python3
"""
SatyaFasal - Groq LLM Explanation Generator (groq_explainer.py)

Generates natural-language explanations for fraud classifier verdicts
using the Groq API (or simulated outputs when no API key is available).

Phase 1 Update:
  - Added ndvi_reliable flag and SAR delta to the prompt template
  - When NDVI is unreliable, the explanation mentions that SAR was used instead

NOTE: Currently using SIMULATED outputs because no GROQ_API_KEY is configured.
A real Groq API key is needed before final demo/submission — this is a known gap.
The prompt templates and integration are fully wired; only the API call is stubbed.
"""

import os
import sys
from typing import Optional

# Resolve project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import dotenv_values
    env_vars = dotenv_values(os.path.join(PROJECT_ROOT, ".env"))
except ImportError:
    env_vars = {}

GROQ_API_KEY = env_vars.get("GROQ_API_KEY") or os.environ.get("GROQ_API_KEY")

# --- GROQ PROMPT TEMPLATES ---

GROQ_SYSTEM_PROMPT = """
You are a plain-language explanation assistant for an agricultural insurance verification system.
Your only job is to phrase the provided data points into a concise, 2-3 sentence summary for a human reviewer.

CRITICAL RULES:
1. ONLY use the numbers and facts provided. Do NOT introduce external facts, assumptions, or hallucinate data.
2. NEVER introduce a new risk score or alter the provided category label.
3. NEVER use the words "fraud", "genuine", "approve", or "reject". 
4. DO NOT make a final determination. Only describe what the data shows in plain English.
5. Keep the explanation strictly to 2-3 sentences.
6. If NDVI is marked as unreliable, mention that SAR backscatter was used as the vegetation proxy instead.
"""

GROQ_USER_PROMPT_TEMPLATE = """
Please generate a 2-3 sentence explanation for the following claim data:

- Category Label: {category_label}
- NDVI Reliable: {ndvi_reliable}
- Vegetation Signal Used: {veg_signal_source}
- Vegetation Change Value: {veg_change_value}
- Rainfall Deficit: {rainfall_deficit_pct}%
- KSDMA Drought Declaration (0=No, 1=Yes): {ksdma_severity}
- DES Historical Yield Loss: {yield_loss_pct}%
"""


def generate_groq_explanation_prompt(
    category_label: str,
    ndvi_change: Optional[float] = None,
    rainfall_deficit_pct: Optional[float] = None,
    ksdma_severity: Optional[int] = None,
    yield_loss_pct: Optional[float] = None,
    ndvi_reliable: bool = True,
    sar_vv_delta: Optional[float] = None
) -> str:
    """Build the user prompt for the Groq LLM, accounting for NDVI reliability."""
    if ndvi_reliable:
        veg_source = "NDVI"
        veg_value = f"{ndvi_change:.4f}" if ndvi_change is not None else "N/A"
    else:
        veg_source = "SAR VV backscatter (NDVI was cloud-contaminated)"
        veg_value = f"{sar_vv_delta:.2f} dB" if sar_vv_delta is not None else "N/A (no SAR data)"

    return GROQ_USER_PROMPT_TEMPLATE.format(
        category_label=category_label,
        ndvi_reliable="Yes" if ndvi_reliable else "No (cloud >50%)",
        veg_signal_source=veg_source,
        veg_change_value=veg_value,
        rainfall_deficit_pct=rainfall_deficit_pct if rainfall_deficit_pct is not None else "N/A",
        ksdma_severity=ksdma_severity if ksdma_severity is not None else "N/A",
        yield_loss_pct=yield_loss_pct if yield_loss_pct is not None else "N/A"
    )


def call_groq_api(system_prompt: str, user_prompt: str) -> tuple[str, bool]:
    """
    Call the Groq API for a completion.
    Returns (explanation_text, is_simulated).
    """
    if not GROQ_API_KEY:
        # SIMULATED MODE — No real Groq API key available.
        return _simulate_explanation(user_prompt), True

    import requests
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 200
    }
    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
                             headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"], False
        else:
            # Fallback to simulated mode if API key is invalid or model fails
            print(f"[Groq API Error] {resp.status_code}: {resp.text[:200]}")
            return _simulate_explanation(user_prompt), True
    except Exception as e:
        print(f"[Groq API Exception] {str(e)}")
        return _simulate_explanation(user_prompt), True


def _simulate_explanation(user_prompt: str) -> str:
    """
    Generate a rule-based simulated explanation (no real LLM call).
    Parses the structured prompt to produce a deterministic summary.
    """
    prompt_lower = user_prompt.lower()

    # Extract category label
    label = "UNKNOWN"
    for lbl in ["CONSISTENT", "MISMATCH", "INCONCLUSIVE", "NO_DATA"]:
        if lbl.lower() in prompt_lower:
            label = lbl
            break

    # Check if SAR was used
    uses_sar = "sar" in prompt_lower

    if label == "CONSISTENT":
        if uses_sar:
            return ("The SAR backscatter data (used because NDVI was cloud-contaminated) shows a "
                    "significant vegetation change consistent with crop damage. This is corroborated "
                    "by the rainfall deficit and/or official drought declaration for the region.")
        return ("The satellite vegetation indices show a significant decline in crop health, "
                "corroborated by rainfall deficit data and/or official drought declarations. "
                "Multiple independent data sources align in supporting the reported crop loss.")

    elif label == "MISMATCH":
        if uses_sar:
            return ("Despite reported crop loss, SAR backscatter analysis (used in place of "
                    "cloud-contaminated NDVI) does not show the expected vegetation decline. "
                    "This discrepancy between the claim narrative and the observed signal warrants review.")
        return ("The satellite data does not support the claimed crop loss — vegetation indices "
                "show either stable or improving conditions during the reported loss period. "
                "This discrepancy with other data sources warrants further review.")

    elif label == "INCONCLUSIVE":
        return ("The available data signals are either partially missing or produce mixed results "
                "that do not clearly support or contradict the reported loss. "
                "Additional verification may be needed for a confident assessment.")

    else:  # NO_DATA
        return ("Insufficient data is available across the verification dimensions to assess "
                "this claim. Key signals (vegetation, rainfall, official declarations) are missing "
                "or unavailable for this location and time period.")


def generate_explanation_for_row(row: dict) -> tuple[str, bool]:
    """
    Convenience function: given a dict-like row from the master dataset,
    build the prompt and call the LLM (or simulator).
    """
    ndvi_reliable = row.get("ndvi_reliable", True)
    if isinstance(ndvi_reliable, str):
        ndvi_reliable = ndvi_reliable.lower() in ("true", "1", "yes")

    ndvi_change = None
    try:
        ndvi_change = float(row.get("ndvi_change", ""))
    except (ValueError, TypeError):
        pass

    sar_vv_delta = None
    try:
        pre_vv = float(row.get("s1_vv_db_pre", ""))
        post_vv = float(row.get("s1_vv_db_post", ""))
        sar_vv_delta = post_vv - pre_vv
    except (ValueError, TypeError):
        pass

    rain_def = None
    try:
        rain_def = float(row.get("rainfall_deficit_pct", ""))
    except (ValueError, TypeError):
        pass

    ksdma = None
    try:
        ksdma = int(float(row.get("ksdma_officially_declared_drought", "")))
    except (ValueError, TypeError):
        pass

    yield_loss = None
    try:
        yield_loss = float(row.get("des_yield_loss_pct", ""))
    except (ValueError, TypeError):
        pass

    category = str(row.get("multimodal_verdict", "INCONCLUSIVE"))

    prompt = generate_groq_explanation_prompt(
        category_label=category,
        ndvi_change=ndvi_change,
        rainfall_deficit_pct=rain_def,
        ksdma_severity=ksdma,
        yield_loss_pct=yield_loss,
        ndvi_reliable=ndvi_reliable,
        sar_vv_delta=sar_vv_delta
    )

    return call_groq_api(GROQ_SYSTEM_PROMPT, prompt)


if __name__ == "__main__":
    print("[SYSTEM PROMPT]")
    print(GROQ_SYSTEM_PROMPT.strip())

    if not GROQ_API_KEY:
        print("\n⚠️  No GROQ_API_KEY found — running in SIMULATED mode.")
        print("   Set GROQ_API_KEY in .env for real LLM explanations.\n")

    # Test with sample rows
    samples = [
        {"category_label": "MISMATCH", "ndvi_change": -0.25,
         "rainfall_deficit_pct": 5.0, "ksdma_severity": 0, "yield_loss_pct": 2.0,
         "ndvi_reliable": True},
        {"category_label": "CONSISTENT", "ndvi_change": -0.18,
         "rainfall_deficit_pct": 45.0, "ksdma_severity": 1, "yield_loss_pct": 35.0,
         "ndvi_reliable": True},
        {"category_label": "CONSISTENT", "ndvi_change": None,
         "rainfall_deficit_pct": 40.0, "ksdma_severity": 1, "yield_loss_pct": 30.0,
         "ndvi_reliable": False, "sar_vv_delta": -2.1},
    ]

    for i, s in enumerate(samples):
        print(f"\n--- SAMPLE {i+1} ---")
        prompt = generate_groq_explanation_prompt(**s)
        print("[USER PROMPT]")
        print(prompt.strip())
        print("\n[OUTPUT]")
        print(call_groq_api(GROQ_SYSTEM_PROMPT, prompt))
        print("-" * 50)
