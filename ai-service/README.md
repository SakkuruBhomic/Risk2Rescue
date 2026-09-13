# Risk2Rescue AI Service

This directory contains the foundational Python FastAPI service for Risk2Rescue AI operations.

## Purpose
The `ai-service` provides a dedicated backend for processing AI and machine learning workloads, entirely decoupled from the core Node.js application. Future tasks will integrate heavy AI models (e.g., TerraTorch, DeepSeek) here.

## Setup Instructions

1. **Navigate to the directory**:
   ```bash
   cd ai-service
   ```

2. **Activate the Virtual Environment**:
   - On Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` and adjust the variables as needed.
   ```bash
   cp .env.example .env
   ```

## Starting the Service

Run the application using Python:
```bash
python app.py
```
Alternatively, you can run it directly with Uvicorn:
```bash
uvicorn app:app --host 127.0.0.1 --port 8001
```

## Verification

The service defaults to port `8001`. Verify it is running by hitting the health endpoint:
```bash
curl http://127.0.0.1:8001/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "risk2rescue-ai-service"
}
```

## Note
Currently, this is a clean foundation. Heavy AI models and GeoAI packages will be installed in subsequent tasks.
