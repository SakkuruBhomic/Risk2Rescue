import os
import json
import requests
import urllib3
import geopandas as gpd
import matplotlib.pyplot as plt

# Suppress insecure request warnings for the government server
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def main():
    print("=== TASK 13B: AP SDMA 26-DISTRICT MAPPING ===")
    
    os.makedirs('test_outputs/ap_districts', exist_ok=True)
    
    # Check synthetic proxy
    synthetic_file = 'test_outputs/ap_districts/andhra_pradesh_districts_SYNTHETIC_PROXY.geojson'
    if not os.path.exists(synthetic_file):
        print(f"Warning: Synthetic proxy not found at {synthetic_file}")
    
    out_districts_file = 'test_outputs/ap_districts/andhra_pradesh_districts.geojson'
    
    # STEP 1 & 2: FETCH OFFICIAL SOURCE
    print("\n--- Fetching Official AP SDMA Boundary ---")
    url = 'https://apsdmagis.ap.gov.in/gisserver/rest/services/Hosted/NP_History/FeatureServer/1/query'
    params = {
        'where': '1=1',
        'outFields': '*',
        'returnGeometry': 'true',
        'outSR': '4326',
        'f': 'geojson'
    }
    
    response = requests.get(url, params=params, verify=False, timeout=60)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data from AP SDMA: HTTP {response.status_code}")
        
    data = response.json()
    
    # Save raw GeoJSON
    with open(out_districts_file, 'w') as f:
        json.dump(data, f)
        
    print(f"Saved official AP SDMA GeoJSON to {out_districts_file}")
    
    # Read as GeoDataFrame
    districts_gdf = gpd.read_file(out_districts_file)
    
    # STEP 3 & 4: VALIDATE FEATURE COUNT AND ATTRIBUTES
    print("\n--- Validating Features ---")
    feat_count = len(districts_gdf)
    print(f"Feature count: {feat_count}")
    if feat_count != 26:
        raise ValueError(f"Expected exactly 26 districts, got {feat_count}")
        
    district_names = districts_gdf['district'].tolist()
    if len(set(district_names)) != 26:
        raise ValueError("District names are not unique!")
        
    print("All 26 Districts:", district_names)
    print("District codes unique check passed:", len(set(districts_gdf['dcode'])) == 26)
    
    # STEP 5: VALIDATE GEOMETRIES
    print("\n--- Validating Geometries ---")
    invalid_count = 0
    for idx, row in districts_gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            raise ValueError(f"District {row['district']} has empty geometry")
        if geom.geom_type not in ['Polygon', 'MultiPolygon']:
            raise ValueError(f"District {row['district']} is not Polygon/MultiPolygon (is {geom.geom_type})")
        if not geom.is_valid:
            invalid_count += 1
            print(f"Warning: District {row['district']} has invalid geometry. Repairing with buffer(0).")
            # Repair using buffer(0) as deterministic fix
            districts_gdf.loc[idx, 'geometry'] = geom.buffer(0)
            
    if invalid_count > 0:
        print(f"Repaired {invalid_count} invalid geometries.")
        # Save repaired dataset
        districts_gdf.to_file(out_districts_file, driver='GeoJSON')
    else:
        print("All geometries are valid natively.")
        
    # STEP 6 & 7: CRS AND AP COVERAGE
    print(f"\n--- Base CRS: {districts_gdf.crs} ---")
    
    target_crs = 'EPSG:32644'
    districts_proj = districts_gdf.to_crs(target_crs)
    
    ap_boundary_file = 'test_outputs/ap_boundary/andhra_pradesh_boundary.geojson'
    if os.path.exists(ap_boundary_file):
        ap_gdf = gpd.read_file(ap_boundary_file).to_crs(target_crs)
        districts_union = districts_proj.unary_union
        ap_poly = ap_gdf.geometry.iloc[0]
        
        # Calculate coverage ratio
        intersection_area = districts_union.intersection(ap_poly).area
        ap_area = ap_poly.area
        districts_area = districts_union.area
        
        print(f"AP Boundary Area: {ap_area / 1e6:.2f} sq km")
        print(f"Districts Union Area: {districts_area / 1e6:.2f} sq km")
        print(f"Intersection Area: {intersection_area / 1e6:.2f} sq km")
        
        coverage_pct = (intersection_area / ap_area) * 100
        print(f"Districts cover {coverage_pct:.2f}% of the AP boundary.")
    
    # STEP 8: REMAP TERRAMIND FLOOD EVENTS
    print("\n--- Remapping TerraMind Flood Events ---")
    events_file = 'test_outputs/ap_boundary/terramind_flood_events_ap_scoped.geojson'
    events_gdf = gpd.read_file(events_file)
    events_proj = events_gdf.to_crs(target_crs)
    
    mapping_results = []
    districts_with_overlap = set()
    
    for e_idx, event in events_proj.iterrows():
        event_geom = event.geometry
        event_area = event_geom.area
        event_id = event.get('feature_id', f"event_{e_idx}")
        
        overlaps = []
        for d_idx, district in districts_proj.iterrows():
            dist_geom = district.geometry
            if event_geom.intersects(dist_geom):
                intersection = event_geom.intersection(dist_geom)
                inter_area = intersection.area
                overlap_pct = (inter_area / event_area) * 100
                
                # Include overlaps > 0.01%
                if overlap_pct > 0.01:
                    overlaps.append({
                        "district_name": district['district'],
                        "district_code": district['dcode'],
                        "intersection_area_m2": inter_area,
                        "overlap_percentage": overlap_pct
                    })
                    districts_with_overlap.add(district['district'])
                    
        if overlaps:
            overlaps.sort(key=lambda x: x['overlap_percentage'], reverse=True)
            primary = overlaps[0]
            
            mapping_results.append({
                "event_id": event_id,
                "hazard_type": "Flood",
                "model": "TerraMind",
                "checkpoint": "ibm-esa-geospatial/TerraMind-base-Flood",
                "primary_district": primary['district_name'],
                "primary_district_code": primary['district_code'],
                "primary_overlap_percentage": primary['overlap_percentage'],
                "overlapping_district_count": len(overlaps),
                "overlapping_districts": [o['district_name'] for o in overlaps],
                "overlaps_detail": overlaps
            })
        else:
            mapping_results.append({
                "event_id": event_id,
                "hazard_type": "Flood",
                "model": "TerraMind",
                "checkpoint": "ibm-esa-geospatial/TerraMind-base-Flood",
                "primary_district": "Unresolved",
                "primary_district_code": "N/A",
                "primary_overlap_percentage": 0.0,
                "overlapping_district_count": 0,
                "overlapping_districts": [],
                "overlaps_detail": []
            })
            
    mapped_events = events_gdf.copy()
    for e_idx, mapping in enumerate(mapping_results):
        mapped_events.at[e_idx, 'primary_district'] = mapping['primary_district']
        mapped_events.at[e_idx, 'primary_district_code'] = mapping['primary_district_code']
        mapped_events.at[e_idx, 'primary_overlap_percentage'] = float(mapping['primary_overlap_percentage'])
        mapped_events.at[e_idx, 'overlapping_district_count'] = int(mapping['overlapping_district_count'])
        mapped_events.at[e_idx, 'overlapping_districts'] = ", ".join(mapping['overlapping_districts'])
        mapped_events.at[e_idx, 'hazard_type'] = mapping['hazard_type']
        mapped_events.at[e_idx, 'model'] = mapping['model']
        mapped_events.at[e_idx, 'checkpoint'] = mapping['checkpoint']

    # STEP 9: CREATE OUTPUTS
    out_events = 'test_outputs/ap_districts/terramind_flood_events_by_district.geojson'
    out_mapping = 'test_outputs/ap_districts/flood_event_district_mapping.json'
    
    mapped_events.to_file(out_events, driver="GeoJSON")
    with open(out_mapping, 'w') as f:
        json.dump(mapping_results, f, indent=2)
        
    print(f"Saved {out_events}")
    print(f"Saved {out_mapping}")
    
    # Check if East Godavari mapping remains valid
    all_east_godavari = all(m['primary_district'] == 'East Godavari' for m in mapping_results)
    if all_east_godavari:
        print("East Godavari mapping remains VALID for all 30 events with real dataset.")
    else:
        print("East Godavari mapping CHANGED! Primary districts found:", 
              set([m['primary_district'] for m in mapping_results]))
    
    print("\n--- Visualizing Overlay ---")
    fig, ax = plt.subplots(figsize=(12, 10))
    districts_gdf.plot(ax=ax, facecolor="none", edgecolor="black", linewidth=0.5)
    
    if len(mapped_events) > 0:
        mapped_events.plot(ax=ax, color="red", alpha=0.7, label="Flood Events")
        
    # Annotate district names safely
    for idx, row in districts_gdf.iterrows():
        try:
            pt = row.geometry.representative_point()
            ax.text(pt.x, pt.y, row['district'], fontsize=5, ha='center', va='center')
        except:
            pass
            
    plt.title("Andhra Pradesh 26-District Flood Mapping Overlay\nTerraMind Flood Prediction (AP SDMA Data)")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    out_img = 'test_outputs/ap_districts/ap_district_flood_overlay.png'
    plt.savefig(out_img, dpi=300, bbox_inches='tight')
    print(f"Saved {out_img}")

if __name__ == '__main__':
    main()
