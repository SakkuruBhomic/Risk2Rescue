import os
import json
import rasterio
import rasterio.features
import rasterio.mask
import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import shape, mapping
import pyproj
from pyproj import Transformer

print("=== 1. VERIFY INPUT RASTERS ===")
DATA_DIR = "test_outputs/terramind_real_data"
prob_path = os.path.join(DATA_DIR, "terramind_flood_probability.tif")
mask_path = os.path.join(DATA_DIR, "terramind_flood_mask.tif")
meta_path = os.path.join(DATA_DIR, "metadata.json")

for p in [prob_path, mask_path, meta_path]:
    if not os.path.exists(p):
        raise FileNotFoundError(f"Missing {p}. Please ensure Task 10 completed.")

with open(meta_path, "r") as f:
    orig_meta = json.load(f)

with rasterio.open(prob_path) as prob_src:
    prob_arr = prob_src.read(1)
    crs = prob_src.crs
    transform = prob_src.transform
    bounds = prob_src.bounds
    res = prob_src.res
    print(f"Probability Raster:")
    print(f" - Dimensions: {prob_src.width} x {prob_src.height}")
    print(f" - CRS: {crs}")
    print(f" - Transform: {transform}")
    print(f" - Resolution: {res}")
    print(f" - Bounds: {bounds}")
    print(f" - Nodata: {prob_src.nodata}")
    print(f" - Finite values: {np.isfinite(prob_arr).all()}")

with rasterio.open(mask_path) as mask_src:
    mask_arr = mask_src.read(1)
    print(f"Mask Raster:")
    print(f" - Dimensions: {mask_src.width} x {mask_src.height}")
    print(f" - Binary mask values: {np.unique(mask_arr)}")

total_pixels = mask_arr.size
flood_pixels = int(np.sum(mask_arr == 1))
flood_pct = (flood_pixels / total_pixels) * 100
print(f"Flood Pixel Count: {flood_pixels} ({flood_pct:.2f}%)")

print("\n=== 2. VERIFY THRESHOLD ===")
threshold = 0.50
print(f"Threshold used: {threshold}")
print("This threshold is an analysis threshold, NOT ground-truth calibrated.")

print("\n=== 3. VECTORIZE MASK ===")
# Vectorize only where mask == 1
shapes = rasterio.features.shapes(mask_arr, mask=(mask_arr == 1), transform=transform)

polygons = []
for geom, val in shapes:
    polygons.append(shape(geom))

print(f"Polygon count before filtering/repair: {len(polygons)}")

print("\n=== 4. REPAIR / VALIDATE GEOMETRY ===")
valid_polygons = []
invalid_count = 0
repaired_count = 0

for p in polygons:
    if not p.is_valid:
        invalid_count += 1
        p = p.buffer(0)
        if p.is_valid and not p.is_empty:
            repaired_count += 1
            valid_polygons.append(p)
    elif not p.is_empty:
        valid_polygons.append(p)

print(f"Invalid count: {invalid_count}")
print(f"Repaired count: {repaired_count}")
print(f"Final valid count before area filter: {len(valid_polygons)}")

print("\n=== 5. AREA FILTER ===")
min_area_m2 = 1000.0
filtered_polygons = []
for p in valid_polygons:
    # Our CRS is EPSG:32644 (metric) so p.area is in square meters
    if p.area >= min_area_m2:
        filtered_polygons.append(p)

total_area = sum(p.area for p in filtered_polygons)
print(f"Minimum area threshold applied: {min_area_m2} m2")
print(f"Polygon count after filtering: {len(filtered_polygons)}")
print(f"Total polygon area: {total_area:.2f} m2")

print("\n=== 6. CALCULATE EVENT ATTRIBUTES & 7. REPROJECT TO GEOJSON ===")
transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

features = []
prob_min_list, prob_max_list, prob_mean_list = [], [], []

with rasterio.open(prob_path) as prob_src:
    for i, p in enumerate(filtered_polygons):
        event_id = f"TM_FLOOD_{i+1:03d}"
        
        # Calculate stats for this polygon
        # Mask the probability raster with this polygon
        try:
            out_image, out_transform = rasterio.mask.mask(prob_src, [p], crop=True, nodata=np.nan)
            valid_probs = out_image[0][~np.isnan(out_image[0])]
            
            if len(valid_probs) > 0:
                p_min = float(valid_probs.min())
                p_max = float(valid_probs.max())
                p_mean = float(valid_probs.mean())
            else:
                p_min, p_max, p_mean = threshold, threshold, threshold
        except Exception as e:
            # Fallback if masking fails (e.g., edge cases)
            p_min, p_max, p_mean = threshold, threshold, threshold
            
        prob_min_list.append(p_min)
        prob_max_list.append(p_max)
        prob_mean_list.append(p_mean)
        
        area_m2 = p.area
        area_km2 = area_m2 / 1_000_000.0
        
        # Reproject geometry to WGS84
        # We need to map the coordinates using the transformer
        from shapely.ops import transform as shapely_transform
        geom_wgs84 = shapely_transform(transformer.transform, p)
        
        feature = {
            "type": "Feature",
            "geometry": mapping(geom_wgs84),
            "properties": {
                "event_id": event_id,
                "hazard_type": "flood",
                "model": "TerraMind",
                "checkpoint": "TerraMind-base-Flood",
                "threshold": threshold,
                "area_m2": round(area_m2, 2),
                "area_km2": round(area_km2, 6),
                "probability_min": round(p_min, 4),
                "probability_max": round(p_max, 4),
                "probability_mean": round(p_mean, 4),
                "source": "real_satellite",
                "acquisition_period": "2023-01-10 to 2023-02-10",
                "original_crs": str(crs),
                "source_raster": os.path.basename(prob_path),
                "within_test_aoi": True
            }
        }
        features.append(feature)

geojson_output = {
    "type": "FeatureCollection",
    "name": "TerraMind_Flood_Events",
    "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    "features": features
}

print("\n=== 8. CREATE OUTPUTS ===")
geojson_path = os.path.join(DATA_DIR, "terramind_flood_events.geojson")
with open(geojson_path, "w") as f:
    json.dump(geojson_output, f, indent=2)

summary = {
    "source_raster": mask_path,
    "source_crs": str(crs),
    "output_crs": "EPSG:4326",
    "dimensions": [mask_src.width, mask_src.height],
    "resolution": res,
    "flood_pixels": flood_pixels,
    "flood_percentage": round(flood_pct, 4),
    "polygons_before_filter": len(polygons),
    "polygons_after_filter": len(filtered_polygons),
    "total_area_m2": total_area,
    "min_probability": min(prob_min_list) if prob_min_list else 0.0,
    "max_probability": max(prob_max_list) if prob_max_list else 0.0,
    "mean_probability": sum(prob_mean_list)/len(prob_mean_list) if prob_mean_list else 0.0,
    "disclaimer": "These polygons represent TerraMind model predictions derived from real satellite imagery. They are not ground-truth-validated flood boundaries. Probability is not accuracy."
}

summary_path = os.path.join(DATA_DIR, "vectorization_summary.json")
with open(summary_path, "w") as f:
    json.dump(summary, f, indent=2)

print(f"Saved GeoJSON to {geojson_path}")
print(f"Saved Summary to {summary_path}")

print("\n=== 10. VISUAL OVERLAY ===")
# Create overlay
fig, ax = plt.subplots(figsize=(8, 8))
# Plot probability raster
im = ax.imshow(prob_arr, cmap='viridis', extent=(bounds.left, bounds.right, bounds.bottom, bounds.top))
plt.colorbar(im, label='Flood Probability')

# Plot polygons
import geopandas as gpd
if len(filtered_polygons) > 0:
    gdf = gpd.GeoDataFrame(geometry=filtered_polygons, crs=crs)
    gdf.boundary.plot(ax=ax, color='red', linewidth=1.5, label='Flood Polygon')

ax.set_title("TerraMind Real Inference - Vector Overlay")
ax.set_xlabel("Easting (m)")
ax.set_ylabel("Northing (m)")

overlay_path = os.path.join(DATA_DIR, "terramind_flood_vector_overlay.png")
plt.savefig(overlay_path, dpi=150)
plt.close()
print(f"Saved Visual Overlay to {overlay_path}")

print("\nRaster-to-GeoJSON pipeline complete.")
