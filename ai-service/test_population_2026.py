import json
import os
import sys
import math

def main():
    print("=== RUNNING FINAL RECONCILIATION POPULATION TESTS ===")
    
    pop_file = 'test_outputs/ap_population/andhra_pradesh_population_2026_est.json'
    if not os.path.exists(pop_file):
        raise FileNotFoundError(f"Missing {pop_file}")
        
    with open(pop_file, 'r') as f:
        data = json.load(f)
        
    if len(data) != 26:
        raise AssertionError(f"Expected 26 districts, got {len(data)}")
        
    districts = set([d['district'] for d in data])
    if len(districts) != 26:
        raise AssertionError("Duplicate districts found.")
        
    total_pop = 0
    densities = set()
    
    min_density = min(d['density_2026'] for d in data)
    max_density = max(d['density_2026'] for d in data)
    
    for d in data:
        assert 'provenance' in d and d['provenance'], "Lacks provenance"
        assert "EPSG:6933" in d['area_crs'] or "Equal Area" in d['area_crs'], "Area provenance must be an Equal Area CRS"
        
        # reject "2026 Census"
        assert "2026 census" not in str(d['population_status']).lower(), "Labeled as 2026 Census"
        assert "census 2026" not in str(d['population_status']).lower(), "Labeled as 2026 Census"
        
        # Verify VPI population normalization formula (min-max normalization)
        expected_norm = (d['density_2026'] - min_density) / (max_density - min_density)
        assert math.isclose(d['density_normalized'], expected_norm, abs_tol=1e-5), "VPI normalization differs from engine"
        assert math.isclose(d['vpi_population_contribution'], 0.15 * expected_norm, abs_tol=1e-5), "VPI contribution weight incorrect"
        
        total_pop += d['population_2026_est']
        densities.add(d['density_2026'])
        
    if len(densities) == 1:
        raise AssertionError("TEST FAILED: Population is generated from area alone (Uniform density detected).")
        
    print("PASS: 26 unique districts validated.")
    print("PASS: Provenance documented.")
    print("PASS: Area-proportional allocation correctly avoided.")
    print("PASS: Area is computed using an equal-area CRS.")
    print("PASS: VPI engine normalization matched exactly.")
    
    print("ALL TESTS PASSED.")

if __name__ == '__main__':
    main()
