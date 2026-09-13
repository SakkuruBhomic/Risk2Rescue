# TerraMind / TerraTorch Isolated Environment Report

## Environment Details
- **Environment Path:** `ai-service/.venv-terramind`
- **Python Version:** `Python 3.12.8`

## Installed Stack Versions (CPU Only)
- **TerraTorch:** Installed (API verified)
- **PyTorch:** `2.14.0+cpu`
- **TorchVision:** `0.29.0+cpu`
- **TorchGeo:** `0.9.0`
- **Lightning:** `2.6.6`
- **Diffusers:** `0.40.0`

## Hardware & Resources
- **System:** Windows 11
- **CPU:** Intel64 Family 6 Model 183 Stepping 1, GenuineIntel
- **Cores:** 16 Logical / 10 Physical
- **RAM:** 15.71 GB
- **Free Disk Space:** 153.4 GB
- **CUDA Availability:** `False` (CPU-only Torch installed as requested for compatibility)
- **GPU Model:** N/A (to PyTorch CPU edition)

## Verification Results
- **Import Verification:** Successfully imported `torch`, `torchvision`, `torchgeo`, `lightning`, `diffusers`, and `terratorch`.
- **Tensor Allocation:** Successfully created CPU tensor `torch.Size([2, 2])`.
- **TerraTorch APIs:** Successfully identified `terratorch.models` API components including `PrithviModelFactory`, `EncoderDecoderFactory`, and `ClayModelFactory`. 
- **Model Checkpoints:** No TerraMind model weights or checkpoints were downloaded during this task.

## Dependency Isolation Check (Original Stack)
The original `ai-service/venv` (Python 3.13) was not altered in any way.
- **FastAPI Endpoint:** HTTP 200 OK
- **Node.js `:3000`:** HTTP 200 OK
- **DeepSeek/LangChain Inference:** Successfully returned `"OK"` in 24.52 seconds. Original deepseek-r1:8b logic over CPU Ollama runtime remains completely unimpacted.
