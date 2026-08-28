import sys
import os
import json
sys.path.append(r"n:\gitt\SatyaFasal\scripts")
import fraud_classifier
import duplicate_detector
import groq_explainer

def test_fraud_classifier():
    print("=== 1. FRAUD CLASSIFIER TESTS ===")
    cases = [
        {"name": "Clear genuine drought", "data": (-0.25, 45.0, 1, 30.0)},
        {"name": "Clear mismatch", "data": (0.02, 5.0, 0, 2.0)},
        {"name": "Ambiguous/borderline case", "data": (-0.12, 15.0, 0, 15.0)},
        {"name": "Missing-data case", "data": (None, None, None, None)},
        {"name": "Duplicate-looking case (Not applicable for this component, requires geometry)", "data": (-0.2, 40.0, 1, 28.0)}
    ]
    for case in cases:
        print(f"\nRow: {case['name']}")
        print(f"Inputs: {case['data']}")
        res = fraud_classifier.classify_fraud_signal(*case["data"])
        print(f"Output: {res}")

def test_duplicate_detector():
    print("\n=== 2. DUPLICATE DETECTOR TESTS ===")
    sample_claims = [
        {
            "claim_id": "C1",
            "farmer_id": "F_ALICE",
            "season": "Kharif 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.01, 14.0], [75.01, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        },
        {
            "claim_id": "C2",
            "farmer_id": "F_ALICE",
            "season": "Rabi 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.01, 14.0], [75.01, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        },
        {
            "claim_id": "C3",
            "farmer_id": "F_BOB",
            "season": "Kharif 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.01, 14.0], [75.01, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        }
    ]
    res = duplicate_detector.detect_duplicates(sample_claims)
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    test_fraud_classifier()
    test_duplicate_detector()
