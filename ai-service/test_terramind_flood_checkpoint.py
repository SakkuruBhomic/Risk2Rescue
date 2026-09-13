import os
import hashlib
import time
import torch
import psutil
from huggingface_hub import hf_hub_download

def compute_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

print("=== 1. DOWNLOAD TERRAMIND FLOOD CHECKPOINT ===")
repo_id = "ibm-esa-geospatial/TerraMind-base-Flood"
filename = "TerraMind_v1_base_ImpactMesh_flood.pt"
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

print("\n=== 2. LOAD FLOOD MODEL ===")
print("Loading model via TerraTorch...")
# The official Flood model is a segmentation model using the 'terramind_v1_base' backbone
# and an architecture such as U-Net. However, the exact factory configuration could be
# a specialized config file or we can manually instantiate it if `build_model` expects a certain string.
# Since we just want to verify state-dict and parameter loading, we'll try torch.load first to inspect
# what the state_dict keys are, and then build the generic model if possible, or use the raw state_dict for stats.

mem_before = psutil.virtual_memory().used
init_start = time.time()

# First let's load the state dict to inspect it
state_dict = torch.load(file_path, map_location="cpu", weights_only=True)
hyper_params = state_dict.get('hyper_parameters', {})
model_args = hyper_params.get('model_args', {})

# The user explicitly said: "If the official configuration requires pretrained=False 
# in a nested backbone argument to prevent unintended secondary weight downloads, 
# use the correct configuration and document it."
if "backbone_pretrained" in model_args:
    print("Modifying model_args to set backbone_pretrained=False to prevent secondary downloads.")
    model_args["backbone_pretrained"] = False
if "pretrained" in model_args:
    model_args["pretrained"] = False

try:
    from terratorch.tasks import SemanticSegmentationTask
    
    # We instantiate the model with the exact hyper-parameters found in the checkpoint, 
    # but with pretrained=False to avoid re-downloading the base model weights.
    # The checkpoint already contains all trained weights for backbone + neck + decoder.
    clean_hyper_params = {k: v for k, v in hyper_params.items() if not k.startswith("_")}
    
    model = SemanticSegmentationTask(**clean_hyper_params)
    
    # Strictly load state_dict
    res = model.load_state_dict(state_dict['state_dict'], strict=True)
    print(f"State dict loaded successfully! Strict load result: {res}")
    
    # Check parameter count
    param_count = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {param_count:,}")
    
    model.eval()
    init_time = time.time() - init_start
    mem_after = psutil.virtual_memory().used
    print(f"Model initialization time: {init_time:.2f} seconds")
    print(f"Memory before load: {mem_before / (1024**2):.2f} MB")
    print(f"Memory after load: {mem_after / (1024**2):.2f} MB")

    print("\n=== 3. SYNTHETIC MULTIMODAL INPUT ===")
    # S2: [1, 12, 4, 224, 224] -> Wait, the model expects dict or tensor? 
    # SemanticSegmentationTask forward usually expects a dict, or if wrapped, just inputs.
    # TerraMind spatio-temporal expects dict of modalities. Let's trace.
    s2_input = torch.randn(1, 1, 12, 4, 224, 224) if "1.5" in model_args.get("backbone", "") else torch.randn(1, 12, 4, 224, 224) 
    # Wait, in the config `backbone_modalities: ['S2L2A', 'S1RTC', 'DEM']`.
    # TerraTorch's pixel_wise_model passes the dict keys.
    # The warning said "Unknown input modality: untok_sen2l2a@224"
    # Let's try S2L2A, S1RTC, DEM, or image
    inputs = {
        "S2L2A": torch.randn(1, 12, 4, 224, 224),
        "S1RTC": torch.randn(1, 2, 4, 224, 224),
        "DEM": torch.randn(1, 1, 4, 224, 224)
    }
    
    # Try different keys to see what works
    inputs_v2 = {
        "tok_sen2l2a@224": torch.randn(1, 12, 4, 224, 224),
        "tok_sen1rtc@224": torch.randn(1, 2, 4, 224, 224),
        "tok_dem@224": torch.randn(1, 1, 4, 224, 224)
    }
    print(f"Synthetic Input modalities: {list(inputs.keys())}")
    for k, v in inputs.items():
        print(f" - {k}: {v.shape}")

    print("\n=== 4. REAL MODEL FORWARD PASS ===")
    inf_start = time.time()
    try:
        with torch.no_grad():
            logits = model(inputs)
    except Exception as e:
        print(f"Failed with S2L2A keys: {e}")
        print("Falling back to tok_* keys")
        with torch.no_grad():
            logits = model(inputs_v2)
    inf_time = time.time() - inf_start
    
    if hasattr(logits, 'output'):
        logits = logits.output
    elif isinstance(logits, dict) and 'output' in logits:
        logits = logits['output']
    elif isinstance(logits, tuple) or isinstance(logits, list):
        logits = logits[0]

    if hasattr(logits, "logits"):
        logits = logits.logits

    probs = torch.nn.functional.softmax(logits, dim=1)
    print(f"Output shape: {logits.shape}")
    print(f"Inference time: {inf_time:.4f} seconds")
    print(f"Logits min/max/mean: {logits.min().item():.4f}, {logits.max().item():.4f}, {logits.mean().item():.4f}")
    print(f"Probs min/max/mean: {probs.min().item():.4f}, {probs.max().item():.4f}, {probs.mean().item():.4f}")
    finite = torch.isfinite(logits).all().item()
    print(f"Output is finite: {finite}")
    
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed full model execution: {e}")
