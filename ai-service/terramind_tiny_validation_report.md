# TerraMind Tiny Validation Report

## Checkpoint Details
- **Official Repository:** `ibm-esa-geospatial/TerraMind-1.0-tiny`
- **Checkpoint Filename:** `TerraMind_v1_tiny.pt`
- **File Size:** `202.06 MB`
- **SHA256:** `e56ea9ebcd4451078b9ca4893d5cd8a89bbee376ae16829c3e7fbbbc76de0eba`

## Environment Versions
- **TerraTorch Version:** `1.2.13`
- **PyTorch Version:** `2.14.0+cpu`
- **Python Version:** `3.12.8`
- **CUDA Availability:** `False`

## Model Architecture & Smoke Test
- **Model Parameter Count:** `5,481,600`
- **Synthetic Input Shape:** `{'image': torch.Size([1, 3, 224, 224])}`
- **Output Structure:** List of 12 tensors (one per encoder block)
- **First Element Shape:** `torch.Size([1, 196, 192])` (14x14 patches = 196)
- **CPU Inference Time:** `~0.04 seconds`
- **Output Validity:** All output values are finite (`torch.isfinite() == True`)

## Disclaimer & Constraints
- **Synthetic Data:** This was purely a synthetic smoke test using standard `torch.randn` distributions.
- **No Real Imagery:** Real satellite imagery was **NOT** used. 
- **Not a Detector:** TerraMind Tiny is a geospatial foundation encoder. It is **NOT** being claimed as a standalone trained flood detector. 
