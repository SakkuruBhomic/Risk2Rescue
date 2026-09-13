# TerraMind Real Inference Report

## 1-3. Real Input Artifacts & Preprocessing
- **Source Tensors:** `ai-service/test_outputs/terramind_real_data/real_multimodal_tensor.pt`
- **S2 Shape:** `[1, 12, 4, 224, 224]`
- **S1 Shape:** `[1, 2, 4, 224, 224]`
- **DEM Shape:** `[1, 1, 4, 224, 224]`
- **Preprocessing:** Tensors from Task 9 were kept strictly as generated (S2 raw DN, S1 dB, DEM raw elevation). The `terratorch` library's `PretrainedPixelNormalization` internally normalizes the unscaled DN inputs dynamically.

## 4-7. TerraMind Checkpoint & Initialization
- **Checkpoint:** `ibm-esa-geospatial/TerraMind-base-Flood` (`TerraMind_v1_base_ImpactMesh_flood.pt`)
- **Model Load Status:** SUCCESS
- **State-dict Alignment:** `Strict load result: <All keys matched successfully>` (Pretrained backbone auto-download bypassed)
- **Initialization Time:** 11.25 seconds

## 8-10. Real Inference Metrics
- **Real Inference Time:** 1.53 seconds
- **Memory Before Load:** 11,573.68 MB
- **Memory After Load:** 13,198.77 MB
- **Memory Delta:** 1,625.09 MB
- **Output Shape:** `[1, 2, 224, 224]`

## 11-15. Inference Results (Interpretation)
- **Flood Probability Minimum:** `0.0000`
- **Flood Probability Maximum:** `1.0000`
- **Flood Probability Mean:** `0.0550`
- **Threshold Used:** `0.50` *(This is an analysis threshold, not a validated accuracy threshold.)*
- **Flood Pixel Count:** 2,763 pixels (out of 50,176)
- **Flood Percentage:** `5.51%`
- **Mask State:** NON-EMPTY (Flood detected on the river/water bodies)

## 16-19. Strict Limitations & Compliance
- **Real satellite imagery processed:** **YES**
- **Ground truth validation performed:** **NO**
- **Accuracy measured:** **NO**
- **Important Disclaimer:** *Probability is not accuracy.* The output denotes the mathematical probability scores assigned by the network based on its pre-trained weights. Because this run lacks corresponding real-world ground truth data for the specific dates, it does not confirm the presence of actual emergency flood conditions. It merely proves the ingestion and inference pipelines operate correctly end-to-end.

## 20. Output Files Generated
1. **Probability TIFF:** `ai-service/test_outputs/terramind_real_data/terramind_flood_probability.tif`
2. **Binary Mask TIFF:** `ai-service/test_outputs/terramind_real_data/terramind_flood_mask.tif`
3. **Visualization:** `ai-service/test_outputs/terramind_real_data/terramind_flood_inference_preview.png`

## 21-23. System Health Checks
- **FastAPI Endpoint (`/health`):** `HTTP 200 OK`
- **DeepSeek/LangChain Stack:** `HTTP 200 OK`
- **Node.js Frontend Server:** `HTTP 200 OK`

## 24. Preprocessing & Temporal-Quality Limitations
- Data from the four observations span mid-January to mid-February 2023. This is not peak monsoon season for the Godavari Basin, so the detected "flood" pixels (~5.5%) largely correlate to the permanent water bodies (e.g. the Godavari River itself).
- S1 RTC spatial noise and ascending/descending inconsistencies can affect time-series correlation, although the model's 3D-CNN temporal attention layers are designed to smooth some of this noise.
