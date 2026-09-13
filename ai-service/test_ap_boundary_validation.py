import os
import json
import geopandas as gpd
import numpy as np
from shapely.geometry import shape, mapping
import matplotlib.pyplot as plt

print("=== 1. FIND / VERIFY AP BOUNDARY SOURCE ===")
source_file = r"c:\Users\Hari\.antigravity-ide\Tejalast\Tejalast\Teja\data\india_land_boundary.geojson"
print(f"Source file: {source_file}")

if not os.path.exists(source_file):
    raise FileNotFoundError("Missing India land boundary geojson.")

print("\n=== 2. EXTRACT ANDHRA PRADESH ===")
output_dir = "test_outputs/ap_boundary"
os.makedirs(output_dir, exist_ok=True)
ap_boundary_out = os.path.join(output_dir, "andhra_pradesh_boundary.geojson")

india_gdf = gpd.read_file(source_file)
ap_gdf = india_gdf[india_gdf['st_nm'] == 'Andhra Pradesh']

if ap_gdf.empty:
    raise ValueError("Andhra Pradesh not found in the source GeoJSON.")

print(f"Feature count: {len(ap_gdf)}")
print(f"Geometry type: {ap_gdf.geom_type.iloc[0]}")
print(f"Original CRS: {ap_gdf.crs}")

# Save the AP boundary
ap_gdf.to_file(ap_boundary_out, driver="GeoJSON")
print(f"Saved extracted AP boundary to {ap_boundary_out}")

print("\n=== 3. BASIC GEOGRAPHIC VALIDATION ===")
is_valid = ap_gdf.is_valid.all()
bbox = ap_gdf.total_bounds # [minx, miny, maxx, maxy]
print(f"AP Boundary Geometry Valid: {is_valid}")
print(f"AP WGS84 Bounding Box: {bbox}")

# Calculate area in an equal-area/projected CRS (EPSG:32644)
ap_gdf_proj = ap_gdf.to_crs("EPSG:32644")
ap_area_m2 = ap_gdf_proj.area.sum()
ap_area_km2 = ap_area_m2 / 1_000_000.0
print(f"AP Projected Area (EPSG:32644): {ap_area_km2:.2f} sq km")

print("\n=== 4. SPATIAL INTERSECTION ===")
flood_events_path = "test_outputs/terramind_real_data/terramind_flood_events.geojson"
if not os.path.exists(flood_events_path):
    raise FileNotFoundError("Missing flood events geojson.")

events_gdf = gpd.read_file(flood_events_path)
print(f"Loaded {len(events_gdf)} flood events.")

# We want accurate area intersection, so we project both to EPSG:32644
events_gdf_proj = events_gdf.to_crs("EPSG:32644")
ap_geom_proj = ap_gdf_proj.geometry.iloc[0]

fully_inside = 0
partially_intersecting = 0
outside = 0

scoped_features = []

for idx, row in events_gdf_proj.iterrows():
    geom = row.geometry
    event_area = geom.area
    
    intersects_ap = geom.intersects(ap_geom_proj)
    within_ap = geom.within(ap_geom_proj)
    
    if intersects_ap:
        intersection_geom = geom.intersection(ap_geom_proj)
        intersection_area = intersection_geom.area
        intersection_pct = (intersection_area / event_area) * 100.0
    else:
        intersection_area = 0.0
        intersection_pct = 0.0
        
    if intersection_pct == 100.0:
        fully_inside += 1
    elif intersection_pct > 0.0:
        partially_intersecting += 1
    else:
        outside += 1
        
    # === 5. DEFINE AP EVENT SCOPE & 6. EVENT ATTRIBUTES ===
    if intersection_pct == 100.0:
        # Add properties to the original WGS84 geometry
        original_row = events_gdf.iloc[idx].copy()
        
        props = {}
        for k, v in original_row.drop("geometry").items():
            if isinstance(v, (np.bool_, bool)):
                props[k] = bool(v)
            elif isinstance(v, (np.integer, int)):
                props[k] = int(v)
            elif isinstance(v, (np.floating, float)):
                props[k] = float(v)
            else:
                props[k] = v
                
        props["geographic_scope"] = "Andhra Pradesh"
        props["state"] = "Andhra Pradesh"
        props["country"] = "India"
        props["ap_boundary_validated"] = True
        props["ap_intersection_percentage"] = round(intersection_pct, 2)
        
        feat = {
            "type": "Feature",
            "geometry": mapping(original_row.geometry),
            "properties": props
        }
        scoped_features.append(feat)

print(f"Events fully inside AP: {fully_inside}")
print(f"Events partially intersecting AP: {partially_intersecting}")
print(f"Events outside AP: {outside}")

print("\n=== 5. DEFINE AP EVENT SCOPE ===")
print("Rule: AP_EVENT_MIN_INTERSECTION_PERCENT = 100.0")
print(f"AP-scoped events: {len(scoped_features)}")

scoped_geojson = {
    "type": "FeatureCollection",
    "name": "TerraMind_Flood_Events_AP_Scoped",
    "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    "features": scoped_features
}

scoped_out = os.path.join(output_dir, "terramind_flood_events_ap_scoped.geojson")
with open(scoped_out, "w") as f:
    json.dump(scoped_geojson, f, indent=2)
print(f"Saved AP-scoped events to {scoped_out}")

print("\n=== 7. VISUAL VALIDATION ===")
# Create overlay
fig, ax = plt.subplots(figsize=(10, 10))

# Plot full AP boundary for context
ap_gdf.boundary.plot(ax=ax, color='black', linewidth=1, label='AP Boundary')

# Zoom into the event area for better visibility
minx, miny, maxx, maxy = events_gdf.total_bounds
padding_x = (maxx - minx) * 2.0
padding_y = (maxy - miny) * 2.0
ax.set_xlim(minx - padding_x, maxx + padding_x)
ax.set_ylim(miny - padding_y, maxy + padding_y)

# Plot all original events (e.g. blue)
if len(events_gdf) > 0:
    events_gdf.boundary.plot(ax=ax, color='blue', linewidth=1, linestyle='--', label='Original Events')

# Plot AP scoped events (e.g. red)
if len(scoped_features) > 0:
    scoped_gdf = gpd.GeoDataFrame.from_features(scoped_geojson["features"], crs="EPSG:4326")
    scoped_gdf.plot(ax=ax, color='red', alpha=0.5, label='AP-Scoped Events')

plt.title("AP Boundary Event Overlay")
plt.xlabel("Longitude")
plt.ylabel("Latitude")

overlay_out = os.path.join(output_dir, "ap_boundary_event_overlay.png")
plt.savefig(overlay_out, dpi=150)
plt.close()
print(f"Saved Visual Overlay to {overlay_out}")
print("\nBoundary validation complete.")
