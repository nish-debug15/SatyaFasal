import json
from shapely.geometry import shape

def detect_duplicates(claims: list) -> list:
    """
    Given a set of claims each with a plot_geometry (GeoJSON polygon) and farmer_id,
    computes pairwise polygon overlap.
    
    Rules:
    - Overlap > 90% between two different farmer_ids for overlapping date windows (same season) -> DUPLICATE_COLLISION
    - Same farmer_id has > 90% overlap across different seasons -> DUPLICATE_SOURCE
    """
    results = []
    
    for i in range(len(claims)):
        for j in range(i + 1, len(claims)):
            c1 = claims[i]
            c2 = claims[j]
            
            geom1 = shape(c1["plot_geometry"])
            geom2 = shape(c2["plot_geometry"])
            
            if not geom1.is_valid:
                geom1 = geom1.buffer(0)
            if not geom2.is_valid:
                geom2 = geom2.buffer(0)
                
            intersection = geom1.intersection(geom2)
            intersection_area = intersection.area
            
            if intersection_area > 0:
                # Calculate percentage overlap relative to the smaller polygon
                overlap1 = intersection_area / geom1.area
                overlap2 = intersection_area / geom2.area
                max_overlap = max(overlap1, overlap2)
                
                if max_overlap > 0.90:
                    # Same season, different farmers -> Collision (fraud indicator)
                    if c1["farmer_id"] != c2["farmer_id"] and c1["season"] == c2["season"]:
                        results.append({
                            "flag_type": "DUPLICATE_COLLISION",
                            "claim_1_id": c1["claim_id"],
                            "claim_2_id": c2["claim_id"],
                            "overlap_percent": round(max_overlap * 100, 2),
                            "reason": f"Overlap of {round(max_overlap*100,2)}% between different farmers in the same season."
                        })
                    # Different seasons, same farmer -> Source reuse (could be legitimate crop rotation or double-claiming)
                    elif c1["farmer_id"] == c2["farmer_id"] and c1["season"] != c2["season"]:
                        results.append({
                            "flag_type": "DUPLICATE_SOURCE",
                            "claim_1_id": c1["claim_id"],
                            "claim_2_id": c2["claim_id"],
                            "overlap_percent": round(max_overlap * 100, 2),
                            "reason": f"Overlap of {round(max_overlap*100,2)}% for the same farmer across different seasons."
                        })
                        
    return results

if __name__ == "__main__":
    # Sample Mock Data
    sample_claims = [
        {
            "claim_id": "C1001",
            "farmer_id": "F001",
            "season": "Kharif 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.01, 14.0], [75.01, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        },
        {
            "claim_id": "C1002",
            "farmer_id": "F002",
            "season": "Kharif 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.009, 14.0], [75.009, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        },
        {
            "claim_id": "C1003",
            "farmer_id": "F001",
            "season": "Rabi 2024",
            "plot_geometry": {"type": "Polygon", "coordinates": [[[75.0, 14.0], [75.01, 14.0], [75.01, 14.01], [75.0, 14.01], [75.0, 14.0]]]}
        }
    ]
    
    print("Testing Duplicate Detector:")
    duplicates = detect_duplicates(sample_claims)
    print(json.dumps(duplicates, indent=2))
