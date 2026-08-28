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
    # Rule 0: All data missing
    if all(x is None for x in [ndvi_change, rainfall_deficit_pct, ksdma_officially_declared_drought, des_yield_loss_pct]):
        return {
            "label": "NO_DATA",
            "confidence": "NONE",
            "reason": "All verification signals are completely missing."
        }

    # If core NDVI is missing, we cannot verify crop loss securely
    if ndvi_change is None:
        return {
            "label": "INCONCLUSIVE",
            "confidence": "LOW",
            "reason": "Core NDVI signal is missing. Cannot confidently evaluate crop loss."
        }

    # Parse to correct types
    ndvi_val = float(ndvi_change)
    rain_val = float(rainfall_deficit_pct) if rainfall_deficit_pct is not None else None
    ksdma_val = int(ksdma_officially_declared_drought) if ksdma_officially_declared_drought is not None else None
    yield_val = float(des_yield_loss_pct) if des_yield_loss_pct is not None else None

    # Helper functions for safe comparisons with None
    def is_leq(val, threshold): return val is not None and val <= threshold
    def is_gt(val, threshold): return val is not None and val > threshold
    def is_eq(val, target): return val is not None and val == target

    # Rule 1: No crop loss observed from space.
    if ndvi_val > -0.05:
        return {
            "label": "MISMATCH",
            "confidence": "HIGH",
            "reason": "No significant NDVI drop observed (change > -0.05), contradicting crop loss claim."
        }

    # Rule 2: Severe crop loss claimed (NDVI dropped), but explicit evidence shows zero corroboration.
    if ndvi_val < -0.15:
        if is_leq(rain_val, 10.0) and is_eq(ksdma_val, 0) and is_leq(yield_val, 10.0):
            return {
                "label": "MISMATCH",
                "confidence": "HIGH",
                "reason": "Severe NDVI drop claimed, but no corresponding drought corroboration from rainfall, KSDMA, or yield."
            }

    # Rule 3: Moderate/Severe NDVI drop corroborated by strong meteorological and agronomic signals.
    if ndvi_val <= -0.10:
        if is_gt(rain_val, 30.0) or is_eq(ksdma_val, 1) or is_gt(yield_val, 25.0):
            return {
                "label": "CONSISTENT",
                "confidence": "HIGH",
                "reason": "NDVI drop is fully corroborated by rainfall deficit, KSDMA declaration, or yield loss."
            }

    # Default fallback
    return {
        "label": "INCONCLUSIVE",
        "confidence": "LOW",
        "reason": "Signals are mixed, partially missing, or do not cross deterministic thresholds for confident classification."
    }

if __name__ == "__main__":
    print("Testing Fraud Classifier:")
    print(classify_fraud_signal(-0.25, 5.0, 0, 0.0))  # Mismatch (Severe drop, no drought)
    print(classify_fraud_signal(0.02, 45.0, 1, 30.0)) # Mismatch (No NDVI drop despite drought)
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0))# Consistent (Corroborated)
