import urllib.request
import json

def inspect_service(service_name):
    url = f'https://apsdmagis.ap.gov.in/gisserver/rest/services/{service_name}?f=json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        print(f"\n--- {service_name} ---")
        for layer in data.get('layers', []):
            print(f"Layer {layer['id']}: {layer['name']}")
    except Exception as e:
        print(f'Error inspecting {service_name}:', e)

inspect_service('Hosted/NP_Demographics/FeatureServer')
inspect_service('Hosted/NP_Response/FeatureServer')
inspect_service('Hosted/NP_Admin/FeatureServer')
