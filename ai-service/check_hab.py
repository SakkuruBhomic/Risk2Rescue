import json
import geopandas as gpd
from shapely.geometry import Point

with open('../data/census_lookup.json') as f:
    census = json.load(f)

ap_boundary = gpd.read_file('test_outputs/ap_boundary/andhra_pradesh_state_boundary.geojson')
districts = gpd.read_file('test_outputs/ap_districts/andhra_pradesh_districts.geojson')
konaseema_poly = districts[districts['district'] == 'KONASEEMA'].geometry.iloc[0]
ap_poly = ap_boundary.geometry.iloc[0]

for c in census:
    p = Point(c['lng'], c['lat'])
    in_ap = ap_poly.contains(p)
    in_kona = konaseema_poly.contains(p)
    if in_kona:
        print(f"{c['village_name']} is in Konaseema polygon! (District field says {c['district']})")
