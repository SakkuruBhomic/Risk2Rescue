import sys
import psutil
import platform
import shutil
import torch
import torchvision
import torchgeo
import lightning
import diffusers
import terratorch

print("=== VERSIONS ===")
print("Python:", sys.version.split()[0])
print("PyTorch:", torch.__version__)
print("TorchVision:", torchvision.__version__)
print("TorchGeo:", torchgeo.__version__)
print("Lightning:", lightning.__version__)
print("Diffusers:", diffusers.__version__)


print("\n=== IMPORT VERIFICATION ===")
print("Torch import: Success")
print("Torchvision import: Success")
print("Torchgeo import: Success")
print("Lightning import: Success")
print("Diffusers import: Success")
print("TerraTorch import: Success")

print("\n=== CPU TENSOR TEST ===")
t = torch.ones(2, 2)
print("Tensor created successfully:", t.shape)

print("\n=== CUDA CHECK ===")
cuda_available = torch.cuda.is_available()
print("CUDA Available:", cuda_available)

print("\n=== TERRATORCH API CHECK ===")
# Check for model factory
print("TerraTorch Models API:", dir(terratorch.models))
print("PrithviModelFactory Available:", hasattr(terratorch.models, 'PrithviModelFactory') or 'PrithviModelFactory' in dir(terratorch.models))
print("ModelFactory Available:", hasattr(terratorch.models, 'ModelFactory') or 'ModelFactory' in dir(terratorch.models))
print("Segmentation Model Supported:", hasattr(terratorch.models, 'SegmentationModel') or 'SegmentationModel' in dir(terratorch.models))

print("\n=== RESOURCE CHECK ===")
print("System:", platform.system(), platform.release())
print("CPU:", platform.processor())
print("Logical Cores:", psutil.cpu_count(logical=True))
print("Physical Cores:", psutil.cpu_count(logical=False))
print("RAM (GB):", round(psutil.virtual_memory().total / (1024**3), 2))
disk = shutil.disk_usage("/")
print("Free Disk Space (GB):", round(disk.free / (1024**3), 2))
if cuda_available:
    print("GPU Model:", torch.cuda.get_device_name(0))
    print("VRAM (GB):", round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2))
else:
    print("GPU Model: N/A (CUDA not available to PyTorch CPU version)")
