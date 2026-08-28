import json

def classify_fraud_signal(ndvi_change: float, rainfall_deficit_pct: float, ksdma_officially_declared_drought: int, des_yield_loss_pct: float) -> dict:
    """
    Rules-based fraud signal classifier.
    Outputs a category label + confidence based on deterministic thresholds.
    
    Thresholds & Rationale:
    - ndvi_change < -0.15: Indicates a severe drop in vegetation health (healthy crop to bare/dry soil).
    - ndvi_change > -0.05: Indicates normal vegetation behavior, no significant crop loss.
    - rainfall_deficit_pct > 30.0: Significant meteorological drought condition.
    - ksdma_officially_declared_drought == 1: Official state government declaration of drought.
    - des_yield_loss_pct > 25.0: Significant agronomic yield loss recorded for the region.
    """
    # Normalize inputs for missing values
    ndvi_change = float(ndvi_change) if ndvi_change is not None else 0.0
    rainfall_deficit_pct = float(rainfall_deficit_pct) if rainfall_deficit_pct is not None else 0.0
    ksdma_drought = int(ksdma_officially_declared_drought) if ksdma_officially_declared_drought is not None else 0
    yield_loss_pct = float(des_yield_loss_pct) if des_yield_loss_pct is not None else 0.0

    # Rule 1: No crop loss observed from space.
    if ndvi_change > -0.05:
        return {
            "label": "MISMATCH",
            "confidence": "HIGH",
            "reason": "No significant NDVI drop observed (change > -0.05), contradicting crop loss claim."
        }

    # Rule 2: Severe crop loss claimed (NDVI dropped), but absolutely zero corroborating weather/government signals.
    if ndvi_change < -0.15:
        if rainfall_deficit_pct <= 10.0 and ksdma_drought == 0 and yield_loss_pct <= 10.0:
            return {
                "label": "MISMATCH",
                "confidence": "HIGH",
                "reason": "Severe NDVI drop claimed, but no corresponding drought corroboration from rainfall, KSDMA, or yield."
            }

    # Rule 3: Moderate/Severe NDVI drop corroborated by strong meteorological and agronomic signals.
    if ndvi_change <= -0.10:
        if rainfall_deficit_pct > 30.0 or ksdma_drought == 1 or yield_loss_pct > 25.0:
            return {
                "label": "CONSISTENT",
                "confidence": "HIGH",
                "reason": "NDVI drop is fully corroborated by rainfall deficit, KSDMA declaration, or yield loss."
            }

    # Default fallback
    return {
        "label": "INCONCLUSIVE",
        "confidence": "LOW",
        "reason": "Signals are mixed or do not cross deterministic thresholds for confident classification."
    }

if __name__ == "__main__":
    print("Testing Fraud Classifier:")
    print(classify_fraud_signal(-0.25, 5.0, 0, 0.0))  # Mismatch (Severe drop, no drought)
    print(classify_fraud_signal(0.02, 45.0, 1, 30.0)) # Mismatch (No NDVI drop despite drought)
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0))# Consistent (Corroborated)
