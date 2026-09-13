# TerraMind Raster-to-GeoJSON Vectorization Report

## 1. Input Raster and Mask Paths
- **Probability Raster:** `ai-service/test_outputs/terramind_real_data/terramind_flood_probability.tif`
- **Mask Raster:** `ai-service/test_outputs/terramind_real_data/terramind_flood_mask.tif`

## 2-5. Raster Properties
- **CRS:** `EPSG:32644` (WGS 84 / UTM zone 44N)
- **Raster Dimensions:** 224 × 224 pixels
- **Pixel Resolution:** 10m × 10m

## 6-8. Threshold & Flood Pixels
- **Threshold:** `0.50` (Analysis threshold only; not ground-truth calibrated)
- **Flood Pixel Count:** 2,763
- **Flood Percentage:** 5.51%

## 9-11. Polygon Generation & Area Filter
- **Polygon count before filtering:** 49
- **Polygon count after filtering:** 30
- **Filter Applied:** Polygons < 1000 m² were removed to suppress sub-pixel noise.
- **Total Polygon Area:** 268,700.00 m² (approx 0.27 km²)

## 12. Geometry Validity
- **Valid Geometries:** All 49 initial polygons were valid out of the box (0 invalid, 0 repaired).
- **Masking:** Geometries matched the exact spatial cell boundaries of the raster.

## 13-14. GeoJSON Output Attributes
- **Output GeoJSON CRS:** `EPSG:4326` (WGS 84)
- **Event IDs:** `TM_FLOOD_001` through `TM_FLOOD_030`
- **Data Encapsulation:** Polygons successfully saved into a standard `FeatureCollection` with all requested descriptive metadata preserved.

## 15. Probability Statistics (Across 30 Polygons)
- **Minimum observed polygon mean probability:** `0.5050`
- **Maximum observed polygon mean probability:** `0.8521`
- **Overall mean probability of valid flood polygons:** `~0.6300`

## 16-19. Critical Disclaimers & Strict Compliance
- **Real Satellite Source:** **YES** (Microsoft Planetary Computer STAC)
- **Ground Truth Validation:** **NO**
- **Accuracy Measured:** **NO**
- **Disclaimer:** *These polygons represent TerraMind model predictions derived from real satellite imagery. They are not ground-truth-validated flood boundaries. Probability is not accuracy.*

## 20. Generated Output Files
- **Test Script:** `ai-service/test_terramind_raster_to_geojson.py`
- **Vector GeoJSON:** `ai-service/test_outputs/terramind_real_data/terramind_flood_events.geojson`
- **Vectorization Summary:** `ai-service/test_outputs/terramind_real_data/vectorization_summary.json`
- **Visual Overlay:** `ai-service/test_outputs/terramind_real_data/terramind_flood_vector_overlay.png`
- **This Report:** `ai-service/terramind_real_data_vectorization_report.md`

## 21-23. Regression Tests (System Health)
- **FastAPI Status (`/health`):** `HTTP 200 OK`
- **DeepSeek/LangChain Status:** `HTTP 200 OK`
- **Node.js Status:** `HTTP 200 OK`

## 24. Limitations
- Single pixel noise/boundary edge anomalies exist in standard semantic segmentation output. A 1000 m² filter successfully pruned tiny fragmented outputs but left the main contiguous shapes.
- Generating bounding polygons around raster cells naturally produces a stair-step geometry (Manhattan geometry). In a production pipeline, this might be simplified/smoothed for rendering, but was strictly preserved here for audit fidelity.
