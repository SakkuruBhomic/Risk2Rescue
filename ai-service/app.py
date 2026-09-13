from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_orchestrator import LangChainOrchestrator
from decision_context import build_evidence_context
from decision_support_prompt import render_decision_brief_prompt

# Load environment variables
load_dotenv()

# Initialize orchestrator
orchestrator = LangChainOrchestrator()

class PromptRequest(BaseModel):
    prompt: str

app = FastAPI(
    title="Risk2Rescue AI Service",
    description="Foundational AI Service for Risk2Rescue operations",
    version="0.1.0"
)

# Enable CORS for browser access from the Risk2Rescue frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "risk2rescue-ai-service"
    }

@app.get("/geoai/status")
def geoai_status():
    return {
        "status": "ok",
        "service": "geoai",
        "description": "GeoAI integration layer (TerraMind + AP SDMA + Habitation + Shelter + Routing)"
    }

@app.get("/terramind/status")
def terramind_status():
    import os
    flood_geojson = "test_outputs/ap_districts/terramind_flood_events_by_district.geojson"
    flood_exists = os.path.exists(flood_geojson)
    return {
        "status": "ok" if flood_exists else "unavailable",
        "model": "ibm-esa-geospatial/TerraMind-base-Flood",
        "flood_events_file": flood_geojson,
        "flood_events_available": flood_exists
    }

@app.post("/ai/langchain-test")
def langchain_test(request: PromptRequest):
    result = orchestrator.generate_response(request.prompt)
    if result["status"] == "error":
        raise HTTPException(status_code=503, detail=result)
    return result

@app.post("/ai/decision-brief")
def decision_brief():
    """
    Task 17: Evidence-grounded DeepSeek decision brief.
    Builds deterministic evidence context, renders compact prompt,
    calls DeepSeek R1:8B via LangChain → ChatOllama → Ollama.
    """
    # Step 1: Build deterministic evidence context
    ctx = build_evidence_context()
    
    # Step 2: Render compact prompt
    prompt = render_decision_brief_prompt(ctx)
    prompt_token_estimate = len(prompt) // 4
    
    # Step 3: Call DeepSeek via LangChain (num_predict=700, timeout=180s)
    result = orchestrator.generate_decision_brief(
        prompt=prompt,
        num_predict=1200,
        timeout=300
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=503, detail={
            "error": "DeepSeek generation failed",
            "error_code": result.get("error_code"),
            "done_reason": result.get("done_reason"),
            "message": result.get("message"),
            "model": result.get("model"),
            "duration_seconds": result.get("duration_seconds")
        })
    
    # Step 4: Validate non-empty output (already enforced in orchestrator)
    brief_text = result["response"]
    
    # Step 5: Validate required sections present
    required_sections = [
        "OBSERVATIONS",
        "RISK / PRIORITY",
        "AUTHORITY RECOMMENDATIONS",
        "SHELTER / ACCESS",
        "LIMITATIONS / CONFIDENCE"
    ]
    missing_sections = [s for s in required_sections if s not in brief_text.upper()]
    
    return {
        "status": "ok",
        "brief": brief_text,
        "meta": {
            "model": result["model"],
            "inference_duration_seconds": result["duration_seconds"],
            "prompt_token_estimate": prompt_token_estimate,
            "output_length_chars": result.get("output_length_chars", len(brief_text)),
            "done_reason": result.get("done_reason"),
            "num_predict": result.get("num_predict"),
            "required_sections_present": len(missing_sections) == 0,
            "missing_sections": missing_sections,
            "evidence_note": (
                "DeepSeek generated the natural-language interpretation. "
                "The underlying hazard, population, VPI, habitation, shelter, and routing facts "
                "were produced by deterministic/GIS/data-processing components and were not invented by the LLM."
            )
        }
    }

if __name__ == "__main__":
    host = os.getenv("AI_SERVICE_HOST", "127.0.0.1")
    port = int(os.getenv("AI_SERVICE_PORT", 8001))
    uvicorn.run(app, host=host, port=port)
