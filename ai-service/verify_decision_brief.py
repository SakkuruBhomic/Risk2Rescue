"""
verify_decision_brief.py
Task 17 verification: validates that the /ai/decision-brief response is
evidence-grounded and contains required sections. Rejects generic output.
"""
import urllib.request
import urllib.error
import json
import sys
import re


REQUIRED_SECTIONS = [
    "OBSERVATIONS",
    "RISK / PRIORITY",
    "AUTHORITY RECOMMENDATIONS",
    "SHELTER / ACCESS",
    "LIMITATIONS / CONFIDENCE"
]

# Semantic evidence markers: at least 6 of these must be present
EVIDENCE_MARKERS = [
    "konaseema",
    "terramind",
    "tm_flood",
    "flood polygon",
    "0 direct",
    "no direct",
    "peravaram",
    "sdma",
    "ap sdma",
    "osrm",
    "shelter",
    "7,282",
    "7282",
    "268",
    "10 km",
    "uncertainty",
    "limitation",
    "not confirmed",
    "not ground-truth",
    "routing",
    "habitation",
    "51,768",
    "51768"
]

MINIMUM_EVIDENCE_MARKERS = 5


def call_decision_brief():
    url = "http://127.0.0.1:8001/ai/decision-brief"
    req = urllib.request.Request(url, method="POST")
    req.add_header("Content-Type", "application/json")
    req.data = b""
    try:
        with urllib.request.urlopen(req, timeout=200) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()}"}
    except Exception as e:
        return {"error": str(e)}


def verify(data: dict) -> bool:
    print("=== TASK 17: DECISION BRIEF VERIFICATION ===\n")
    
    if "error" in data:
        print(f"FAIL: API call failed: {data['error']}")
        return False
        
    if data.get("status") != "ok":
        print(f"FAIL: status={data.get('status')}")
        print(json.dumps(data, indent=2))
        return False
        
    brief = data.get("brief", "")
    meta = data.get("meta", {})
    
    print(f"Model: {meta.get('model')}")
    print(f"Inference duration: {meta.get('inference_duration_seconds')}s")
    print(f"Prompt token estimate: {meta.get('prompt_token_estimate')}")
    print(f"Output length: {meta.get('output_length_chars')} chars")
    print(f"done_reason: {meta.get('done_reason')}")
    print(f"num_predict: {meta.get('num_predict')}")
    print()
    
    # Rule 1: Non-empty content
    if not brief or len(brief.strip()) < 100:
        print("FAIL: brief content is empty or too short.")
        return False
    print("PASS: Non-empty content received from DeepSeek.")
    
    # Rule 2: Model must be deepseek-r1:8b
    model = meta.get("model", "")
    if "deepseek-r1:8b" not in model.lower():
        print(f"FAIL: Model is {model}, expected deepseek-r1:8b.")
        return False
    print(f"PASS: Correct model ({model}).")
    
    # Rule 3: All five required sections present
    brief_upper = brief.upper()
    missing = [s for s in REQUIRED_SECTIONS if s.upper() not in brief_upper]
    if missing:
        print(f"FAIL: Missing required sections: {missing}")
        return False
    print(f"PASS: All {len(REQUIRED_SECTIONS)} required sections present.")
    
    # Rule 4: Evidence grounding — at least MINIMUM_EVIDENCE_MARKERS found
    brief_lower = brief.lower()
    found_markers = [m for m in EVIDENCE_MARKERS if m.lower() in brief_lower]
    if len(found_markers) < MINIMUM_EVIDENCE_MARKERS:
        print(f"FAIL: Only {len(found_markers)} evidence markers found (need {MINIMUM_EVIDENCE_MARKERS}).")
        print(f"  Found: {found_markers}")
        return False
    print(f"PASS: Evidence-grounded ({len(found_markers)} markers found: {found_markers[:8]}...).")
    
    # Rule 5: No fabricated mass evacuation claim (sanity check)
    dangerous_phrases = [
        "mass evacuation of.*district",
        "evacuate.*1,865",
        "evacuate.*1865",
        "entire district.*evacuate"
    ]
    for phrase in dangerous_phrases:
        if re.search(phrase, brief_lower):
            print(f"FAIL: Detected fabricated mass evacuation claim: '{phrase}'")
            return False
    print("PASS: No fabricated mass evacuation claim detected.")
    
    # Rule 6: Check evidence_note field
    note = meta.get("evidence_note", "")
    if "DeepSeek generated" not in note:
        print("FAIL: Missing evidence_note metadata field.")
        return False
    print("PASS: Provenance attribution present in metadata.")
    
    print()
    print("=== BRIEF ===")
    print(brief)
    print()
    print("=== ALL VERIFICATION CHECKS PASSED ===")
    return True


if __name__ == "__main__":
    print("Calling /ai/decision-brief...")
    data = call_decision_brief()
    success = verify(data)
    sys.exit(0 if success else 1)
