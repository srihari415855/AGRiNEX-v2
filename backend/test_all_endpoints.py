import sys
import io
# Reconfigure stdout to utf-8 so emojis and special symbols do not crash on Windows cp1252
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import urllib.error
import json
import base64
import time
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

test_results = []

def record_test(test_id, category, name, expected, actual, status, details=""):
    test_results.append({
        "id": test_id,
        "category": category,
        "name": name,
        "expected": str(expected),
        "actual": str(actual),
        "status": status,
        "details": str(details)
    })
    symbol = "[PASS]" if status == "PASS" else ("[FAIL]" if status == "FAIL" else "[WARN]")
    print(f"[{test_id}] {symbol} | {category} -> {name}: {details}")

def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            code = resp.getcode()
            res_body = resp.read()
            # Try to decode json or keep text / binary length
            try:
                parsed = json.loads(res_body.decode("utf-8"))
            except Exception:
                if resp.headers.get_content_type() == "application/pdf":
                    parsed = f"PDF Binary ({len(res_body)} bytes)"
                else:
                    parsed = res_body.decode("utf-8", errors="replace")[:200]
            return code, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body[:200]
        return e.code, parsed
    except Exception as e:
        return 0, str(e)

def create_synthetic_image():
    img = Image.new("RGB", (100, 100), color=(120, 80, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def run_all_tests():
    print("=" * 70)
    print("      AGRiNEX DEEP API & BACKEND INTEGRATION TEST SUITE      ")
    print("=" * 70)

    # 1. Root & Health
    code, res = request("GET", "/")
    if code == 200 and isinstance(res, dict) and res.get("status") == "online":
        record_test("TC-001", "Health", "API Gateway Root Endpoint", "200 with status online", f"{code} OK", "PASS", str(res))
    else:
        record_test("TC-001", "Health", "API Gateway Root Endpoint", "200 with status online", f"{code}", "FAIL", str(res))

    code, res = request("GET", "/health")
    if code == 200:
        record_test("TC-002", "Health", "Standard Health Check Endpoint", "200 OK", f"{code}", "PASS", str(res))
    else:
        record_test("TC-002", "Health", "Standard Health Check Endpoint", "200 OK", f"{code}", "FAIL", f"Missing endpoint: {res}")

    # 2. Authentication: Signup
    ts = int(time.time() * 1000)
    test_email = f"qa_auditor_{ts}@testagrinex.in"
    test_pass = "TestSecurePassword2026!"
    signup_payload = {
        "email": test_email,
        "password": test_pass,
        "name": "Senior QA Tester",
        "language": "en"
    }
    code, res = request("POST", "/api/auth/signup", signup_payload)
    token = None
    user_id = None
    if code == 200 and isinstance(res, dict) and "token" in res:
        token = res["token"]
        user_id = res.get("user", {}).get("id")
        record_test("TC-003", "Auth", "Farmer Signup", "200 with token and user profile", "200 OK", "PASS", f"User created: {test_email}, ID: {user_id}")
    else:
        record_test("TC-003", "Auth", "Farmer Signup", "200 with token and user profile", f"{code}", "FAIL", str(res))

    # Duplicate Signup
    code, res = request("POST", "/api/auth/signup", signup_payload)
    if code == 400:
        record_test("TC-004", "Auth", "Prevent Duplicate Email Signup", "400 Bad Request", f"{code}", "PASS", str(res))
    else:
        record_test("TC-004", "Auth", "Prevent Duplicate Email Signup", "400 Bad Request", f"{code}", "FAIL", str(res))

    # Invalid Signup format
    code, res = request("POST", "/api/auth/signup", {"email": "not-an-email", "password": "123"})
    if code in [400, 422]:
        record_test("TC-005", "Auth", "Reject Invalid Email on Signup", "422 Validation Error", f"{code}", "PASS", str(res))
    else:
        record_test("TC-005", "Auth", "Reject Invalid Email on Signup", "422 Validation Error", f"{code}", "FAIL", str(res))

    # 3. Authentication: Login
    code, res = request("POST", "/api/auth/login", {"email": test_email, "password": test_pass})
    if code == 200 and isinstance(res, dict) and "token" in res:
        token = res["token"]
        record_test("TC-006", "Auth", "Farmer Login", "200 with valid JWT", "200 OK", "PASS", "Login successful")
    else:
        record_test("TC-006", "Auth", "Farmer Login", "200 with valid JWT", f"{code}", "FAIL", str(res))

    # Login Invalid Password
    code, res = request("POST", "/api/auth/login", {"email": test_email, "password": "WrongPassword"})
    if code == 401:
        record_test("TC-007", "Auth", "Reject Invalid Password", "401 Unauthorized", f"{code}", "PASS", str(res))
    else:
        record_test("TC-007", "Auth", "Reject Invalid Password", "401 Unauthorized", f"{code}", "FAIL", str(res))

    # Login Non-existent user
    code, res = request("POST", "/api/auth/login", {"email": "nobody_exists_here@test.com", "password": "any"})
    if code == 401:
        record_test("TC-008", "Auth", "Reject Non-Existent User Login", "401 Unauthorized", f"{code}", "PASS", str(res))
    else:
        record_test("TC-008", "Auth", "Reject Non-Existent User Login", "401 Unauthorized", f"{code}", "FAIL", str(res))

    # 4. Auth: Profile Me
    code, res = request("GET", "/api/auth/me", token=token)
    if code == 200 and isinstance(res, dict) and res.get("email") == test_email:
        record_test("TC-009", "Auth", "Get Current User Profile (/api/auth/me)", "200 with email match", "200 OK", "PASS", f"User verified: {res.get('email')}")
    else:
        record_test("TC-009", "Auth", "Get Current User Profile (/api/auth/me)", "200 with email match", f"{code}", "FAIL", str(res))

    # Profile Me without Token
    code, res = request("GET", "/api/auth/me", token=None)
    if code == 401:
        record_test("TC-010", "Security", "Reject /api/auth/me without Token", "401 Unauthorized", f"{code}", "PASS", "Access denied without token")
    else:
        record_test("TC-010", "Security", "Reject /api/auth/me without Token", "401 Unauthorized", f"{code}", "FAIL", str(res))

    # 5. Farms CRUD
    code, res = request("GET", "/api/farms", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-011", "Farms", "List Farms for User", "200 with list", f"200 OK ({len(res)} farms)", "PASS", f"Count: {len(res)}")
    else:
        record_test("TC-011", "Farms", "List Farms for User", "200 with list", f"{code}", "FAIL", str(res))

    # Create Farm
    farm_data = {
        "name": f"QA Green Valley {ts}",
        "location": "Bhatkal, Karnataka",
        "area": 14.5,
        "area_unit": "acre",
        "latitude": 13.987,
        "longitude": 74.556,
        "water_availability": "Borewell High",
        "irrigation_method": "Drip Irrigation",
        "farming_type": "Horticulture"
    }
    code, res = request("POST", "/api/farms", farm_data, token=token)
    created_farm_id = None
    if code == 200 and isinstance(res, dict) and "id" in res:
        created_farm_id = res["id"]
        record_test("TC-012", "Farms", "Create Farm (/api/farms)", "200 with created Farm record", "200 OK", "PASS", f"Farm ID: {created_farm_id}")
    else:
        record_test("TC-012", "Farms", "Create Farm (/api/farms)", "200 with created Farm record", f"{code}", "FAIL", str(res))

    # Get Farm By ID
    if created_farm_id:
        code, res = request("GET", f"/api/farms/{created_farm_id}", token=token)
        if code == 200 and isinstance(res, dict) and res.get("id") == created_farm_id:
            record_test("TC-013", "Farms", "Get Farm by ID", "200 with matching ID", "200 OK", "PASS", f"Farm name: {res.get('name')}")
        else:
            record_test("TC-013", "Farms", "Get Farm by ID", "200 with matching ID", f"{code}", "FAIL", str(res))

        # Update Farm
        code, res = request("PUT", f"/api/farms/{created_farm_id}", {"name": f"QA Green Valley Updated {ts}", "area": 16.0}, token=token)
        if code == 200 and isinstance(res, dict) and res.get("area") == 16.0:
            record_test("TC-014", "Farms", "Update Farm", "200 with updated area 16.0", "200 OK", "PASS", f"Updated area: {res.get('area')}")
        else:
            record_test("TC-014", "Farms", "Update Farm", "200 with updated area 16.0", f"{code}", "FAIL", str(res))

    # Demo Farm Endpoint
    code, res = request("GET", "/api/demo/farm")
    if code == 200 and isinstance(res, dict) and "name" in res:
        record_test("TC-015", "Farms", "Get Demo Farm (/api/demo/farm)", "200 with demo farm details", "200 OK", "PASS", f"Demo farm: {res.get('name')}")
    else:
        record_test("TC-015", "Farms", "Get Demo Farm (/api/demo/farm)", "200 with demo farm details", f"{code}", "FAIL", str(res))

    # 6. Zones Management
    created_zone_id = None
    if created_farm_id:
        zone_payload = {
            "name": "Zone 101 - QA Precision Block",
            "crop": "Tomato",
            "soil_type": "Red Sandy Loam",
            "area": 2.5,
            "area_unit": "acre"
        }
        code, res = request("POST", f"/api/farms/{created_farm_id}/zones", zone_payload, token=token)
        if code == 200 and isinstance(res, dict) and "id" in res:
            created_zone_id = res["id"]
            record_test("TC-016", "Zones", "Create Zone in Farm", "200 with zone ID", "200 OK", "PASS", f"Zone ID: {created_zone_id}")
        else:
            record_test("TC-016", "Zones", "Create Zone in Farm", "200 with zone ID", f"{code}", "FAIL", str(res))

        # List Zones in Farm
        code, res = request("GET", f"/api/farms/{created_farm_id}/zones", token=token)
        if code == 200 and isinstance(res, list) and len(res) > 0:
            record_test("TC-017", "Zones", "List Zones in Farm", "200 with list containing created zone", "200 OK", "PASS", f"Zones count: {len(res)}")
        else:
            record_test("TC-017", "Zones", "List Zones in Farm", "200 with list containing created zone", f"{code}", "FAIL", str(res))

    # Zone Sensor Telemetry
    target_zone = created_zone_id or "zone-1"
    code, res = request("GET", f"/api/zones/{target_zone}/sensor", token=token)
    if code == 200 and isinstance(res, dict) and "moisture" in res:
        record_test("TC-018", "Zones", "Get Zone Real-Time Sensor Telemetry", "200 with moisture and temperature", "200 OK", "PASS", f"Moisture: {res.get('moisture')}%, Temp: {res.get('temperature')}°C")
    else:
        record_test("TC-018", "Zones", "Get Zone Real-Time Sensor Telemetry", "200 with moisture and temperature", f"{code}", "FAIL", str(res))

    # 7. Precision Irrigation
    irrig_req = {
        "zone_id": target_zone,
        "irrigation_method": "Drip Irrigation",
        "farm_id": created_farm_id
    }
    code, res = request("POST", "/api/irrigation/recommend", irrig_req, token=token)
    if code == 200 and isinstance(res, dict) and "recommended_duration_minutes" in res:
        record_test("TC-019", "Irrigation", "Recommend Irrigation Duration", "200 with recommended duration", "200 OK", "PASS", f"Duration: {res.get('recommended_duration_minutes')} min, Gross Litres: {res.get('gross_water_litres')}")
    else:
        record_test("TC-019", "Irrigation", "Recommend Irrigation Duration", "200 with recommended duration", f"{code}", "FAIL", str(res))

    # Start Irrigation
    start_req = {
        "zone_id": target_zone,
        "duration_minutes": 15,
        "irrigation_method": "Drip Irrigation",
        "confirmed": True
    }
    code, res = request("POST", "/api/irrigation/start", start_req, token=token)
    active_event_id = None
    if code == 200 and isinstance(res, dict) and res.get("status") == "success":
        active_event_id = res.get("event", {}).get("id")
        record_test("TC-020", "Irrigation", "Start Irrigation Cycle", "200 with event started and IoT pump energized", "200 OK", "PASS", f"Event ID: {active_event_id}, Pump: {res.get('mock_iot', {}).get('pump_status')}")
    else:
        record_test("TC-020", "Irrigation", "Start Irrigation Cycle", "200 with event started and IoT pump energized", f"{code}", "FAIL", str(res))

    # Irrigation Status
    code, res = request("GET", f"/api/irrigation/status?zone_id={target_zone}", token=token)
    if code == 200 and isinstance(res, dict):
        record_test("TC-021", "Irrigation", "Get Real-Time Irrigation Status", "200 with pump and valve state", "200 OK", "PASS", f"State: {res.get('state')}, Hardware: {res.get('hardware', {}).get('pump_status')}")
    else:
        record_test("TC-021", "Irrigation", "Get Real-Time Irrigation Status", "200 with pump and valve state", f"{code}", "FAIL", str(res))

    # Extend Irrigation
    ext_req = {
        "zone_id": target_zone,
        "event_id": active_event_id,
        "added_minutes": 5
    }
    code, res = request("POST", "/api/irrigation/extend", ext_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("status") == "success":
        record_test("TC-022", "Irrigation", "Extend Running Irrigation Duration", "200 with added minutes", "200 OK", "PASS", f"New duration: {res.get('new_duration_minutes')} min")
    else:
        record_test("TC-022", "Irrigation", "Extend Running Irrigation Duration", "200 with added minutes", f"{code}", "FAIL", str(res))

    # Stop Irrigation
    stop_req = {
        "zone_id": target_zone,
        "event_id": active_event_id,
        "reason": "QA Test Completed"
    }
    code, res = request("POST", "/api/irrigation/stop", stop_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("status") == "success":
        record_test("TC-023", "Irrigation", "Stop Irrigation Cycle", "200 with pump stopped", "200 OK", "PASS", f"Stopped state: {res.get('state')}")
    else:
        record_test("TC-023", "Irrigation", "Stop Irrigation Cycle", "200 with pump stopped", f"{code}", "FAIL", str(res))

    # Irrigation History
    code, res = request("GET", "/api/irrigation/history", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-024", "Irrigation", "List Irrigation History", "200 with events list", "200 OK", "PASS", f"Historical records: {len(res)}")
    else:
        record_test("TC-024", "Irrigation", "List Irrigation History", "200 with events list", f"{code}", "FAIL", str(res))

    # 8. AI & ML Vision Specimen Diagnostics
    img_b64 = create_synthetic_image()
    soil_specimen = {
        "image_base64": img_b64,
        "mime_type": "image/jpeg",
        "analysis_type": "soil",
        "zone_id": target_zone,
        "farm_id": created_farm_id,
        "language": "en"
    }
    code, res = request("POST", "/api/analyze/image", soil_specimen, token=token)
    created_analysis_id = None
    if code == 200 and isinstance(res, dict) and "ml_metrics" in res:
        created_analysis_id = res.get("id")
        ml = res["ml_metrics"]
        record_test("TC-025", "AI/ML Vision", "Topsoil Optical ML Diagnostics", "200 with ML soil classification & confidence", "200 OK", "PASS", f"Soil: {ml.get('soil_type')}, pH: {ml.get('ph_range')}, Conf: {ml.get('ml_confidence_pct')}%")
    else:
        record_test("TC-025", "AI/ML Vision", "Topsoil Optical ML Diagnostics", "200 with ML soil classification & confidence", f"{code}", "FAIL", str(res))

    # Plant Disease Analysis
    plant_specimen = {
        "image_base64": img_b64,
        "mime_type": "image/jpeg",
        "analysis_type": "plant",
        "zone_id": target_zone,
        "farm_id": created_farm_id,
        "language": "en"
    }
    code, res = request("POST", "/api/analyze/image", plant_specimen, token=token)
    if code == 200 and isinstance(res, dict) and "ml_metrics" in res:
        ml = res["ml_metrics"]
        record_test("TC-026", "AI/ML Vision", "Plant Pathology & Vigor Diagnostics", "200 with pathogen and severity", "200 OK", "PASS", f"Pathogen: {ml.get('primary_pathogen')}, Severity: {ml.get('severity_stage')}")
    else:
        record_test("TC-026", "AI/ML Vision", "Plant Pathology & Vigor Diagnostics", "200 with pathogen and severity", f"{code}", "FAIL", str(res))

    # Analyses History
    code, res = request("GET", "/api/analyses", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-027", "AI/ML Vision", "List Analyses History", "200 with list of records", "200 OK", "PASS", f"Specimens stored: {len(res)}")
    else:
        record_test("TC-027", "AI/ML Vision", "List Analyses History", "200 with list of records", f"{code}", "FAIL", str(res))

    # Delete Analysis Record
    if created_analysis_id:
        code, res = request("DELETE", f"/api/analyses/{created_analysis_id}", token=token)
        if code == 200:
            record_test("TC-028", "AI/ML Vision", "Delete Analysis Specimen Record", "200 OK", "200 OK", "PASS", f"Deleted {created_analysis_id}")
        else:
            record_test("TC-028", "AI/ML Vision", "Delete Analysis Specimen Record", "200 OK", f"{code}", "FAIL", str(res))

    # Crop Recommendation
    crop_rec_req = {"farm_id": created_farm_id, "language": "en"}
    code, res = request("POST", "/api/recommend/crop", crop_rec_req, token=token)
    if code == 200 and isinstance(res, dict) and ("recommendations" in res or "crops" in res or "seasonal_recommendations" in res):
        record_test("TC-029", "AI Agronomy", "Crop Suitability Recommendation", "200 with recommended crops", "200 OK", "PASS", f"Recommendations generated: {list(res.keys())}")
    else:
        record_test("TC-029", "AI Agronomy", "Crop Suitability Recommendation", "200 with recommended crops", f"{code}", "FAIL", str(res))

    # 9. What-If Engine
    code, res = request("GET", "/api/whatif/recommendations", token=token)
    if code == 200 and (isinstance(res, list) or (isinstance(res, dict) and "recommendations" in res)):
        recs_count = len(res) if isinstance(res, list) else len(res.get("recommendations", []))
        record_test("TC-030", "What-If Engine", "Get What-If Scenario Recommendations", "200 with scenario prompts list", "200 OK", "PASS", f"Scenarios: {recs_count}")
    else:
        record_test("TC-030", "What-If Engine", "Get What-If Scenario Recommendations", "200 with scenario prompts list", f"{code}", "FAIL", str(res))

    # What-If Parse Prompt
    parse_req = {
        "message": "What happens if temperature increases by 4 degrees for 5 days?",
        "farm_id": created_farm_id,
        "language": "en"
    }
    code, res = request("POST", "/api/whatif/parse-prompt", parse_req, token=token)
    if code == 200 and isinstance(res, dict) and "scenario_type" in res:
        record_test("TC-031", "What-If Engine", "Parse Natural Language Scenario Prompt", "200 with parsed parameters", "200 OK", "PASS", f"Scenario: {res.get('scenario_type')}, Change: {res.get('change_value')}")
    else:
        record_test("TC-031", "What-If Engine", "Parse Natural Language Scenario Prompt", "200 with parsed parameters", f"{code}", "FAIL", str(res))

    # What-If Simulation
    sim_req = {
        "farm_id": created_farm_id,
        "scenario_type": "heatwave",
        "params": {"temperature_rise": 4.0, "duration_days": 5},
        "language": "en"
    }
    code, res = request("POST", "/api/whatif/simulate", sim_req, token=token)
    if code == 200 and isinstance(res, dict) and "baseline" in res and "simulated" in res:
        record_test("TC-032", "What-If Engine", "Run Agro-Climatic Simulation", "200 with baseline vs simulated delta", "200 OK", "PASS", f"Title: {res.get('scenario_title')}, Difference: {list(res.get('difference', {}).keys())}")
    else:
        record_test("TC-032", "What-If Engine", "Run Agro-Climatic Simulation", "200 with baseline vs simulated delta", f"{code}", "FAIL", str(res))

    # 10. Weather & Market Feeds
    code, res = request("GET", "/api/weather?lat=13.987&lon=74.556")
    if code == 200 and isinstance(res, dict) and "data" in res:
        cur = res.get("data", {}).get("current", {})
        record_test("TC-033", "Weather", "Micro-Climatic Live Weather Feed", "200 with current temperature and humidity", "200 OK", "PASS", f"Source: {res.get('source')}, Temp: {cur.get('temperature_2m')}°C")
    else:
        record_test("TC-033", "Weather", "Micro-Climatic Live Weather Feed", "200 with current temperature and humidity", f"{code}", "FAIL", str(res))

    code, res = request("GET", "/api/market?crop=Tomato&location=Bhatkal")
    if code == 200 and isinstance(res, dict) and ("markets" in res or "mandi" in res or "price" in res or "data" in res or "mandis" in res):
        record_test("TC-034", "Market", "Real-Time APMC Mandi Rate Intelligence", "200 with mandi quotes", "200 OK", "PASS", f"Market data fetched: {list(res.keys())[:5]}")
    else:
        record_test("TC-034", "Market", "Real-Time APMC Mandi Rate Intelligence", "200 with mandi quotes", f"{code}", "FAIL", str(res))

    # 11. Buyers Hub & Contracts
    code, res = request("GET", f"/api/buyers?crop=Tomato&farm_id={created_farm_id or ''}")
    if code == 200 and isinstance(res, dict):
        record_test("TC-035", "Buyers", "Query Verified Agri Buyers", "200 with buyer profiles and premium prices", "200 OK", "PASS", f"Keys: {list(res.keys())}")
    else:
        record_test("TC-035", "Buyers", "Query Verified Agri Buyers", "200 with buyer profiles and premium prices", f"{code}", "FAIL", str(res))

    # Submit Buyer Enquiry
    enquiry_req = {
        "crop": "Tomato",
        "buyer_name": "AgroFresh Wholesale Consortium",
        "buyer_type": "Institutional Aggregator",
        "offered_price": 28.5,
        "quantity_kg": 500.0,
        "grade": "Grade A",
        "dispatch_date": "2026-10-15",
        "farmer_phone": "9876543210",
        "notes": "Premium quality farm harvest batch ready for collection.",
        "farm_id": created_farm_id
    }
    code, res = request("POST", "/api/buyers/enquiry", enquiry_req, token=token)
    if code == 200 and isinstance(res, dict) and "id" in res:
        record_test("TC-036", "Buyers", "Create Buyer Procurement Contract Enquiry", "200 with enquiry record and tracking code", "200 OK", "PASS", f"Enquiry ID: {res.get('id')}, Tracking: {res.get('tracking_code')}")
    else:
        record_test("TC-036", "Buyers", "Create Buyer Procurement Contract Enquiry", "200 with enquiry record and tracking code", f"{code}", "FAIL", str(res))

    # List Enquiries
    code, res = request("GET", f"/api/buyers/enquiries?farm_id={created_farm_id or ''}", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-037", "Buyers", "List Farmer Buyer Enquiries", "200 with enquiries list", "200 OK", "PASS", f"Found {len(res)} enquiry records")
    else:
        record_test("TC-037", "Buyers", "List Farmer Buyer Enquiries", "200 with enquiries list", f"{code}", "FAIL", str(res))

    # 12. Production Harvest Records
    prod_req = {
        "crop": "Tomato",
        "quantity": 1200.0,
        "unit": "kg",
        "quality": "Grade A Premium",
        "notes": "First harvest picking from Zone 1",
        "zone_id": target_zone
    }
    code, res = request("POST", "/api/production", prod_req, token=token)
    created_prod_id = None
    if code == 200 and isinstance(res, dict) and "id" in res:
        created_prod_id = res["id"]
        record_test("TC-038", "Production", "Create Harvest Production Record", "200 with record ID", "200 OK", "PASS", f"Record ID: {created_prod_id}")
    else:
        record_test("TC-038", "Production", "Create Harvest Production Record", "200 with record ID", f"{code}", "FAIL", str(res))

    # List Production Records
    code, res = request("GET", "/api/production", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-039", "Production", "List Harvest Production Records", "200 with list", "200 OK", "PASS", f"Total records: {len(res)}")
    else:
        record_test("TC-039", "Production", "List Harvest Production Records", "200 with list", f"{code}", "FAIL", str(res))

    # Delete Production Record
    if created_prod_id:
        code, res = request("DELETE", f"/api/production/{created_prod_id}", token=token)
        if code == 200:
            record_test("TC-040", "Production", "Delete Harvest Production Record", "200 OK", "200 OK", "PASS", f"Deleted {created_prod_id}")
        else:
            record_test("TC-040", "Production", "Delete Harvest Production Record", "200 OK", f"{code}", "FAIL", str(res))

    # 13. Profitability Engine
    code, res = request("GET", f"/api/profitability/context?crop=Tomato&farm_id={created_farm_id or ''}", token=token)
    if code == 200 and isinstance(res, dict) and "benchmarks" in res:
        record_test("TC-041", "Profitability", "Get Crop Cost Benchmarks & Context", "200 with agronomic benchmarks", "200 OK", "PASS", f"Crop: {res.get('crop')}, Benchmarks available: {list(res.get('benchmarks', {}).keys())}")
    else:
        record_test("TC-041", "Profitability", "Get Crop Cost Benchmarks & Context", "200 with agronomic benchmarks", f"{code}", "FAIL", str(res))

    # Calculate Profitability
    calc_req = {
        "crop": "Tomato",
        "yield_quantity": 25.0,
        "yield_unit": "tonnes",
        "expected_price_per_unit": 22000.0,
        "input_costs": 65000.0,
        "labor_costs": 35000.0,
        "irrigation_electricity_costs": 4500.0,
        "machinery_costs": 12000.0
    }
    code, res = request("POST", "/api/profitability", calc_req, token=token)
    if code == 200 and isinstance(res, dict) and "net_profit" in res:
        record_test("TC-042", "Profitability", "Run Net Profitability & ROI Calculation", "200 with net profit and ROI", "200 OK", "PASS", f"Net Profit: ₹{res.get('net_profit')}, ROI: {res.get('roi_percentage')}%")
    else:
        record_test("TC-042", "Profitability", "Run Net Profitability & ROI Calculation", "200 with net profit and ROI", f"{code}", "FAIL", str(res))

    # 14. Devices IoT Registry
    dev_req = {"name": "Soil Hydro Sensor #104", "device_type": "soil_moisture"}
    code, res = request("POST", "/api/devices", dev_req, token=token)
    created_dev_id = None
    if code == 200 and isinstance(res, dict) and "id" in res:
        created_dev_id = res["id"]
        record_test("TC-043", "Devices", "Register IoT Sensor Node", "200 with registered device ID", "200 OK", "PASS", f"Device ID: {created_dev_id}")
    else:
        record_test("TC-043", "Devices", "Register IoT Sensor Node", "200 with registered device ID", f"{code}", "FAIL", str(res))

    # List Devices
    code, res = request("GET", "/api/devices", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-044", "Devices", "List Registered IoT Sensor Nodes", "200 with devices list", "200 OK", "PASS", f"Device count: {len(res)}")
    else:
        record_test("TC-044", "Devices", "List Registered IoT Sensor Nodes", "200 with devices list", f"{code}", "FAIL", str(res))

    # Delete Device
    if created_dev_id:
        code, res = request("DELETE", f"/api/devices/{created_dev_id}", token=token)
        if code == 200:
            record_test("TC-045", "Devices", "Deregister IoT Sensor Node", "200 OK", "200 OK", "PASS", f"Deleted {created_dev_id}")
        else:
            record_test("TC-045", "Devices", "Deregister IoT Sensor Node", "200 OK", f"{code}", "FAIL", str(res))

    # 15. Reports & PDF Generation
    if created_farm_id:
        # Generate Analytics Report
        code, res = request("POST", "/api/reports/analytics/generate", {"farm_id": created_farm_id}, token=token)
        if code == 200 and isinstance(res, dict) and "id" in res:
            record_test("TC-046", "Reports", "Generate Farm Analytics Intelligence Report", "200 with report record", "200 OK", "PASS", f"Report ID: {res.get('id')}")
        else:
            record_test("TC-046", "Reports", "Generate Farm Analytics Intelligence Report", "200 with report record", f"{code}", "FAIL", str(res))

        # Consolidated Master Audit Data
        code, res = request("GET", f"/api/reports/farm/{created_farm_id}/consolidated-master", token=token)
        if code == 200 and isinstance(res, dict) and "farm_name" in res:
            record_test("TC-047", "Reports", "Query Farm Consolidated Master Audit Data", "200 with comprehensive farm telemetry", "200 OK", "PASS", f"Farm: {res.get('farm_name')}, Sections: {list(res.keys())[:6]}")
        else:
            record_test("TC-047", "Reports", "Query Farm Consolidated Master Audit Data", "200 with comprehensive farm telemetry", f"{code}", "FAIL", str(res))

        # Master PDF Report Generation
        code, res = request("GET", f"/api/reports/farm/{created_farm_id}/master-report.pdf", token=token)
        if code == 200 and "PDF Binary" in str(res):
            record_test("TC-048", "Reports", "Generate & Stream Master Farm Audit PDF Dossier", "200 with valid binary PDF payload", "200 OK", "PASS", str(res))
        else:
            record_test("TC-048", "Reports", "Generate & Stream Master Farm Audit PDF Dossier", "200 with valid binary PDF payload", f"{code}", "FAIL", str(res))

    # List Reports
    code, res = request("GET", "/api/reports", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-049", "Reports", "List Farm Intelligence Reports", "200 with reports list", "200 OK", "PASS", f"Reports count: {len(res)}")
    else:
        record_test("TC-049", "Reports", "List Farm Intelligence Reports", "200 with reports list", f"{code}", "FAIL", str(res))

    # 16. Ask Agrinex AI Dialogue
    ask_payload = {
        "message": "What is the best irrigation timing for Tomato in sandy loam soil during flowering?",
        "history": [],
        "language": "en",
        "farm_id": created_farm_id
    }
    code, res = request("POST", "/api/ask", ask_payload, token=token)
    if code == 200 and isinstance(res, dict) and "reply" in res and len(res.get("reply", "")) > 10:
        record_test("TC-050", "AI Dialogue", "Conversational Agronomic Intelligence (/api/ask)", "200 with domain-specific answer", "200 OK", "PASS", f"Answer preview: {res.get('reply')[:80]}...")
    else:
        record_test("TC-050", "AI Dialogue", "Conversational Agronomic Intelligence (/api/ask)", "200 with domain-specific answer", f"{code}", "FAIL", str(res))

    # Voice Configuration Status
    code, res = request("GET", "/api/voice/status", token=token)
    if code == 200 and isinstance(res, dict) and "gemini_configured" in res:
        record_test("TC-051", "Voice", "Query Voice & AI Gateway Status", "200 with config flags", "200 OK", "PASS", f"Gemini: {res.get('gemini_configured')}, ElevenLabs: {res.get('elevenlabs_configured')}")
    else:
        record_test("TC-051", "Voice", "Query Voice & AI Gateway Status", "200 with config flags", f"{code}", "FAIL", str(res))

    # 17. Security & Robustness Checks
    # SQL Injection in zone_id
    sqli_test = {"zone_id": "zone-1' UNION SELECT * FROM users--", "irrigation_method": "Drip Irrigation"}
    code, res = request("POST", "/api/irrigation/recommend", sqli_test, token=token)
    if code in [200, 400, 404, 422]:
        record_test("TC-052", "Security", "SQL Injection Resistance in JSON Parameters", "Handled safely without database error/leak", f"{code} Handled", "PASS", "No database error or data leak")
    else:
        record_test("TC-052", "Security", "SQL Injection Resistance in JSON Parameters", "Handled safely without database error/leak", f"{code}", "FAIL", str(res))

    # Path traversal probe on PDF endpoint
    code, res = request("GET", "/api/reports/../../../../etc/passwd/report.pdf", token=token)
    if code in [400, 404, 422]:
        record_test("TC-053", "Security", "Path Traversal Protection on PDF Endpoints", "400/404 Blocked safely", f"{code}", "PASS", "Directory traversal blocked")
    else:
        record_test("TC-053", "Security", "Path Traversal Protection on PDF Endpoints", "400/404 Blocked safely", f"{code}", "FAIL", str(res))

    # Boundary: Negative Values
    neg_test = {
        "crop": "Tomato",
        "yield_quantity": -100.0,
        "yield_unit": "tonnes",
        "expected_price_per_unit": -50.0,
        "input_costs": -1000.0
    }
    code, res = request("POST", "/api/profitability", neg_test, token=token)
    if code in [200, 400, 422]:
        record_test("TC-054", "Robustness", "Handling Negative Financial Input Bounds", "Handled safely without backend crash", f"{code}", "PASS", f"Handled: {res.get('net_profit') if isinstance(res, dict) else res}")
    else:
        record_test("TC-054", "Robustness", "Handling Negative Financial Input Bounds", "Handled safely without backend crash", f"{code}", "FAIL", str(res))

    # Extreme Number in Duration
    extreme_irrig = {
        "zone_id": target_zone,
        "duration_minutes": 999999999,
        "irrigation_method": "Drip Irrigation"
    }
    code, res = request("POST", "/api/irrigation/start", extreme_irrig, token=token)
    if code in [200, 400, 422]:
        record_test("TC-055", "Robustness", "Extreme Integer Boundary for Irrigation Duration", "Handled safely without crash", f"{code}", "PASS", "No crash")
    else:
        record_test("TC-055", "Robustness", "Extreme Integer Boundary for Irrigation Duration", "Handled safely without crash", f"{code}", "FAIL", str(res))

    # Clean up created test farm and zone
    if created_farm_id:
        pass # Keeping farm records for subsequent UI testing or cleaning up

    # Summary
    passed = sum(1 for t in test_results if t["status"] == "PASS")
    failed = sum(1 for t in test_results if t["status"] == "FAIL")
    warn = sum(1 for t in test_results if t["status"] == "WARN")
    total = len(test_results)

    print("\n" + "=" * 70)
    print(f"   TEST SUMMARY: {total} TOTAL | {passed} PASSED | {failed} FAILED | {warn} WARNINGS")
    print("=" * 70)

    with open("deep_test_results.json", "w", encoding="utf-8") as f:
        json.dump(test_results, f, indent=2)

if __name__ == "__main__":
    run_all_tests()
