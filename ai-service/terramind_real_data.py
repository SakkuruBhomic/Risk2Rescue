import os
import json
import time
import torch
import pystac_client
import planetary_computer
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from pyproj import Transformer
import numpy as np
from datetime import timedelta

OUTPUT_DIR = "test_outputs/terramind_real_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Define AOI and STAC query
AOI_NAME = "Godavari River Basin / Rajahmundry-Dowleswaram"
# A 2.24km x 2.24km area needs a bounding box. 
# We'll use a center point in WGS84 and convert to UTM Zone 44N (EPSG:32644)
center_lon, center_lat = 81.775, 16.925
transformer_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32644", always_xy=True)
transformer_to_wgs = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)

cx, cy = transformer_to_utm.transform(center_lon, center_lat)
# 224 pixels at 10m/pixel = 2240m. 
# Half width = 1120m
minx, maxx = cx - 1120, cx + 1120
miny, maxy = cy - 1120, cy + 1120

# WGS84 bbox for STAC search
min_lon, min_lat = transformer_to_wgs.transform(minx, miny)
max_lon, max_lat = transformer_to_wgs.transform(maxx, maxy)
wgs84_bbox = [min_lon, min_lat, max_lon, max_lat]
proj_bbox = [minx, miny, maxx, maxy]

print(f"AOI: {AOI_NAME}")
print(f"WGS84 BBox: {wgs84_bbox}")
print(f"Projected (EPSG:32644) BBox: {proj_bbox}")

# 2. STAC Search
print("\n=== Searching STAC ===")
catalog = pystac_client.Client.open(
    "https://planetarycomputer.microsoft.com/api/stac/v1",
    modifier=planetary_computer.sign_inplace,
)

# S2
s2_search = catalog.search(
    collections=["sentinel-2-l2a"],
    bbox=wgs84_bbox,
    datetime="2023-01-01/2024-09-30",
    query={"eo:cloud_cover": {"lt": 10}}
)
s2_items = list(s2_search.items())
s2_items = sorted(s2_items, key=lambda x: x.datetime)
if len(s2_items) < 4:
    raise ValueError("Not enough S2 items found.")

s2_selected = s2_items[:4] # Take first 4 clear ones
print("Selected S2 Items:")
for item in s2_selected:
    print(f" - {item.id} | Date: {item.datetime} | Cloud: {item.properties.get('eo:cloud_cover')}%")

# S1
s1_selected = []
print("\nSelected S1 Items:")
for s2_item in s2_selected:
    # Find S1 item closest in time
    dt = s2_item.datetime
    # search +/- 7 days
    start_dt = dt - timedelta(days=7)
    end_dt = dt + timedelta(days=7)
    time_str = f"{start_dt.isoformat()}/{end_dt.isoformat()}"
    
    s1_search = catalog.search(
        collections=["sentinel-1-rtc"],
        bbox=wgs84_bbox,
        datetime=time_str
    )
    s1_items = list(s1_search.items())
    if not s1_items:
        raise ValueError(f"No S1 items found near {dt}")
    # pick the first one
    s1_item = s1_items[0]
    s1_selected.append(s1_item)
    print(f" - {s1_item.id} | Date: {s1_item.datetime}")

# DEM
print("\nSelected DEM Item:")
dem_search = catalog.search(collections=["cop-dem-glo-30"], bbox=wgs84_bbox)
dem_items = list(dem_search.items())
if not dem_items:
    raise ValueError("No DEM items found.")
dem_item = dem_items[0]
print(f" - {dem_item.id}")

# 3. Download / Read and Crop
print("\n=== Preprocessing Data ===")
s2_bands = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"]
s1_bands = ["vv", "vh"]

def read_crop_resample(asset_href, dst_crs="EPSG:32644", dst_transform=None, width=224, height=224):
    """Read a window from an asset using VRT for reprojection/resampling."""
    # We construct a VRT that aligns with our target grid
    with rasterio.open(asset_href) as src:
        # Default fallback if no transform provided
        vrt_options = {
            'crs': dst_crs,
            'transform': dst_transform,
            'width': width,
            'height': height,
            'resampling': Resampling.bilinear
        }
        with WarpedVRT(src, **vrt_options) as vrt:
            # Read the whole VRT since it's already scoped to our width/height and transform
            data = vrt.read(1)
            return data

# The transform for our 224x224 grid at 10m resolution starting at minx, maxy
from rasterio.transform import from_origin
dst_transform = from_origin(minx, maxy, 10, 10)

s2_tensors = []
for idx, item in enumerate(s2_selected):
    print(f"Processing S2 item {idx+1}/4...")
    bands_data = []
    for b in s2_bands:
        href = item.assets[b].href
        data = read_crop_resample(href, dst_transform=dst_transform)
        # S2 L2A is usually scaled by 10000. 
        # TerraMind pre-training mean/std expect the raw DN values (e.g., 0-10000).
        # "Use the official TerraMind/TerraTorch configuration or documented preprocessing."
        # We'll just keep them as float32 in their original scale (DN).
        bands_data.append(data.astype(np.float32))
    s2_tensors.append(np.stack(bands_data, axis=0)) # Shape: (12, 224, 224)
s2_tensor = np.stack(s2_tensors, axis=1) # Shape: (12, 4, 224, 224)
s2_tensor = torch.from_numpy(s2_tensor).unsqueeze(0) # Shape: (1, 12, 4, 224, 224)

s1_tensors = []
for idx, item in enumerate(s1_selected):
    print(f"Processing S1 item {idx+1}/4...")
    bands_data = []
    for b in s1_bands:
        href = item.assets[b].href
        data = read_crop_resample(href, dst_transform=dst_transform)
        # S1 RTC is typically linear backscatter or dB. Planetary computer provides linear.
        # Often converted to dB: 10 * log10(DN). TerraMind pre-training means are around -12, 
        # so it definitely expects dB.
        # We apply dB conversion:
        # Prevent log(0)
        data = np.clip(data, 1e-7, None)
        data_db = 10 * np.log10(data)
        bands_data.append(data_db.astype(np.float32))
    s1_tensors.append(np.stack(bands_data, axis=0))
s1_tensor = np.stack(s1_tensors, axis=1) # Shape: (2, 4, 224, 224)
s1_tensor = torch.from_numpy(s1_tensor).unsqueeze(0)

print("Processing DEM...")
dem_href = dem_item.assets["data"].href
dem_data = read_crop_resample(dem_href, dst_transform=dst_transform)
dem_data = dem_data.astype(np.float32)
# DEM is static, replicate it across the 4 timesteps to match (1, 1, 4, 224, 224) shape.
dem_tensors = [dem_data for _ in range(4)]
dem_tensor = np.stack(dem_tensors, axis=0) # (4, 224, 224)
dem_tensor = np.expand_dims(dem_tensor, axis=0) # (1, 4, 224, 224)
dem_tensor = torch.from_numpy(dem_tensor).unsqueeze(0) # (1, 1, 4, 224, 224)

# 4. Validation
print("\n=== TENSOR VALIDATION ===")
print(f"S2 Shape: {s2_tensor.shape} | Min: {s2_tensor.min():.2f} | Max: {s2_tensor.max():.2f} | Mean: {s2_tensor.mean():.2f} | Finite: {torch.isfinite(s2_tensor).all().item()}")
print(f"S1 Shape: {s1_tensor.shape} | Min: {s1_tensor.min():.2f} | Max: {s1_tensor.max():.2f} | Mean: {s1_tensor.mean():.2f} | Finite: {torch.isfinite(s1_tensor).all().item()}")
print(f"DEM Shape: {dem_tensor.shape} | Min: {dem_tensor.min():.2f} | Max: {dem_tensor.max():.2f} | Mean: {dem_tensor.mean():.2f} | Finite: {torch.isfinite(dem_tensor).all().item()}")

# 5. Save Artifacts
metadata = {
    "aoi": AOI_NAME,
    "crs": "EPSG:32644",
    "wgs84_bbox": wgs84_bbox,
    "proj_bbox": proj_bbox,
    "stac_api": "https://planetarycomputer.microsoft.com/api/stac/v1",
    "collections": ["sentinel-2-l2a", "sentinel-1-rtc", "cop-dem-glo-30"],
    "s2_items": [{"id": item.id, "date": item.datetime.isoformat(), "cloud_cover": item.properties.get("eo:cloud_cover")} for item in s2_selected],
    "s1_items": [{"id": item.id, "date": item.datetime.isoformat()} for item in s1_selected],
    "dem_item": dem_item.id,
    "tensor_shapes": {
        "S2": list(s2_tensor.shape),
        "S1": list(s1_tensor.shape),
        "DEM": list(dem_tensor.shape)
    }
}

with open(os.path.join(OUTPUT_DIR, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

preprocessing = {
    "S2": {
        "bands": s2_bands,
        "resampling": "bilinear",
        "transformation": "raw DN values",
        "spatial_resolution": "10m"
    },
    "S1": {
        "bands": s1_bands,
        "resampling": "bilinear",
        "transformation": "10 * log10(DN) for dB",
        "spatial_resolution": "10m"
    },
    "DEM": {
        "resampling": "bilinear",
        "transformation": "raw elevation",
        "spatial_resolution": "10m",
        "temporal": "replicated 4x"
    }
}
with open(os.path.join(OUTPUT_DIR, "preprocessing_summary.json"), "w") as f:
    json.dump(preprocessing, f, indent=2)

multimodal_dict = {
    "S2L2A": s2_tensor,
    "S1RTC": s1_tensor,
    "DEM": dem_tensor
}
torch.save(multimodal_dict, os.path.join(OUTPUT_DIR, "real_multimodal_tensor.pt"))

print(f"\nArtifacts saved to {OUTPUT_DIR}/")
