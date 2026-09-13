import urllib.request
import urllib.parse
import json

def query_layer(service, layer_id, where_clause):
    url = f'https://apsdmagis.ap.gov.in/gisserver/rest/services/{service}/FeatureServer/{layer_id}/query'
    params = {
        'where': where_clause,
        'outFields': '*',
        'f': 'geojson',
        'outSR': '4326',
        'returnGeometry': 'true'
    }
    query_str = urllib.parse.urlencode(params)
    full_url = url + '?' + query_str
    req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=30).read())
        features = data.get('features', [])
        print(f"{service} Layer {layer_id} -> Features: {len(features)}")
        return data
    except Exception as e:
        print(f'Error querying {service} {layer_id}:', e)
        return None

villages = query_layer('Hosted/NP_Demographics', 8, "district_name LIKE '%Konaseema%'")
shelters = query_layer('Hosted/NP_Response', 1, "district_name LIKE '%Konaseema%'")

if villages:
    with open('konaseema_raw_villages.geojson', 'w') as f:
        json.dump(villages, f)
        
if shelters:
    with open('konaseema_raw_shelters.geojson', 'w') as f:
        json.dump(shelters, f)
