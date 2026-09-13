import os
import pystac_client
import planetary_computer
from datetime import datetime, timedelta

# AOI: Rajahmundry-Dowleswaram
bbox = [81.75, 16.90, 81.80, 16.95]
time_range = "2024-06-01/2024-09-30"

catalog = pystac_client.Client.open(
    "https://planetarycomputer.microsoft.com/api/stac/v1",
    modifier=planetary_computer.sign_inplace,
)

print("Searching Sentinel-2-L2A...")
s2_search = catalog.search(
    collections=["sentinel-2-l2a"],
    bbox=bbox,
    datetime=time_range,
    query={"eo:cloud_cover": {"lt": 30}}
)
s2_items = list(s2_search.items())
# Sort by datetime
s2_items = sorted(s2_items, key=lambda x: x.datetime)
print(f"Found {len(s2_items)} Sentinel-2 items.")

if len(s2_items) >= 4:
    s2_selected = s2_items[:4]
    for i, item in enumerate(s2_selected):
        print(f" S2 T{i}: {item.id} - {item.datetime} - Clouds: {item.properties.get('eo:cloud_cover')}%")
else:
    print("Not enough S2 items found.")

print("\nSearching Sentinel-1-RTC...")
s1_search = catalog.search(
    collections=["sentinel-1-rtc"],
    bbox=bbox,
    datetime=time_range,
)
s1_items = list(s1_search.items())
s1_items = sorted(s1_items, key=lambda x: x.datetime)
print(f"Found {len(s1_items)} Sentinel-1 items.")

if len(s1_items) >= 4:
    s1_selected = s1_items[:4]
    for i, item in enumerate(s1_selected):
        print(f" S1 T{i}: {item.id} - {item.datetime}")
else:
    print("Not enough S1 items found.")

print("\nSearching Copernicus DEM...")
dem_search = catalog.search(
    collections=["cop-dem-glo-30"],
    bbox=bbox,
)
dem_items = list(dem_search.items())
print(f"Found {len(dem_items)} DEM items.")
if len(dem_items) > 0:
    print(f" DEM: {dem_items[0].id}")
