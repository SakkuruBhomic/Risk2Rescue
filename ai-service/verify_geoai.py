import geoai
import fastapi
import langchain_ollama
import pydantic
import rasterio
import geopandas
import shapely

print('Python Import: Success')
print('geoai Version:', getattr(geoai, '__version__', 'unknown'))
print('Capabilities:')
print('- Modules:', dir(geoai))

print('Dependency Versions:')
print('fastapi:', fastapi.__version__)
print('langchain_ollama:', langchain_ollama.__version__)
print('pydantic:', pydantic.__version__)
print('rasterio:', rasterio.__version__)
print('geopandas:', geopandas.__version__)
print('shapely:', shapely.__version__)
