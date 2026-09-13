# Habitation Exposure & Shelter Allocation Bridge Report

## Source Provenance & Limitations
1. **Habitation Source:** `data/census_lookup.json`.
2. **Shelter Source:** `data/shelters.json`.
3. **Provenance Limitations:** The underlying JSON files are static mock datasets serving as structural scaffolds for the engine. They contain a sparse, globally scattered collection of records. 

## Habitation Inspection & Proximity Analysis
4. **Total Habitations Inspected:** 15
5. **Konaseema Habitation Count:** 0
   - The current dataset contains zero habitation centroids localized to the Konaseema district.
6. **Coordinate Validation:** N/A for Konaseema (0 records found in target district).
7. **Suspicious Records:** 9 records flagged as "SUSPICIOUS / NEEDS SOURCE VERIFICATION" (e.g., "Visakhapatnam Urban Coast", "Kamrup Riverside Habitations"). These are broad regions rather than verified village points and were explicitly prevented from being treated as authoritative villages.

## Flood Exposure Metrics
8. **Direct Flood Intersections:** 0
9. **Buffer Proximity Counts (500m / 1km / 5km / 10km):** 0 / 0 / 0 / 0
10. **Directly Intersecting Population:** 0
11. **Near-Flood Population:** 0
12. **Nearest Habitation:** None (No habitations exist in the target district).
13. **Nearest Habitation Distance:** N/A

## Shelter Allocation
14. **Konaseema Shelter Count:** 0
15. **Total Shelter Capacity:** 0
16. **Current Occupancy:** 0
17. **Available Capacity:** 0
18. **Straight-Line Shelter Distances:** N/A (No shelters exist in the target district).

## Hypothetical Relocation Analysis
19. **Hypothetical Relocation Capacity Result:** "Current TerraMind test polygon does not directly intersect any habitation centroid."

## Critical Methodological Constraints
20. **DISTRICT POPULATION != AFFECTED POPULATION:** Explicitly confirmed. District population is strictly macro-demographic context. We avoided mathematically inflating the directly exposed population with the district's density logic.
21. **PROXIMITY != CONFIRMED EXPOSURE:** Explicitly confirmed. Habitations in proximity buffers are contextually near the risk, but are not analytically marked as flooded.
22. **SHELTER PROVENANCE:** Shelters in `shelters.json` are **LOCAL PROJECT DATA** and must not be described as live government telemetry, official NDMA shelters, or verified OpenStreetMap points unless independently supported.
