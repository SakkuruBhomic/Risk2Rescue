import urllib.request
import json

def get_layer_info(service, layer_id):
    url = f'https://apsdmagis.ap.gov.in/gisserver/rest/services/{service}/FeatureServer/{layer_id}?f=json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        print(f"\n--- {service} Layer {layer_id} ({data.get('name')}) ---")
        for f in data.get('fields', []):
            print(f"Field: {f['name']} ({f['type']})")
    except Exception as e:
        print(f'Error on {service} {layer_id}:', e)

get_layer_info('Hosted/NP_Demographics', 8) # population_village
get_layer_info('Hosted/NP_Response', 1) # cyclone_shelters
