import os
from textwrap import dedent

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
"""

GROQ_USER_PROMPT_TEMPLATE = """
Please generate a 2-3 sentence explanation for the following claim data:

- Category Label: {category_label}
- NDVI Change (Vegetation Health): {ndvi_change}
- Rainfall Deficit: {rainfall_deficit_pct}%
- KSDMA Drought Declaration (0=No, 1=Yes): {ksdma_severity}
- DES Historical Yield Loss: {yield_loss_pct}%
"""

def generate_groq_explanation_prompt(category_label, ndvi_change, rainfall_deficit_pct, ksdma_severity, yield_loss_pct):
    return GROQ_USER_PROMPT_TEMPLATE.format(
        category_label=category_label,
        ndvi_change=ndvi_change,
        rainfall_deficit_pct=rainfall_deficit_pct,
        ksdma_severity=ksdma_severity,
        yield_loss_pct=yield_loss_pct
    )

def test_prompts_with_simulated_llm():
    """Simulates sending the prompts to an LLM for 3 sample rows."""
    samples = [
        {
            "category_label": "MISMATCH",
            "ndvi_change": -0.25,
            "rainfall_deficit_pct": 5.0,
            "ksdma_severity": 0,
            "yield_loss_pct": 2.0
        },
        {
            "category_label": "CONSISTENT",
            "ndvi_change": -0.18,
            "rainfall_deficit_pct": 45.0,
            "ksdma_severity": 1,
            "yield_loss_pct": 35.0
        },
        {
            "category_label": "MISMATCH",
            "ndvi_change": 0.05,
            "rainfall_deficit_pct": 38.0,
            "ksdma_severity": 1,
            "yield_loss_pct": 28.0
        }
    ]

    # Pre-computed simulated outputs for demonstration since we lack a live Groq API key here.
    # These adhere strictly to the system prompt constraints.
    simulated_outputs = [
        "The data shows a MISMATCH because while vegetation health dropped significantly (NDVI change of -0.25), this is not supported by weather or state data. Rainfall deficit was only 5.0%, there was no KSDMA drought declaration, and historical yield loss was minimal at 2.0%.",
        "The claim is CONSISTENT with a severe drought event, as evidenced by a vegetation health drop (NDVI change of -0.18) and a significant rainfall deficit of 45.0%. This is further corroborated by an official KSDMA drought declaration and a high historical yield loss of 35.0%.",
        "This claim is flagged as a MISMATCH because vegetation health actually improved (NDVI change of 0.05) despite severe weather conditions. While there was a 38.0% rainfall deficit, an official KSDMA drought declaration, and 28.0% yield loss in the region, the specific plot's vegetation did not reflect this damage."
    ]

    for i, sample in enumerate(samples):
        print(f"\n--- SAMPLE {i+1} ---")
        user_prompt = generate_groq_explanation_prompt(**sample)
        print("[USER PROMPT]")
        print(user_prompt.strip())
        print("\n[GROQ OUTPUT (Simulated)]")
        print(simulated_outputs[i])
        print("-" * 50)

if __name__ == "__main__":
    print("[SYSTEM PROMPT]")
    print(GROQ_SYSTEM_PROMPT.strip())
    test_prompts_with_simulated_llm()
