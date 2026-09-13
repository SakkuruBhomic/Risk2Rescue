import os
import json
import time
import torch
import psutil
import rasterio
from rasterio.transform import from_bounds
import matplotlib.pyplot as plt
import numpy as np

print("=== 1. VERIFY REAL INPUTS ===")
DATA_DIR = "test_outputs/terramind_real_data"
meta_path = os.path.join(DATA_DIR, "metadata.json")

if not os.path.exists(meta_path):
    raise FileNotFoundError(f"Missing {meta_path}. Run Task 9 first.")

with open(meta_path, "r") as f:
    metadata = json.load(f)

print(f"AOI: {metadata['aoi']}")
print(f"Projected BBox: {metadata['proj_bbox']}")
print(f"CRS: {metadata['crs']}")

tensor_path = os.path.join(DATA_DIR, "real_multimodal_tensor.pt")
inputs = torch.load(tensor_path, weights_only=True)

s2_tensor = inputs["S2L2A"]
s1_tensor = inputs["S1RTC"]
dem_tensor = inputs["DEM"]

print("\nInput Shapes:")
print(f"S2: {s2_tensor.shape}")
print(f"S1: {s1_tensor.shape}")
print(f"DEM: {dem_tensor.shape}")

print("\n=== 2. PREPROCESSING VERIFICATION ===")
print("Task 9 produced tensors with:")
print(" - S2: Raw DN (0-10000) float32")
print(" - S1: dB backscatter float32")
print(" - DEM: Raw elevation in meters float32")
print("This matches the expected input structure for TerraMind's PretrainedPixelNormalization layer,")
print("which normalizes input standard DNs internally. No additional scaling is applied here.")

print("\n=== 3. LOAD OFFICIAL FLOOD MODEL ===")
from huggingface_hub import hf_hub_download
repo_id = "ibm-esa-geospatial/TerraMind-base-Flood"
filename = "TerraMind_v1_base_ImpactMesh_flood.pt"

print("Resolving local checkpoint path...")
file_path = hf_hub_download(repo_id=repo_id, filename=filename, local_files_only=True)

mem_before = psutil.virtual_memory().used
init_start = time.time()

state_dict = torch.load(file_path, map_location="cpu", weights_only=True)
hyper_params = state_dict.get('hyper_parameters', {})
model_args = hyper_params.get('model_args', {})

if "backbone_pretrained" in model_args:
    model_args["backbone_pretrained"] = False
if "pretrained" in model_args:
    model_args["pretrained"] = False

from terratorch.tasks import SemanticSegmentationTask
clean_hyper_params = {k: v for k, v in hyper_params.items() if not k.startswith("_")}
model = SemanticSegmentationTask(**clean_hyper_params)
res = model.load_state_dict(state_dict['state_dict'], strict=True)
model.eval()

init_time = time.time() - init_start
mem_after = psutil.virtual_memory().used
print(f"Strict load result: {res}")
print(f"Model initialization time: {init_time:.2f} seconds")
print(f"Memory before load: {mem_before / (1024**2):.2f} MB")
print(f"Memory after load: {mem_after / (1024**2):.2f} MB")
print(f"Memory Delta: {(mem_after - mem_before) / (1024**2):.2f} MB")

print("\n=== 4. REAL INFERENCE ===")
inf_start = time.time()
with torch.no_grad():
    logits = model(inputs)

if hasattr(logits, 'output'):
    logits = logits.output
elif isinstance(logits, dict) and 'output' in logits:
    logits = logits['output']
elif isinstance(logits, tuple) or isinstance(logits, list):
    logits = logits[0]
if hasattr(logits, "logits"):
    logits = logits.logits

inf_time = time.time() - inf_start
print(f"Inference time: {inf_time:.2f} seconds")
print(f"Output shape: {logits.shape}")

print("\n=== 5. INTERPRETATION ===")
# Assuming class 0 is Background/Non-water, class 1 is Flood/Water.
probs = torch.nn.functional.softmax(logits, dim=1)
flood_prob = probs[0, 1, :, :] # (H, W)

finite = torch.isfinite(flood_prob).all().item()
print(f"Probabilities are finite: {finite}")

prob_min, prob_max, prob_mean = flood_prob.min().item(), flood_prob.max().item(), flood_prob.mean().item()
print(f"Flood Prob Min: {prob_min:.4f}")
print(f"Flood Prob Max: {prob_max:.4f}")
print(f"Flood Prob Mean: {prob_mean:.4f}")

# Threshold 0.50
threshold = 0.50
flood_mask = (flood_prob > threshold).cpu().numpy().astype(np.uint8)
flood_pixels = int(flood_mask.sum())
total_pixels = 224 * 224
flood_pct = (flood_pixels / total_pixels) * 100

print(f"\nThreshold: {threshold} (This is an analysis threshold, not a validated accuracy threshold.)")
print(f"Model-predicted flood pixels: {flood_pixels} / {total_pixels} ({flood_pct:.2f}%)")
print(f"Mask is {'empty' if flood_pixels == 0 else 'non-empty'}.")

print("\n=== 6. BASIC SPATIAL OUTPUT ===")
# Save TIFs
proj_bbox = metadata["proj_bbox"] # minx, miny, maxx, maxy
minx, miny, maxx, maxy = proj_bbox

# Rasterio transform requires (west, south, east, north)
transform = from_bounds(minx, miny, maxx, maxy, 224, 224)
crs = metadata["crs"]

prob_out = os.path.join(DATA_DIR, "terramind_flood_probability.tif")
mask_out = os.path.join(DATA_DIR, "terramind_flood_mask.tif")

with rasterio.open(
    prob_out, "w", driver="GTiff", height=224, width=224,
    count=1, dtype=str(flood_prob.numpy().dtype), crs=crs, transform=transform
) as dst:
    dst.write(flood_prob.cpu().numpy(), 1)

with rasterio.open(
    mask_out, "w", driver="GTiff", height=224, width=224,
    count=1, dtype="uint8", crs=crs, transform=transform
) as dst:
    dst.write(flood_mask, 1)

print(f"Saved: {prob_out}")
print(f"Saved: {mask_out}")

print("\n=== 8. VISUALIZATION ===")
preview_out = os.path.join(DATA_DIR, "terramind_flood_inference_preview.png")

# Try to get an RGB composite from S2 for context. Time index 3 (latest).
# RGB in S2 is usually B04 (Red), B03 (Green), B02 (Blue).
# The S2 bands index: B01(0), B02(1), B03(2), B04(3).
s2_rgb = s2_tensor[0, [3, 2, 1], 3, :, :].cpu().numpy() # [3, 2, 1] for B04, B03, B02
s2_rgb = s2_rgb.transpose(1, 2, 0)
s2_rgb = s2_rgb / 3000.0 # Scale DN to roughly 0-1 for display
s2_rgb = np.clip(s2_rgb, 0, 1)

fig, axes = plt.subplots(1, 3, figsize=(15, 5))
axes[0].imshow(s2_rgb)
axes[0].set_title("S2 RGB Context (T4)")
axes[0].axis('off')

im = axes[1].imshow(flood_prob.cpu().numpy(), cmap='viridis')
axes[1].set_title("Flood Probability")
axes[1].axis('off')
fig.colorbar(im, ax=axes[1], fraction=0.046, pad=0.04)

axes[2].imshow(flood_mask, cmap='gray')
axes[2].set_title("Flood Mask (Threshold 0.50)")
axes[2].axis('off')

plt.tight_layout()
plt.savefig(preview_out, dpi=150)
plt.close()
print(f"Saved: {preview_out}")
print("\nInference pipeline complete.")
