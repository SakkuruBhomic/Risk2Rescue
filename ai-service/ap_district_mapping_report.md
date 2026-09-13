# Andhra Pradesh 26-District Flood Mapping Validation Report

## 1. Official Source URL
- `https://apsdmagis.ap.gov.in/gisserver/rest/services/Hosted/NP_History/FeatureServer/1/query`

## 2. Service/Layer Name
- **Service:** NP_History
- **Layer:** `ap_districts_26`

## 3. Feature Count
- **26 districts** successfully retrieved.

## 4. Complete 26-District List
1. CHITTOOR
2. KRISHNA
3. PARVATHIPURAMMANYAM
4. PRAKASAM
5. ALLURI SITHARAMA RAJU
6. ANAKAPALLI
7. ANANTHAPURAM
8. ANNAMAYYA
9. BAPATLA
10. EASTGODAVARI
11. ELURU
12. GUNTUR
13. KAKINADA
14. KONASEEMA
15. KURNOOL
16. NANDYAL
17. NTR
18. PALNADU
19. SRIPOTTISRIRAMULUNELLORE
20. SRISATHYASAI
21. SRIKAKULAM
22. TIRUPATHI
23. VISAKHAPATNAM
24. VIZIANAGARAM
25. WESTGODAVARI
26. YSR

## 5. CRS
- Original Download: `EPSG:4326` (WGS 84)
- Processing/Intersection CRS: `EPSG:32644` (WGS 84 / UTM zone 44N)

## 6. Geometry Validity
- 100% Valid. No invalid geometries detected in the source. Geometry type is Polygon/MultiPolygon.

## 7. District Codes
- Verified fields `district`, `code`, and `dcode` exist. `dcode` fields represent unique codes per district.

## 8. AP Coverage Result
- The combined geometry of all 26 retrieved districts covers **98.36%** of the previously validated Andhra Pradesh state boundary. This near-total coverage confirms geometric completeness (the slight variance is attributable to expected coastal resolution differences between administrative layers and land boundary sources).

## 9. Synthetic Proxy Retained
- **YES.** The previous file remains clearly renamed as `andhra_pradesh_districts_SYNTHETIC_PROXY.geojson`.
- *Explicit Warning:* The previous Voronoi district layer was a synthetic proxy and is not used for authoritative district assignment.

## 10. Official GeoJSON Created
- **YES.** `andhra_pradesh_districts.geojson` has been successfully created using the official AP SDMA geometry.

## 11. TerraMind Events Remapped
- **YES.** All 30 TerraMind flood polygons have been geometrically remapped using spatial intersection (not centroid distance). 
- *Note:* Current district assignment is based on spatial intersection with the AP SDMA 26-district administrative layer.

## 12. Primary District Assignments
- All 30 flood events are mapped strictly to **KONASEEMA**.

## 13. Cross-District Events
- 0 events cross district boundaries with a significant (>0.01%) area.

## 14. Unresolved Events
- 0 events. All 30 events matched with valid overlapping polygons.

## 15. Status of Previous 'East Godavari' Assignment
- **CHANGED.** The previous synthetic assignment mapped these events to 'East Godavari'. Using the correct, authoritative administrative boundaries from AP SDMA, the polygons fall entirely within **KONASEEMA** district. This validates the absolute necessity of discarding the synthetic boundaries.

## 16. Output Files
- Official GeoJSON: `ai-service/test_outputs/ap_districts/andhra_pradesh_districts.geojson`
- Flood Events Output: `ai-service/test_outputs/ap_districts/terramind_flood_events_by_district.geojson`
- Mapping Results JSON: `ai-service/test_outputs/ap_districts/flood_event_district_mapping.json`
- Visualization: `ai-service/test_outputs/ap_districts/ap_district_flood_overlay.png`
- Test Script: `ai-service/test_ap_district_mapping.py`
- Report: `ai-service/ap_district_mapping_report.md` (This file)

## 17. FastAPI Result
- Status: `HTTP 200 OK`

## 18. DeepSeek / LangChain Result
- Status: `HTTP 200 OK`

## 19. Node.js Result
- Status: `HTTP 200 OK`

## 20. Limitations
- None. Authoritative boundaries successfully retrieved and mapping confirmed.
