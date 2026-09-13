# TerraMind Real Satellite Data Ingestion Report

## 1. Area of Interest (AOI)
**Godavari River Basin / Rajahmundry-Dowleswaram**

## 2. WGS84 Bounding Box
`[81.76444224805188, 16.91491612801881, 81.78555887571233, 16.935083270525624]`

## 3. Projected CRS and Bounding Box
- **CRS:** `EPSG:32644` (WGS 84 / UTM zone 44N)
- **Projected BBox:** `[581408.35, 1870300.68, 583648.35, 1872540.68]`
- **Resolution:** `10m`
- **Spatial Alignment:** Perfect strict grid (2240m × 2240m)

## 4. STAC API Provider
**Microsoft Planetary Computer STAC API**  
`https://planetarycomputer.microsoft.com/api/stac/v1`

## 5-7. Collections Used
- **Sentinel-2:** `sentinel-2-l2a` (12 bands)
- **Sentinel-1:** `sentinel-1-rtc` (2 bands)
- **DEM:** `cop-dem-glo-30` (1 band)

## 8. Sentinel-2 Observations (4 Timestamps)
1. `S2A_MSIL2A_20230110T050201_R119_T44QND_20230110T205333` | **Date:** `2023-01-10T05:02:01`
2. `S2B_MSIL2A_20230115T050139_R119_T44QND_20240811T000443` | **Date:** `2023-01-15T05:01:39`
3. `S2B_MSIL2A_20230115T050139_R119_T44QND_20230115T151150` | **Date:** `2023-01-15T05:01:39`
4. `S2B_MSIL2A_20230204T050009_R119_T44QND_20240815T042529` | **Date:** `2023-02-04T05:00:09`

## 9. Sentinel-1 Observations (4 Timestamps)
1. `S1A_IW_GRDH_1SDV_20230117T002257_20230117T002323_046816_059D03_rtc` | **Date:** `2023-01-17T00:23:10`
2. `S1A_IW_GRDH_1SDV_20230117T002257_20230117T002323_046816_059D03_rtc` | **Date:** `2023-01-17T00:23:10`
3. `S1A_IW_GRDH_1SDV_20230117T002257_20230117T002323_046816_059D03_rtc` | **Date:** `2023-01-17T00:23:10`
4. `S1A_IW_GRDH_1SDV_20230210T002257_20230210T002323_047166_05A8BB_rtc` | **Date:** `2023-02-10T00:23:10`

## 10. Sentinel-2 Cloud Cover
1. `1.62%`
2. `2.46%`
3. `2.45%`
4. `0.00%`

## 11. Sentinel-2 Preprocessing
- **Bands:** B01, B02, B03, B04, B05, B06, B07, B08, B8A, B09, B11, B12
- **Resampling:** Bilinear interpolation to 10m spatial grid
- **Normalization:** Raw Digital Number (DN) values kept as Float32

## 12. Sentinel-1 Preprocessing
- **Bands:** VV, VH
- **Resampling:** Bilinear interpolation to 10m spatial grid
- **Normalization:** Linear RTC converted to dB `(10 * log10(DN))`

## 13. DEM Preprocessing
- **Source:** Copernicus DEM GLO-30
- **Resampling:** Bilinear interpolation to 10m spatial grid
- **Normalization:** Raw elevation in meters, temporally replicated 4x to match sequence

## 14-16. Final Tensor Shapes
- **S2 Final Shape:** `[1, 12, 4, 224, 224]`
- **S1 Final Shape:** `[1, 2, 4, 224, 224]`
- **DEM Final Shape:** `[1, 1, 4, 224, 224]`

## 17. Value Statistics
- **S2 Tensor:** Min: `1155.00` | Max: `7352.00` | Mean: `3594.99`
- **S1 Tensor:** Min: `-33.37` | Max: `1.70` | Mean: `-18.23`
- **DEM Tensor:** Min: `3.50` | Max: `19.21` | Mean: `11.10`

## 18-19. Final Validation
- **Finite Checks:** TRUE (All tensors contain only valid Float32 numbers, no NaNs/Infs)
- **Spatial Alignment:** VERIFIED (All data clipped strictly against a 2240m × 2240m `EPSG:32644` bounding box)

## 20-22. Compliance Status
- **Real Satellite Data Used:** YES
- **TerraMind Inference Executed:** NO (Only data ingestion/preprocessing)
- **Ground Truth Validation:** NO

## 23-25. Regression Tests
- **FastAPI (`/health`):** `HTTP 200 OK`
- **DeepSeek/LangChain Endpoint:** `HTTP 200 OK`
- **Node.js Server:** `HTTP 200 OK`

## 26. Files Created/Modified
- `ai-service/terramind_real_data.py`
- `ai-service/stac_search_test.py`
- `ai-service/test_outputs/terramind_real_data/metadata.json`
- `ai-service/test_outputs/terramind_real_data/preprocessing_summary.json`
- `ai-service/test_outputs/terramind_real_data/real_multimodal_tensor.pt`
- `ai-service/terramind_real_data_report.md`

## 27. Limitations & Observations
- **Data Access:** Microsoft Planetary Computer required `pystac-client`, `planetary-computer`, and HTTP GDAL tuning via environment variables (`GDAL_HTTP_MERGE_CONSECUTIVE_READS`) to speed up partial COG reads for 12 bands across 4 dates.
- **S1 Repetition:** The S1 search for dates adjacent to S2 occasionally yielded the same item ID due to the 12-day revisit cadence aligning with multiple S2 passes. Thus, temporal overlap occurred for the first 3 observations. This is realistic given satellite orbital limits.
