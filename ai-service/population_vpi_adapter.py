import os
import json
import geopandas as gpd

def main():
    print("=== TASK 14E: FINAL KONASEEMA AREA / POPULATION DENSITY RECONCILIATION ===")
    
    os.makedirs('test_outputs/ap_population', exist_ok=True)
    
    official_2026_target = 53400000 
    
    # 26-District 2011 Reaggregated Baseline
    baseline_2011 = {
        'ALLURI SITHARAMA RAJU': 604031,
        'ANAKAPALLI': 1726998,
        'ANANTHAPURAM': 2241105, 
        'ANNAMAYYA': 1697308,
        'BAPATLA': 1586918,
        'CHITTOOR': 1872951,
        'KONASEEMA': 1719093,
        'EASTGODAVARI': 1832332,
        'ELURU': 2006737,
        'GUNTUR': 2091075,
        'KAKINADA': 2092374,
        'KRISHNA': 1735079,
        'KURNOOL': 2271686,
        'NANDYAL': 1781777,
        'NTR': 2218591,
        'PALNADU': 2041723,
        'PARVATHIPURAMMANYAM': 925340,
        'PRAKASAM': 1767633,
        'SRIPOTTISRIRAMULUNELLORE': 2963557,
        'SRISATHYASAI': 1840043,
        'SRIKAKULAM': 2191471,
        'TIRUPATHI': 2196984,
        'VISAKHAPATNAM': 1959544,
        'VIZIANAGARAM': 1930811,
        'WESTGODAVARI': 1844898,
        'YSR': 2060654
    }
    
    sum_baseline_2011 = sum(baseline_2011.values())
    
    districts_file = 'test_outputs/ap_districts/andhra_pradesh_districts.geojson'
    districts_gdf = gpd.read_file(districts_file)
    
    areas_km2 = {}
    for idx, row in districts_gdf.iterrows():
        # Using EPSG:6933 (EASE-Grid 2.0 Global) as the equal-area CRS for calculation
        geom_proj = gpd.GeoSeries([row.geometry], crs=districts_gdf.crs).to_crs('EPSG:6933')
        areas_km2[row['district']] = geom_proj.area.iloc[0] / 1e6
        
    population_data = []
    sum_2026 = 0
    
    # CASE B: Projection Derivation
    for idx, row in districts_gdf.iterrows():
        name = row['district']
        code = row['dcode']
        area = areas_km2[name]
        
        pop_2011 = baseline_2011.get(name)
        
        est_2026 = int(pop_2011 * (official_2026_target / sum_baseline_2011))
        sum_2026 += est_2026
        
        population_data.append({
            "district": name,
            "district_code": code,
            "population_2011": pop_2011,
            "population_2011_source": "Government of Andhra Pradesh District Reorganization Notifications (2022) / Census 2011 Reaggregated",
            "population_2026_est": est_2026,
            "population_status": "2026_projected_estimate",
            "projection_source": "MoHFW Technical Group on Population Projections 2011-2036",
            "methodology": "Scaled from validated current-26 2011 baseline using the official Andhra Pradesh state-level 2026 population projection.",
            "area_km2": area,
            "area_crs": "EPSG:6933 (Equal Area)",
            "area_selection_reason": "For Risk2Rescue's spatial VPI engine, we prefer the area definition that is consistent with the actual GIS district geometry (Rule A) rather than mixing government area with GIS polygons.",
            "density_2026": est_2026 / area if area > 0 else 0,
            "density_normalized": 0.0,
            "vpi_population_contribution": 0.0,
            "provenance": "Reaggregated 26-district demographics from AP Govt Gazettes via secondary compilation. Area computed via equal-area projection of official AP SDMA GIS boundary."
        })
        
    # Handle rounding error to perfectly match state target
    diff = official_2026_target - sum_2026
    if diff != 0 and population_data:
        population_data[0]['population_2026_est'] += diff
        sum_2026 += diff
        population_data[0]['density_2026'] = population_data[0]['population_2026_est'] / population_data[0]['area_km2']
        
    # Final Population-Density Normalization
    densities = [d['density_2026'] for d in population_data]
    min_density = min(densities)
    max_density = max(densities)
    
    for d in population_data:
        norm = (d['density_2026'] - min_density) / (max_density - min_density) if max_density > min_density else 0
        d['density_normalized'] = norm
        d['vpi_population_contribution'] = 0.15 * norm
        
    # Add Government Area Reference specifically for Konaseema
    for d in population_data:
        if d['district'] == 'KONASEEMA':
            d['government_reference_area_km2'] = 2081.16
            d['gis_analysis_area_km2'] = d['area_km2']
            d['selected_vpi_area_km2'] = d['area_km2']
    
    # Create Data Outputs
    with open('test_outputs/ap_population/andhra_pradesh_population_2026_est.json', 'w') as f:
        json.dump(population_data, f, indent=2)
        
    districts_pop_gdf = districts_gdf.merge(
        gpd.GeoDataFrame(population_data),
        left_on='dcode',
        right_on='district_code',
        how='left'
    )
    districts_pop_gdf.to_file('test_outputs/ap_population/andhra_pradesh_population_2026_est.geojson', driver='GeoJSON')
    
    print("Execution complete. All artifacts generated successfully.")

if __name__ == '__main__':
    main()
