#!/usr/bin/env python3
"""
SatyaFasal - Rules-Based Fraud Signal Classifier (fraud_classifier.py)

Classifies each claim row into a verification category based on deterministic
thresholds applied to real multimodal signals.

Key Design Decision (Phase 1 Fix):
  When ndvi_reliable=False (cloud contamination >50% in either pre- or post-loss
  Sentinel-2 scene), NDVI must NOT be used as evidence. Instead, the SAR VV/VH
  delta from Sentinel-1 is used as the primary vegetation-loss signal for that
  dimension. This prevents cloud-contaminated NDVI from being mistakenly treated
  as trustworthy.

Thresholds & Rationale:
  - ndvi_change < -0.15: Severe vegetation health drop (healthy → bare/dry soil)
  - ndvi_change > -0.05: Normal vegetation, no significant crop loss
  - sar_vv_delta < -1.5 dB: SAR-based vegetation loss (used when NDVI unreliable)
  - rainfall_deficit_pct > 30.0: Significant meteorological drought
  - ksdma_officially_declared_drought == 1: Official state drought declaration
  - des_yield_loss_pct > 25.0: Significant agronomic yield loss
"""

import json
from typing import Optional


def classify_fraud_signal(
    ndvi_change: Optional[float],
    rainfall_deficit_pct: Optional[float],
    ksdma_officially_declared_drought: Optional[int],
    des_yield_loss_pct: Optional[float],
    ndvi_reliable: bool = True,
    sar_vv_delta: Optional[float] = None
) -> dict:
    """
    Rules-based fraud signal classifier.

    Parameters
    ----------
    ndvi_change : float or None
        Post-loss NDVI minus pre-loss NDVI. Negative = vegetation decline.
    rainfall_deficit_pct : float or None
        (normal - actual) / normal * 100. Positive = deficit.
    ksdma_officially_declared_drought : int or None
        1 = drought officially declared, 0 = not declared.
    des_yield_loss_pct : float or None
        (historical_avg - current) / historical_avg * 100. Positive = loss.
    ndvi_reliable : bool
        False when cloud contamination > 50% makes NDVI untrustworthy.
        When False, the classifier falls back to sar_vv_delta instead.
    sar_vv_delta : float or None
        Post-loss VV(dB) minus pre-loss VV(dB). Negative = SAR-based vegetation loss.
        Only used when ndvi_reliable=False.

    Returns
    -------
    dict with keys: label, confidence, reason
    """

    # ------------------------------------------------------------------
    # Rule 0: All data missing
    # ------------------------------------------------------------------
    if all(x is None for x in [ndvi_change, rainfall_deficit_pct,
                                ksdma_officially_declared_drought, des_yield_loss_pct]):
        # Even SAR can't help if everything else is missing
        if sar_vv_delta is None:
            return {
                "label": "NO_DATA",
                "confidence": "NONE",
                "reason": "All verification signals are completely missing."
            }

    # ------------------------------------------------------------------
    # Determine the vegetation-loss signal to use
    # ------------------------------------------------------------------
    # When NDVI is unreliable (cloud-contaminated), fall back to SAR VV delta.
    # SAR (Sentinel-1 C-band) is cloud-penetrating, so it provides a valid
    # vegetation proxy even during monsoon cloud cover.
    veg_signal = None  # The effective vegetation-change value to threshold against
    veg_source = None  # "NDVI" or "SAR_VV" — for human-readable reason strings

    if ndvi_reliable and ndvi_change is not None:
        veg_signal = float(ndvi_change)
        veg_source = "NDVI"
    elif not ndvi_reliable and sar_vv_delta is not None:
        # SAR VV delta thresholds: <-1.5 dB ≈ significant vegetation loss
        # We normalize the SAR signal to an NDVI-comparable scale:
        #   SAR delta < -1.5 dB  →  treat as equivalent to NDVI drop < -0.15
        #   SAR delta > -0.5 dB  →  treat as equivalent to NDVI change > -0.05
        veg_signal = sar_vv_delta
        veg_source = "SAR_VV"
    elif not ndvi_reliable and sar_vv_delta is None:
        # NDVI is unreliable AND no SAR available — cannot assess vegetation
        veg_signal = None
        veg_source = None

    # ------------------------------------------------------------------
    # Rule 1: No vegetation signal available at all
    # ------------------------------------------------------------------
    if veg_signal is None:
        if not ndvi_reliable:
            return {
                "label": "INCONCLUSIVE",
                "confidence": "LOW",
                "reason": ("NDVI is cloud-contaminated (ndvi_reliable=False) and no SAR "
                           "VV/VH fallback data is available. Cannot evaluate vegetation loss.")
            }
        return {
            "label": "INCONCLUSIVE",
            "confidence": "LOW",
            "reason": "Core vegetation signal is missing. Cannot confidently evaluate crop loss."
        }

    # Helper functions for safe comparisons with None
    def is_leq(val, threshold):
        return val is not None and val <= threshold

    def is_gt(val, threshold):
        return val is not None and val > threshold

    def is_eq(val, target):
        return val is not None and val == target

    # Parse to correct types
    rain_val = float(rainfall_deficit_pct) if rainfall_deficit_pct is not None else None
    ksdma_val = int(ksdma_officially_declared_drought) if ksdma_officially_declared_drought is not None else None
    yield_val = float(des_yield_loss_pct) if des_yield_loss_pct is not None else None

    # ------------------------------------------------------------------
    # Thresholds differ by source (NDVI vs SAR)
    # ------------------------------------------------------------------
    if veg_source == "NDVI":
        no_loss_threshold = -0.05      # Above this: no vegetation loss observed
        moderate_loss = -0.10          # Below this: moderate loss
        severe_loss = -0.15            # Below this: severe loss
    else:
        # SAR VV delta thresholds (dB)
        no_loss_threshold = -0.5       # VV delta > -0.5 dB: no meaningful change
        moderate_loss = -1.0           # VV delta < -1.0 dB: moderate backscatter change
        severe_loss = -1.5             # VV delta < -1.5 dB: significant vegetation loss

    # ------------------------------------------------------------------
    # Rule 2: No crop loss observed from the vegetation signal
    # ------------------------------------------------------------------
    if veg_signal > no_loss_threshold:
        return {
            "label": "MISMATCH",
            "confidence": "HIGH",
            "reason": (f"No significant {veg_source} change observed "
                       f"(delta={veg_signal:.2f}, threshold={no_loss_threshold}), "
                       f"contradicting crop loss claim.")
        }

    # ------------------------------------------------------------------
    # Rule 3: Severe vegetation loss claimed but zero corroboration
    # ------------------------------------------------------------------
    if veg_signal < severe_loss:
        if is_leq(rain_val, 10.0) and is_eq(ksdma_val, 0) and is_leq(yield_val, 10.0):
            return {
                "label": "MISMATCH",
                "confidence": "HIGH",
                "reason": (f"Severe {veg_source} drop claimed (delta={veg_signal:.2f}), "
                           f"but no drought corroboration from rainfall, KSDMA, or yield.")
            }

    # ------------------------------------------------------------------
    # Rule 4: Moderate/Severe vegetation loss corroborated by other signals
    # ------------------------------------------------------------------
    if veg_signal <= moderate_loss:
        if is_gt(rain_val, 30.0) or is_eq(ksdma_val, 1) or is_gt(yield_val, 25.0):
            return {
                "label": "CONSISTENT",
                "confidence": "HIGH",
                "reason": (f"{veg_source} drop (delta={veg_signal:.2f}) is corroborated by "
                           f"rainfall deficit, KSDMA declaration, or yield loss.")
            }

    # ------------------------------------------------------------------
    # Default fallback
    # ------------------------------------------------------------------
    return {
        "label": "INCONCLUSIVE",
        "confidence": "LOW",
        "reason": ("Signals are mixed, partially missing, or do not cross deterministic "
                   "thresholds for confident classification.")
    }


if __name__ == "__main__":
    print("Testing Fraud Classifier:")
    print("\n1. NDVI reliable, severe drop, no corroboration:")
    print(classify_fraud_signal(-0.25, 5.0, 0, 0.0, ndvi_reliable=True))

    print("\n2. NDVI reliable, no drop despite drought:")
    print(classify_fraud_signal(0.02, 45.0, 1, 30.0, ndvi_reliable=True))

    print("\n3. NDVI reliable, corroborated loss:")
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0, ndvi_reliable=True))

    print("\n4. NDVI UNRELIABLE, SAR fallback shows loss, corroborated:")
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0, ndvi_reliable=False, sar_vv_delta=-2.1))

    print("\n5. NDVI UNRELIABLE, SAR shows no loss:")
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0, ndvi_reliable=False, sar_vv_delta=-0.3))

    print("\n6. NDVI UNRELIABLE, no SAR available:")
    print(classify_fraud_signal(-0.18, 40.0, 1, 35.0, ndvi_reliable=False, sar_vv_delta=None))
