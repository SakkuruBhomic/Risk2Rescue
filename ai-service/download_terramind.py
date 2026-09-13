import os
from huggingface_hub import hf_hub_download, list_repo_files

repo_id = "ibm-esa-geospatial/TerraMind-1.0-tiny"

print("Listing files in:", repo_id)
try:
    files = list_repo_files(repo_id)
    print("Files found:", files)
except Exception as e:
    print("Error listing repo:", e)
