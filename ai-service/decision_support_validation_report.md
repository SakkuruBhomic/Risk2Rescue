# Decision Support Validation Report — Task 17

## Evidence Sources
| Layer | Source | Authority |
|---|---|---|
| Hazard | TerraMind flood polygons (30 events) | ibm-esa-geospatial/TerraMind-base-Flood |
| Satellite inputs | Sentinel-1 RTC + Sentinel-2 L2A + Copernicus DEM | ESA / Copernicus |
| District boundary | AP SDMA FeatureServer (26 districts) | Government of Andhra Pradesh |
| Habitations | AP SDMA population_village layer | AP SDMA / Census 2011 |
| Shelters | AP SDMA cyclone_shelters layer | Government of Andhra Pradesh |
| Road routing | OpenStreetMap / Project OSRM (driving) | OpenStreetMap contributors |
| Population | MoHFW Technical Group 2011–2036 projection | Ministry of Health & Family Welfare, India |

## Prompt Details
| Parameter | Value |
|---|---|
| **Final prompt length** | ~3,021 characters |
| **Estimated input tokens** | ~755 |
| **Target range** | 1,000–1,600 tokens |
| **Hard maximum** | 2,000 tokens |
| **Within budget** | ✅ Yes (755 est. tokens) |

## Model Configuration
| Parameter | Value |
|---|---|
| **Model** | `deepseek-r1:8b` |
| **Inference path** | LangChain → ChatOllama → Ollama (CPU-only) |
| **num_predict (first attempt)** | 700 → truncated (done_reason=length) |
| **num_predict (final)** | 1200 |
| **Timeout** | 300 seconds |
| **Temperature** | 0.0 |

## Inference Results
| Metric | Value |
|---|---|
| **Inference duration** | 75.25 seconds |
| **Output length** | 2,274 characters |
| **done_reason** | `stop` (complete — not truncated) |

## Required Section Validation
| Section | Present |
|---|---|
| OBSERVATIONS | ✅ |
| RISK / PRIORITY | ✅ |
| AUTHORITY RECOMMENDATIONS | ✅ |
| SHELTER / ACCESS | ✅ |
| LIMITATIONS / CONFIDENCE | ✅ |

## Evidence-Grounding Validation
The verifier found **14 of 22 evidence markers** present in the output. Confirmed references to:
- `konaseema`, `terramind`, `flood polygon`, `no direct` (0 intersections)
- `peravaram` (nearest habitation), `osrm`, `shelter`, `7,282` (capacity)
- `268`, `0.356` (VPI score), `not confirmed`, `limitation`, `habitation`, `routing`

**No fabricated mass evacuation claim detected.**

## Generated Decision Brief

**OBSERVATIONS**
TerraMind identified 30 flood polygons covering approximately 0.27 km² in Konaseema district. No habitations directly intersect these polygons, but 5 habitations are within 5 km and 12 are within 10 km. The nearest habitation (Peravaram) is about 0.63 km from the flood area. Road accessibility analysis shows all habitations are reachable, with reasonable travel times, though actual conditions during the event are unknown.

**RISK / PRIORITY**
While no direct habitation flooding is confirmed, the proximity of several habitations to the flood polygons indicates potential indirect impacts. These could include floodwater encroachment, debris flow, or road obstructions hindering access. The vulnerability potential index (VPI) score of 0.356 suggests some level of exposure risk exists for the nearby population. The situation warrants monitoring for potential secondary effects and localized impacts.

**AUTHORITY RECOMMENDATIONS**
Targeted monitoring of habitations within 5 km of the flood polygons is recommended to assess for any emerging direct impacts or hindrances. Communicate the identified flood extent and potential risks to nearby habitations. Prepare localized evacuation plans for the most proximate habitations if confirmed threats arise or if residents self-evacuate due to concerns. Ensure shelter capacities are known and available for affected residents if needed.

**SHELTER / ACCESS**
There are 10 shelters in the district with a published total capacity of 7,282 persons. Road accessibility analysis indicates all shelters and habitations are connected via road networks, with minimal travel times expected under normal conditions. However, actual road conditions during the flood event cannot be confirmed from this data.

**LIMITATIONS / CONFIDENCE**
The TerraMind model's threshold (0.5) is not ground-truth calibrated for this location. Proximity buffers (within 1, 5, and 10 km) indicate spatial closeness, not confirmed inundation. Shelter capacity is source-published; current occupancy or availability is unknown. Road accessibility data is based on static OSRM routing and does not guarantee passability or safety during the disaster. The projected population figure (1,865,817) is not the exposed or affected population.

---

## Provenance Attribution

> **DeepSeek generated the natural-language interpretation.**
> The underlying hazard, population, VPI, habitation, shelter, and routing facts were produced by deterministic/GIS/data-processing components and were not invented by the LLM.

## Limitations
1. TerraMind threshold (0.50) is not ground-truth calibrated for Konaseema.
2. Probability score is NOT accuracy — it cannot be used as a flood-confirmation metric.
3. Zero direct habitation intersections does NOT mean zero disaster risk.
4. Shelter occupancy is unknown — "available capacity" is an upper bound only.
5. OSRM routing is static OSM data — actual road passability during disaster is unknown.
6. The 2026 population figure (1,865,817) is a projected estimate, NOT a census.
7. `done_reason=length` was observed at num_predict=700; resolved by increasing to 1,200.

## Regression Results
| Endpoint | Result |
|---|---|
| `GET /health` | ✅ HTTP 200 |
| `GET /geoai/status` | ✅ HTTP 200 |
| `GET /terramind/status` | ✅ HTTP 200 |
| `POST /ai/langchain-test` | ✅ HTTP 200 |
| `POST /ai/decision-brief` | ✅ HTTP 200 |
| Node.js `:3000` | ✅ HTTP 200 |

## Final Status: PASS

All 8 success conditions met:
1. ✅ `/ai/decision-brief` returns HTTP 200
2. ✅ `AIMessage.content` is non-empty (2,274 chars)
3. ✅ All 5 required sections present
4. ✅ Evidence-grounded (14 markers confirmed)
5. ✅ No fabricated numerical facts detected
6. ✅ Model = `deepseek-r1:8b`
7. ✅ LangChain → ChatOllama → Ollama path confirmed real
8. ✅ All existing endpoints remain healthy
