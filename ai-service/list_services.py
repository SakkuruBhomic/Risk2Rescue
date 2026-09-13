import urllib.request
import json
for folder in ['Hosted', 'Cyclone', 'Flood']:
    url = f'https://apsdmagis.ap.gov.in/gisserver/rest/services/{folder}?f=json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        for s in data.get('services', []):
            print(f"Service: {s.get('name')} ({s.get('type')})")
    except Exception as e:
        print(f'Error on {folder}:', e)
