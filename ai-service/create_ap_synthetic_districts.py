import os
import json
import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import voronoi_diagram

def create_synthetic_ap_districts():
    os.makedirs('test_outputs/ap_districts', exist_ok=True)
    out_file = 'test_outputs/ap_districts/andhra_pradesh_districts.geojson'
    
    if os.path.exists(out_file):
        print(f"File {out_file} already exists.")
        return
        
    ap_boundary_path = 'test_outputs/ap_boundary/andhra_pradesh_boundary.geojson'
    if not os.path.exists(ap_boundary_path):
        raise FileNotFoundError(f"Missing {ap_boundary_path}")
        
    ap_gdf = gpd.read_file(ap_boundary_path)
    if len(ap_gdf) != 1:
        raise ValueError("Expected exactly 1 feature in AP boundary")
        
    ap_poly = ap_gdf.geometry.iloc[0]
    
    districts = [
        {"name": "Parvathipuram Manyam", "code": "AP01", "lat": 18.78, "lon": 83.43},
        {"name": "Alluri Sitharama Raju", "code": "AP02", "lat": 18.08, "lon": 82.66},
        {"name": "Srikakulam", "code": "AP03", "lat": 18.29, "lon": 83.89},
        {"name": "Vizianagaram", "code": "AP04", "lat": 18.11, "lon": 83.39},
        {"name": "Visakhapatnam", "code": "AP05", "lat": 17.68, "lon": 83.21},
        {"name": "Anakapalli", "code": "AP06", "lat": 17.69, "lon": 83.00},
        {"name": "Kakinada", "code": "AP07", "lat": 16.95, "lon": 82.23},
        {"name": "Konaseema", "code": "AP08", "lat": 16.57, "lon": 82.00},
        {"name": "East Godavari", "code": "AP09", "lat": 17.00, "lon": 81.80},
        {"name": "West Godavari", "code": "AP10", "lat": 16.54, "lon": 81.52},
        {"name": "Eluru", "code": "AP11", "lat": 16.71, "lon": 81.10},
        {"name": "Krishna", "code": "AP12", "lat": 16.18, "lon": 81.13},
        {"name": "NTR", "code": "AP13", "lat": 16.50, "lon": 80.64},
        {"name": "Guntur", "code": "AP14", "lat": 16.29, "lon": 80.43},
        {"name": "Palnadu", "code": "AP15", "lat": 16.23, "lon": 80.05},
        {"name": "Bapatla", "code": "AP16", "lat": 15.90, "lon": 80.46},
        {"name": "Prakasam", "code": "AP17", "lat": 15.50, "lon": 80.04},
        {"name": "Sri Potti Sriramulu Nellore", "code": "AP18", "lat": 14.44, "lon": 79.98},
        {"name": "Tirupati", "code": "AP19", "lat": 13.62, "lon": 79.41},
        {"name": "Chittoor", "code": "AP20", "lat": 13.21, "lon": 79.10},
        {"name": "Annamayya", "code": "AP21", "lat": 14.05, "lon": 78.75},
        {"name": "YSR", "code": "AP22", "lat": 14.46, "lon": 78.82},
        {"name": "Nandyal", "code": "AP23", "lat": 15.48, "lon": 78.48},
        {"name": "Kurnool", "code": "AP24", "lat": 15.82, "lon": 78.03},
        {"name": "Anantapur", "code": "AP25", "lat": 14.68, "lon": 77.60},
        {"name": "Sri Sathya Sai", "code": "AP26", "lat": 14.16, "lon": 77.81}
    ]
    
    points = [Point(d['lon'], d['lat']) for d in districts]
    from shapely.geometry import MultiPoint
    mp = MultiPoint(points)
    
    regions = voronoi_diagram(mp, envelope=ap_poly)
    
    poly_list = list(regions.geoms)
    # Map each polygon to its nearest point
    district_geoms = []
    for d, pt in zip(districts, points):
        # find the polygon that contains this point
        poly = next(p for p in poly_list if p.contains(pt))
        # clip to AP boundary
        clipped = poly.intersection(ap_poly)
        district_geoms.append({
            "geometry": clipped,
            "district_name": d["name"],
            "district_code": d["code"]
        })
        
    districts_gdf = gpd.GeoDataFrame(district_geoms, crs="EPSG:4326")
    districts_gdf.to_file(out_file, driver="GeoJSON")
    print(f"Generated 26 synthetic AP districts at {out_file}")

if __name__ == '__main__':
    create_synthetic_ap_districts()
