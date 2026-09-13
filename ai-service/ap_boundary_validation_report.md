# Andhra Pradesh Boundary Validation Report

## 1-2. Boundary Source
- **Boundary Source:** `india_land_boundary.geojson` (Existing project dataset)
- **Boundary File:** `ai-service/test_outputs/ap_boundary/andhra_pradesh_boundary.geojson`

## 3-5. Geometry & CRS
- **CRS:** `EPSG:4326` (Original)
- **Geometry Type:** Polygon
- **Boundary Validity:** `True` (Valid topology, single state feature)

## 6-7. Geographic Extent
- **AP Bounding Box (WGS84):** `[76.7656, 12.6210, 84.7681, 19.1300]`
- **Area Calculation Method:** Transformed temporarily to `EPSG:32644` (UTM Zone 44N equal-area mapping).
- **AP Projected Area:** ~163,117.33 sq km

## 8-11. Spatial Intersection Analysis
- **Flood Events Analyzed:** 30 (from Task 11)
- **Fully inside AP (100% intersection):** 30
- **Partially intersecting AP:** 0
- **Outside AP:** 0

## 12-14. AP Scoping & Filtering
- **Strict AP Filtering Rule:** `AP_EVENT_MIN_INTERSECTION_PERCENT = 100.0`
- **AP-scoped event count:** 30
- **Intersection percentage range:** `100.0%`
- All TerraMind-predicted polygons mapped within the Rajahmundry Sentinel AOI fall entirely within the confirmed state limits of Andhra Pradesh.

## 15. Output Files
- **Test Script:** `ai-service/test_ap_boundary_validation.py`
- **AP Boundary GeoJSON:** `ai-service/test_outputs/ap_boundary/andhra_pradesh_boundary.geojson`
- **AP Scoped Flood GeoJSON:** `ai-service/test_outputs/ap_boundary/terramind_flood_events_ap_scoped.geojson`
- **Visual Validation Overlay:** `ai-service/test_outputs/ap_boundary/ap_boundary_event_overlay.png`
- **This Report:** `ai-service/ap_boundary_validation_report.md`

## 16. State Constraint Verifications
- **Original flood GeoJSON unchanged:** **YES**

## 17-19. System Regression Checks
- **FastAPI Status (`/health`):** `HTTP 200 OK`
- **DeepSeek/LangChain Status:** `HTTP 200 OK`
- **Node.js Server Status:** `HTTP 200 OK`

## 20. Limitations & Disclaimers
- The area calculation method utilizes a single UTM zone projection (`EPSG:32644`) for standard intersection math. This introduces mild distortion at the far western edges of the full state boundary (which crosses into neighboring UTM zones), but it is mathematically precise for the local Godavari AOI and robust enough for polygon containment logic.
- **Critical Disclaimer:** *The Andhra Pradesh boundary is an administrative geographic scope, not a hazard prediction. TerraMind flood polygons were not modified during boundary validation.*
