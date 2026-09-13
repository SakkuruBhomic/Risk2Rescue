import os
import hashlib
import time
import torch
from huggingface_hub import hf_hub_download
import terratorch
import psutil

def compute_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

print("=== 1. DOWNLOAD TERRAMIND TINY ===")
repo_id = "ibm-esa-geospatial/TerraMind-1.0-tiny"
filename = "TerraMind_v1_tiny.pt"
print(f"Repository: {repo_id}")
print(f"Filename: {filename}")

download_start = time.time()
file_path = hf_hub_download(repo_id=repo_id, filename=filename)
download_time = time.time() - download_start

file_size = os.path.getsize(file_path)
print(f"Downloaded to: {file_path}")
print(f"File Size: {file_size / (1024*1024):.2f} MB")
print(f"SHA256: {compute_sha256(file_path)}")
print(f"Download took: {download_time:.2f} seconds")

print("\n=== 2. LOAD TERRAMIND TINY ===")
print("Loading model via TerraTorch...")
# TerraTorch generic load:
# Prithvi models are loaded typically using PrithviModelFactory or similar.
# The user said: "Expected TerraTorch model identifier: terramind_v1_tiny"
# Let's check how terratorch handles it. Since it's a foundation model, 
# it might be an encoder. Let's try terratorch.models.PrithviModelFactory or just model_factory.
# Actually, the user says "expected TerraTorch model identifier: terramind_v1_tiny".
try:
    from terratorch.models.backbones.terramind.model.terramind_register import terramind_v1_tiny
    model = terramind_v1_tiny(pretrained=True)
except Exception as e:
    print(f"Failed direct model factory load: {e}")
    print("Falling back to raw PyTorch load for inspection...")
    model = torch.load(file_path, map_location="cpu", weights_only=True)

if isinstance(model, torch.nn.Module):
    param_count = sum(p.numel() for p in model.parameters())
    print(f"Model loaded successfully as nn.Module. Parameters: {param_count:,}")
else:
    # It might just be a dict (state_dict) if loaded raw
    print(f"Model loaded as {type(model)}. (Likely state_dict)")
    if isinstance(model, dict):
        # Count params from state dict roughly
        param_count = sum(v.numel() for v in model.values() if hasattr(v, 'numel'))
        print(f"Estimated parameters from state_dict: {param_count:,}")

print("\n=== 3. SYNTHETIC INFERENCE ===")
if isinstance(model, torch.nn.Module):
    model.eval()
    
    # TerraMind expects a dict of inputs by modality.
    # The default modalities for tiny usually include tok_sen2l2a@224 or untok_sen2l2a@224
    # The input shape is typically (B, T, C, H, W) or (B, C, H, W).
    inputs = [
        {"image": torch.randn(1, 12, 224, 224)},
        {"image": torch.randn(1, 6, 224, 224)},
        {"image": torch.randn(1, 3, 224, 224)},
        {"image": torch.randn(1, 1, 12, 224, 224)}
    ]
    
    success = False
    for i, synthetic_input in enumerate(inputs):
        try:
            if isinstance(synthetic_input, dict):
                shapes = {k: v.shape for k, v in synthetic_input.items()}
                print(f"Trying input shape: {shapes}")
            else:
                print(f"Trying input shape: {synthetic_input.shape}")
            start_mem = psutil.virtual_memory().used
            inf_start = time.time()
            with torch.no_grad():
                output = model(synthetic_input)
            inf_time = time.time() - inf_start
            end_mem = psutil.virtual_memory().used
            
            print("Inference successful!")
            if isinstance(output, torch.Tensor):
                print(f"Output shape: {output.shape}")
                finite = torch.isfinite(output).all().item()
                print(f"Output is finite: {finite}")
                print(f"Min: {output.min().item():.4f}, Max: {output.max().item():.4f}, Mean: {output.mean().item():.4f}")
            elif isinstance(output, tuple) or isinstance(output, list):
                print(f"Output is {type(output)} of length {len(output)}")
                print(f"First element shape: {output[0].shape}")
                finite = torch.isfinite(output[0]).all().item()
                print(f"First element is finite: {finite}")
            else:
                print(f"Output type: {type(output)}")
                
            print(f"Inference time: {inf_time:.4f} seconds")
            print(f"Memory delta: {(end_mem - start_mem) / (1024*1024):.2f} MB")
            success = True
            break
        except Exception as e:
            if isinstance(synthetic_input, dict):
                shapes = {k: v.shape for k, v in synthetic_input.items()}
                print(f"Input shape {shapes} failed: {e}")
            else:
                print(f"Input shape {synthetic_input.shape} failed: {e}")
            
    if not success:
        print("All synthetic input shapes failed.")
else:
    print("Cannot run inference on raw state_dict without model class.")
