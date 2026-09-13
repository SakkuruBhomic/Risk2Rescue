# TerraMind Flood Checkpoint Validation Report

## Checkpoint Details
- **Official Repository:** `ibm-esa-geospatial/TerraMind-base-Flood`
- **Revision / Snapshot:** `1e4b2429d17234922f8d92beb0d725af4db85c08`
- **Checkpoint Filename:** `TerraMind_v1_base_ImpactMesh_flood.pt`
- **Download Status:** SUCCESS
- **File Size:** `642.01 MB`
- **SHA256 Checksum:** `22627584c2db618c2f6ddb64b411a95762a893becb25104e3f66bfebecaa71e9`
- **Local Cache Path:** `~/.cache/huggingface/hub/models--ibm-esa-geospatial--TerraMind-base-Flood/...`

## Model Configuration
- **Model Architecture:** Semantic Segmentation Task (TerraMind V1 Base Backbone + Neck + UNetDecoder)
- **Modalities Configured:** `S2L2A` (12-band), `S1RTC` (2-band), `DEM` (1-band)
- **Temporal Structure:** 4 Timestamps (spatio-temporal model)
- **Parameter Count:** `167,800,450`
- **State-dict Alignment:** `Strict load result: <All keys matched successfully>`

## Synthetic Testing & Memory
- **Input Shapes:** 
  - `S2L2A`: `torch.Size([1, 12, 4, 224, 224])`
  - `S1RTC`: `torch.Size([1, 2, 4, 224, 224])`
  - `DEM`: `torch.Size([1, 1, 4, 224, 224])`
- **Initialization Time:** `10.52 seconds`
- **Inference Time (Forward Pass):** `1.72 seconds`
- **Memory Usage:** 
  - Before load: `9511.46 MB`
  - After load: `11206.13 MB` (Approx. 1.7 GB increase)

## Output Verification
- **Output Shape:** `torch.Size([1, 2, 224, 224])` (Batch, Classes, Height, Width)
- **Flood Probability Statistics (Softmax):** 
  - Min: `0.0000`
  - Max: `1.0000`
  - Mean: `0.5000`
- **Finite Output:** `YES`
- **CUDA Available:** `NO` (Executed fully on CPU mode)

## Important Disclaimers
> **WARNING:** Real satellite imagery has **NOT** yet been processed. 
> The flood probability output shown above is purely a model prediction/probability generated from random synthetic tensors, **NOT** measured accuracy on real data.

## Regression Checks
- **FastAPI /health:** `HTTP 200 OK`
- **DeepSeek/LangChain Endpoint:** `HTTP 200 OK` (Responded with 'OK')
- **Node.js Frontend:** `HTTP 200 OK`

## Files Created/Modified
- `ai-service/test_terramind_flood_checkpoint.py`
- `ai-service/terramind_flood_checkpoint_report.md`
