import os
import json
import geopandas as gpd
import pandas as pd
import numpy as np

def main():
    print("=== TASK 15A: SOURCE-GROUNDED KONASEEMA HABITATION AND SHELTER DATA ===")
    os.makedirs('test_outputs/habitation_exposure', exist_ok=True)
    print("Loading raw AP SDMA data...")
    raw_villages = gpd.read_file('konaseema_raw_villages.geojson')
    raw_shelters = gpd.read_file('konaseema_raw_shelters.geojson')
    flood_events = gpd.read_file('test_outputs/ap_districts/terramind_flood_events_by_district.geojson')
    
    utm_crs = 'EPSG:32644'
    villages_utm = raw_villages.to_crs(utm_crs)
    shelters_utm = raw_shelters.to_crs(utm_crs)
    flood_utm = flood_events.to_crs(utm_crs)
    
    print("Processing Villages...")
    verified_villages = []
    geo_villages = []
    valid_villages = villages_utm[
        (villages_utm.geometry.is_valid) & 
        (villages_utm.geometry.notnull()) & 
        (villages_utm['tot_p'] > 0)
    ]
    
    villages_wgs = valid_villages.to_crs('EPSG:4326')
    shelters_wgs = shelters_utm.to_crs('EPSG:4326')
    
    for idx, row in valid_villages.iterrows():
        vcode = str(row['vcode']).strip() if pd.notnull(row['vcode']) else str(row['objectid'])
        village_name = row['dvname'] if pd.notnull(row['dvname']) else "Unknown"
        mandal = row['dmname'] if pd.notnull(row['dmname']) else "Unknown"
        pop = int(row['tot_p']) if pd.notnull(row['tot_p']) else 0
        hh = int(row['no_hh']) if pd.notnull(row['no_hh']) else 0
        
        centroid_wgs = villages_wgs.loc[idx].geometry.centroid
        
        v_dict = {
            "village_id": vcode,
            "village_name": village_name,
            "mandal": mandal,
            "district": "Konaseema",
            "state": "Andhra Pradesh",
            "census_2011_pop": pop,
            "households": hh,
            "lat": centroid_wgs.y,
            "lng": centroid_wgs.x,
            "source": "AP SDMA FeatureServer (population_village)",
            "population_source": "AP SDMA / Census 2011",
            "population_year": 2011,
            "location_source": "AP SDMA",
            "data_quality_classification": "VERIFIED/TRACEABLE"
        }
        verified_villages.append(v_dict)
        
        geo_villages.append({
            "type": "Feature",
            "geometry": json.loads(gpd.GeoSeries([villages_wgs.loc[idx].geometry]).to_json())['features'][0]['geometry'],
            "properties": v_dict
        })
        
    print("Processing Shelters...")
    verified_shelters = []
    geo_shelters = []
    
    for idx, row in shelters_utm.iterrows():
        capacity_raw = row['capacity_n']
        capacity = None
        cap_status = "UNKNOWN"
        try:
            if pd.notnull(capacity_raw):
                capacity = int(float(capacity_raw))
                if capacity > 0:
                    cap_status = "VERIFIED"
                else:
                    capacity = "UNKNOWN"
                    cap_status = "UNKNOWN"
            else:
                capacity = "UNKNOWN"
        except:
            capacity = "UNKNOWN"
            
        geom_wgs = shelters_wgs.loc[idx].geometry
        lat = geom_wgs.y
        lon = geom_wgs.x
            
        s_dict = {
            "shelter_id": f"AP_SH_{row['objectid']}",
            "name": row['name'] if pd.notnull(row['name']) else "Unknown Shelter",
            "district": "Konaseema",
            "state": "Andhra Pradesh",
            "lat": lat,
            "lon": lon,
            "capacity": capacity,
            "capacity_verification_status": cap_status,
            "status": "Unknown",
            "type": row['type_desig'] if pd.notnull(row['type_desig']) else "cyclone_shelter",
            "source": "AP SDMA FeatureServer",
            "shelter_source": "AP SDMA cyclone_shelters",
            "capacity_source": "AP SDMA cyclone_shelters capacity_n field",
            "building_condition": row['building_c'] if pd.notnull(row['building_c']) else "Unknown"
        }
        verified_shelters.append(s_dict)
        
        geo_shelters.append({
            "type": "Feature",
            "geometry": json.loads(gpd.GeoSeries([geom_wgs]).to_json())['features'][0]['geometry'],
            "properties": s_dict
        })
        
    print("Running Exposure Analysis...")
    direct_intersections = 0
    within_500m = 0
    within_1km = 0
    within_5km = 0
    within_10km = 0
    intersecting_pop = 0
    near_flood_pop = 0
    
    flood_union = flood_utm.unary_union
    min_dist_overall = float('inf')
    nearest_hab_name = None
    
    for i, row in valid_villages.iterrows():
        village_geom = row.geometry
        dist = village_geom.distance(flood_union)
        pop = int(row['tot_p']) if pd.notnull(row['tot_p']) else 0
        
        if dist == 0 or village_geom.intersects(flood_union):
            direct_intersections += 1
            intersecting_pop += pop
        
        if dist <= 500: within_500m += 1
        if dist <= 1000: within_1km += 1
        if dist <= 5000: within_5km += 1
        if dist <= 10000: within_10km += 1
        
        if dist > 0 and dist <= 10000:
            near_flood_pop += pop
            
        if dist < min_dist_overall:
            min_dist_overall = dist
            nearest_hab_name = row['dvname']
            
    nearest_shelter_name = None
    min_shelter_dist = float('inf')
    for i, row in shelters_utm.iterrows():
        shelter_geom = row.geometry
        dist = shelter_geom.distance(flood_union)
        if dist < min_shelter_dist:
            min_shelter_dist = dist
            nearest_shelter_name = row['name']
            
    with open('test_outputs/habitation_exposure/konaseema_habitations_verified.json', 'w') as f:
        json.dump(verified_villages, f, indent=2)
    with open('test_outputs/habitation_exposure/konaseema_habitations_verified.geojson', 'w') as f:
        json.dump({"type": "FeatureCollection", "features": geo_villages}, f)
        
    with open('test_outputs/habitation_exposure/konaseema_shelters_verified.json', 'w') as f:
        json.dump(verified_shelters, f, indent=2)
    with open('test_outputs/habitation_exposure/konaseema_shelters_verified.geojson', 'w') as f:
        json.dump({"type": "FeatureCollection", "features": geo_shelters}, f)
        
    summary = {
        "habitation_source": "AP SDMA FeatureServer (population_village)",
        "habitation_authority": "Government of Andhra Pradesh (AP SDMA) / Census 2011",
        "habitation_year": 2011,
        "konaseema_habitation_count": len(verified_villages),
        "valid_coordinates": len(verified_villages),
        "population_completeness": "100%",
        "shelter_source": "AP SDMA FeatureServer (cyclone_shelters)",
        "shelter_authority": "Government of Andhra Pradesh (AP SDMA)",
        "shelter_count": len(verified_shelters),
        "verified_shelter_capacities": sum(1 for s in verified_shelters if s['capacity_verification_status'] == 'VERIFIED'),
        "unknown_capacities": sum(1 for s in verified_shelters if s['capacity_verification_status'] == 'UNKNOWN'),
        "direct_flood_intersections": direct_intersections,
        "within_500m": within_500m,
        "within_1km": within_1km,
        "within_5km": within_5km,
        "within_10km": within_10km,
        "directly_intersecting_population": intersecting_pop,
        "near_flood_population": near_flood_pop,
        "nearest_habitation": nearest_hab_name,
        "nearest_habitation_distance_m": round(min_dist_overall, 2) if nearest_hab_name else None,
        "nearest_shelter": nearest_shelter_name,
        "capacity_analysis_possible": bool(sum(1 for s in verified_shelters if s['capacity_verification_status'] == 'VERIFIED') > 0)
    }
    
    with open('test_outputs/habitation_exposure/source_validation_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
        
    print("Execution complete. Validated data generated successfully.")

if __name__ == '__main__':
    main()
