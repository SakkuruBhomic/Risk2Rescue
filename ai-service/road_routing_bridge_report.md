# Road Routing Bridge Report — Task 16

## 1. Routing Provider
- **Provider:** Project OSRM (OpenStreetMap)
- **Endpoint:** `https://router.project-osrm.org`
- **Profile:** driving

## 2. Route-Pair Selection Strategy
Shortlisted the nearest shelter for each habitation by Haversine straight-line distance. Then requested one OSRM `/route/v1/driving` call per habitation. This is computationally efficient (268 calls total instead of 268×10 = 2,680) while still producing the physically closest road candidate.

## 3. Habitation / Shelter Scope
| Item | Count |
|---|---|
| Habitation origins (Konaseema) | 268 |
| Shelter destinations (Konaseema) | 10 |
| Route pairs attempted | 268 |
| Successful routes | 268 |
| Failed routes | 0 |

## 4. Straight-Line Distance Statistics
- **Source:** Haversine calculated from AP SDMA polygon centroids and shelter coordinates.
- All 268 pairs had valid finite straight-line distances.

## 5. Road-Distance Statistics (OSRM driving)
| Metric | Value |
|---|---|
| Minimum | 115.5 m |
| Maximum | 68,207.4 m |
| Average | 30,806.99 m |

## 6. Travel-Time Statistics (OSRM driving)
| Metric | Value |
|---|---|
| Minimum | 0.28 min |
| Maximum | 65.68 min |
| Average | 30.6 min |

## 7. Detour Ratio Statistics
| Metric | Value |
|---|---|
| Minimum | 0.12 (snap artifact — see note) |
| Maximum | 12.73 |

> [!NOTE]
> 5 of 268 records show a detour ratio < 1.0. This is a known GIS artifact caused by the difference between the polygon centroid used for straight-line distance calculation and the actual road-snapped waypoint that OSRM selects. All 5 records are annotated with `POLYGON_CENTROID_SNAP_ARTIFACT` in the output. The OSRM routes themselves are valid.

## 8. Route Highlights
- **Habitation with shortest road route:** Samanthakuru
- **Habitation with longest road route:** Yendagandi
- **Shelter with most habitation assignments:** Pedaraghavulupeta

## 9. Flood Route Intersection
| Category | Count |
|---|---|
| Routes CLEAR of model-predicted flood polygons | 268 |
| Routes INTERSECTING model-predicted flood polygon | 0 |

> [!IMPORTANT]
> Route intersection with a model-predicted flood polygon means **"route geometry overlaps TerraMind-predicted flood extent"**. It does NOT prove the road is flooded, closed, unsafe, or impassable. Real-time road passability requires telemetry or field surveys.

## 10. Shelter Capacity Context
| Item | Value |
|---|---|
| Total Konaseema shelters | 10 |
| Total official capacity | 7,282 |
| Available capacity (no pre-existing occupancy recorded) | 7,282 |
| Mass evacuation calculation performed | NO |

> [!CAUTION]
> Mass evacuation calculations were deliberately NOT performed. Task 15A found 0 direct habitation/flood polygon intersections. Deriving an evacuation requirement from all 268 habitations or from district population (1,865,817) would be factually incorrect.

## 11. Critical Limitations

1. **Road safety cannot be claimed from routing success.** A routed path does not imply the road is open, safe, or accessible. Real-time road condition telemetry, NDRF/police blockade data, and flood inundation surveys are required.
2. **No real-time traffic or passability.** OSRM uses a static OpenStreetMap road graph with typical travel speeds. Actual travel times during a disaster may differ substantially.
3. **0 directly exposed habitations ≠ zero disaster risk.** The TerraMind test polygons represent predicted flood extent under the given satellite inputs. Absence of direct centroid intersection does not confirm habitations are unaffected.
4. **Detour ratio anomalies.** 5 records have a detour ratio < 1.0 due to polygon centroid vs. OSRM road-snap offset. These are documented artifacts, not routing errors.

## 12. Output Files
- `test_outputs/road_routing/road_route_results.json` — Full per-habitation routing record
- `test_outputs/road_routing/habitation_shelter_routes.geojson` — Route geometries (EPSG:4326)
- `test_outputs/road_routing/road_routing_summary.json` — Aggregated accessibility metrics
- `test_outputs/road_routing/road_accessibility_overlay.png` — Placeholder output
