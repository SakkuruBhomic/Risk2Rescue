"""
decision_support_prompt.py
Renders the compact, token-efficient prompt for DeepSeek R1:8B decision brief.
Target: 1,000–1,600 estimated input tokens. Hard max: 2,000.
"""


def render_decision_brief_prompt(ctx: dict) -> str:
    hz = ctx["hazard"]
    geo = ctx["geographic_scope"]
    pop = ctx["population_vpi"]
    hab = ctx["habitation_exposure"]
    shlt = ctx["shelters"]
    road = ctx["road_accessibility"]
    lims = ctx["limitations"]

    prompt = f"""You are a concise disaster management decision-support AI. Use ONLY the verified facts below. Do NOT invent numbers, do NOT claim roads are safe, do NOT claim habitations are flooded unless they directly intersect a flood polygon.

=== VERIFIED EVIDENCE SUMMARY ===

[HAZARD]
Model: {hz['model']}
Source: {hz['source']}
Period: {hz['acquisition_period']}
Events: {hz['flood_event_count']} TerraMind flood polygons predicted in {geo['primary_district']}, {geo['state']}
Total predicted area: {hz['total_predicted_area_km2']} km²
Threshold: {hz['probability_threshold']} (NOT ground-truth calibrated)

[GEOGRAPHIC SCOPE]
State: {geo['state']}  |  Primary district: {geo['primary_district']}
District authority: {geo['district_source']}

[POPULATION / VPI]
{geo['primary_district']} 2026 projected population: {pop['konaseema_2026_projected_population']:,} ({pop['population_status']})
Analytical density: {pop['analytical_density_per_km2']} persons/km²
VPI population contribution: {pop['vpi_population_contribution']} (normalized score {pop['density_normalized_score']})

[HABITATION EXPOSURE — AP SDMA, Census 2011]
Total habitations in {geo['primary_district']}: {hab['konaseema_habitations']}
Direct flood polygon intersections: {hab['direct_flood_intersections']} (NONE)
Within 1 km of flood polygons: {hab['within_1km']}
Within 5 km: {hab['within_5km']}  |  Within 10 km: {hab['within_10km']}
Nearest habitation: {hab['nearest_habitation']} ({hab['nearest_distance_m']} m)
Population within 10 km buffer: {hab['near_flood_population_10km_buffer']:,}
NOTE: {hab['proximity_note']}

[SHELTERS — AP SDMA cyclone_shelters]
Shelters in {geo['primary_district']}: {shlt['shelter_count']}
Published total capacity: {shlt['published_total_capacity']:,} persons ({shlt['verified_capacity_records']} records verified)
Nearest shelter to flood area: {shlt['nearest_shelter']}
NOTE: {shlt['occupancy_note']}

[ROAD ACCESSIBILITY — OpenStreetMap / OSRM driving]
Routes computed: {road['route_pairs']}  |  Successful: {road['successful_routes']}  |  Failed: {road['failed_routes']}
Road distance — min/avg/max: {road['road_distance_min_m']} m / {road['road_distance_avg_m']} m / {road['road_distance_max_m']} m
Travel time — min/avg/max: {road['travel_time_min_min']} / {road['travel_time_avg_min']} / {road['travel_time_max_min']} minutes
Routes overlapping TerraMind flood polygons: {road['routes_intersecting_flood_polygon']}
NOTE: {road['passability_note']}

[LIMITATIONS]
{chr(10).join(f'- {l}' for l in lims)}

=== TASK ===
Produce a concise authority decision brief using ONLY the evidence above.
Use EXACTLY these five section headings (no sub-bullets, no extra headings):

OBSERVATIONS
RISK / PRIORITY
AUTHORITY RECOMMENDATIONS
SHELTER / ACCESS
LIMITATIONS / CONFIDENCE

Keep each section to 3–5 sentences. Do not repeat the raw numbers verbatim for every sentence. Do not recommend mass evacuation — no habitation directly intersects the flood polygon. Do not claim roads are safe. Do not claim district population is exposed population. Do NOT call the 0.0534 population contribution a "VPI score" or "total VPI score"."""

    return prompt
