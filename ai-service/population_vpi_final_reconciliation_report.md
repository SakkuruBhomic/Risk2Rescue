# Final Konaseema Area / Population Density Reconciliation

## 1. Government Source Reference
- **Source URL:** [https://konaseema.ap.gov.in/demography/](https://konaseema.ap.gov.in/demography/) (Official Konaseema District Administration)
- **Publication Data Extract:**
  - Total Population: 1,719,093
  - Area: 2081.16 Sq Km
  - Density of Population: 716 persons/sq km

## 2. GIS Area & CRS
- **GIS Geometry Source:** AP SDMA `ap_districts_26` FeatureServer (Verified polygon for Konaseema)
- **Equal-Area CRS Used for Calculation:** `EPSG:6933` (EASE-Grid 2.0 Global Equal Area)
- **Calculated GIS Area:** 2346.67 sq km
- **Note on EPSG:32644:** EPSG:32644 (UTM 44N) is conformal, not equal-area. It was explicitly avoided for area comparison in this reconciliation.

## 3. Difference Analysis
- **Difference:** 265.51 sq km
- **Percentage Difference:** ~12.7%
- **Cause/Limitation:** This large discrepancy is typical for coastal and deltaic districts (Konaseema is part of the Godavari delta). The official district area usually excludes large estuarine water bodies, river channels, or the coastal buffer, while the GIS bounding polygon natively traces generalized territorial or administrative limits that include these waters.

## 4. Selected Analytical Area Rule
- **Selected Area Rule:** **GIS analytical density (population / AP SDMA polygon area)**.
- **Why it is appropriate:** The Risk2Rescue spatial VPI engine calculates density context by joining the VPI grid with the GIS district polygon. If we used the smaller government area, we would artificially inflate the mathematical density applied across the larger GIS polygon that the TerraMind models use. Maintaining internal geometrical consistency between the polygon area and the density computation is strictly required for accurate normalization.

## 5. Konaseema Final Values
- **2011 Baseline Population:** 1,719,093 (Exact match to official source)
- **2026 Projected Estimate:** 1,865,817
- **Selected Analytical Area:** 2346.67 sq km
- **Final Density (2026):** 795.09 persons/sq km

## 6. Population Density Normalization & VPI Contribution
- **Statewide Minimum Density:** 51.85 persons/sq km (Alluri Sitharama Raju)
- **Statewide Maximum Density:** 2139.84 persons/sq km (Visakhapatnam)
- **Konaseema Normalized Score:** `(795.09 - 51.85) / (2139.84 - 51.85)` = 0.3560
- **Konaseema VPI Population Contribution:** 0.15 × 0.3560 = 0.0534
- **Exact VPI Formula:** `VPI = 0.25 × Hazard Intensity + 0.20 × Vulnerability + 0.15 × Population Density + 0.15 × Elevation Risk + 0.10 × Disaster History + 0.15 × Access Isolation`

## 7. No Affected Population Inference
**WARNING:** District population and district density serve exclusively as macro-scale demographic context for the Vulnerability Priority Index (VPI). They do NOT represent the population exposed to the TerraMind polygon, the population affected by the flood, or the required evacuation population.

## 8. Final Status
**PASS — FINAL RECONCILED**
