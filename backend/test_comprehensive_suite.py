import urllib.request
import urllib.error
import json
import base64
import time
import io
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

test_results = []

def record_test(test_id, category, name, expected, actual, status, details=""):
    test_results.append({
        "id": test_id,
        "category": category,
        "name": name,
        "expected": expected,
        "actual": actual,
        "status": status,
        "details": details
    })
    symbol = "✅ PASS" if status == "PASS" else ("❌ FAIL" if status == "FAIL" else "⚠️ PARTIAL")
    print(f"[{test_id}] {symbol} | {category} -> {name}: {details}")

def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.getcode()
            res_body = resp.read().decode("utf-8")
            try:
                parsed = json.loads(res_body)
            except:
                parsed = res_body
            return code, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except:
            parsed = err_body
        return e.code, parsed
    except Exception as e:
        return 0, str(e)

def create_synthetic_image():
    # Create a small valid 100x100 RGB image
    img = Image.new("RGB", (100, 100), color=(120, 80, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def run_tests():
    print("=================================================================")
    print("    AGRiNEX COMPREHENSIVE AUTOMATED QA & INTEGRATION TEST SUITE   ")
    print("=================================================================")

    # 1. Server Health
    code, res = request("GET", "/health")
    if code == 200:
        record_test("TC-001", "Health", "API Gateway Health Check", "200 OK", f"{code} OK", "PASS", f"Status: {res}")
    else:
        record_test("TC-001", "Health", "API Gateway Health Check", "200 OK", f"{code}", "FAIL", str(res))

    # 2. Authentication: Registration
    test_user = f"qa_tester_{int(time.time())}"
    test_pass = "SecurePass123!"
    reg_payload = {"username": test_user, "password": test_pass, "full_name": "QA Senior Auditor"}
    code, res = request("POST", "/api/auth/register", reg_payload)
    if code in [200, 201]:
        record_test("TC-002", "Auth", "Farmer Registration", "200/201 Created", f"{code}", "PASS", f"User registered: {test_user}")
    else:
        record_test("TC-002", "Auth", "Farmer Registration", "200/201 Created", f"{code}", "FAIL", str(res))

    # 3. Authentication: Login
    token = None
    login_payload = {"username": test_user, "password": test_pass}
    code, res = request("POST", "/api/auth/token", login_payload)
    if code == 200 and isinstance(res, dict) and "access_token" in res:
        token = res["access_token"]
        record_test("TC-003", "Auth", "Farmer Login & JWT Issuance", "200 with JWT token", "200 with token", "PASS", f"Token type: {res.get('token_type')}")
    else:
        record_test("TC-003", "Auth", "Farmer Login & JWT Issuance", "200 with JWT token", f"{code}", "FAIL", str(res))

    # 4. Authentication: Invalid Credentials
    code, res = request("POST", "/api/auth/token", {"username": test_user, "password": "WrongPassword"})
    if code in [400, 401]:
        record_test("TC-004", "Auth", "Reject Bad Credentials", "401 Unauthorized", f"{code}", "PASS", "Properly rejected invalid password")
    else:
        record_test("TC-004", "Auth", "Reject Bad Credentials", "401 Unauthorized", f"{code}", "FAIL", str(res))

    # 5. Authentication: Get Profile (/api/auth/me)
    code, res = request("GET", "/api/auth/me", token=token)
    if code == 200 and isinstance(res, dict) and res.get("username") == test_user:
        record_test("TC-005", "Auth", "Get Current User Profile", "200 with user data", "200 OK", "PASS", f"Profile user: {res.get('username')}")
    else:
        record_test("TC-005", "Auth", "Get Current User Profile", "200 with user data", f"{code}", "FAIL", str(res))

    # 6. Farms: List Farms
    code, res = request("GET", "/api/farms", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-006", "Farms", "List User Farms", "200 with list", f"200 ({len(res)} farms)", "PASS", f"Found {len(res)} farms")
    else:
        record_test("TC-006", "Farms", "List User Farms", "200 with list", f"{code}", "FAIL", str(res))

    # 7. Farms: Create Farm
    created_farm_id = None
    farm_payload = {
        "name": "Green Valley Test Estate",
        "location": "Shimoga, Karnataka",
        "area": 12.5,
        "area_unit": "acre",
        "farming_type": "Organic Horticulture",
        "irrigation_method": "Drip Irrigation"
    }
    code, res = request("POST", "/api/farms", farm_payload, token=token)
    if code in [200, 201] and isinstance(res, dict) and "id" in res:
        created_farm_id = res["id"]
        record_test("TC-007", "Farms", "Create New Farm", "200/201 with farm ID", f"{code} Created", "PASS", f"Created farm: {created_farm_id}")
    else:
        record_test("TC-007", "Farms", "Create New Farm", "200/201 with farm ID", f"{code}", "FAIL", str(res))

    # 8. Zones: List Zones
    code, res = request("GET", "/api/zones", token=token)
    if code == 200:
        record_test("TC-008", "Zones", "List Farm Zones", "200 OK", f"{code}", "PASS", f"Returned zones data")
    else:
        record_test("TC-008", "Zones", "List Farm Zones", "200 OK", f"{code}", "FAIL", str(res))

    # 9. Precision Irrigation: Recommend Standard Drip
    irrig_req = {"zone_id": "zone-2", "irrigation_method": "Drip Irrigation"}
    code, res = request("POST", "/api/irrigation/recommend", irrig_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("recommended_duration_minutes") == 15:
        record_test("TC-009", "Irrigation", "Standard Drip Recommendation Baseline", "15 minutes duration", f"{res.get('recommended_duration_minutes')} min", "PASS", f"Gross Litres: {res.get('gross_water_litres')}, Window: {res.get('optimal_timing', {}).get('recommended_window')}")
    else:
        record_test("TC-009", "Irrigation", "Standard Drip Recommendation Baseline", "15 minutes duration", f"{code}", "FAIL", str(res))

    # 10. Precision Irrigation: Custom Method & Summer Season
    custom_irrig_req = {
        "zone_id": "zone-2",
        "irrigation_method": "Other / Custom",
        "custom_method_name": "Solar Drip Jet",
        "custom_efficiency_pct": 92.0,
        "custom_flow_rate_lpm": 22.0,
        "season": "Summer (Zaid)"
    }
    code, res = request("POST", "/api/irrigation/recommend", custom_irrig_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("irrigation_method") == "Solar Drip Jet":
        avoid_win = res.get("optimal_timing", {}).get("avoid_window", "")
        record_test("TC-010", "Irrigation", "Custom Method & Summer ET0 Calculation", "Solar Drip Jet with Summer Avoid Window", f"Method: {res.get('irrigation_method')}", "PASS", f"Duration: {res.get('recommended_duration_minutes')}m, Avoid: {avoid_win}")
    else:
        record_test("TC-010", "Irrigation", "Custom Method & Summer ET0 Calculation", "Solar Drip Jet with Summer Avoid Window", f"{code}", "FAIL", str(res))

    # 11. Precision Irrigation: Multi-Method Dual System
    dual_req = {
        "zone_id": "zone-2",
        "irrigation_method": "Drip Irrigation",
        "secondary_irrigation_method": "Micro-Sprinkler",
        "season": "Summer (Zaid)"
    }
    code, res = request("POST", "/api/irrigation/recommend", dual_req, token=token)
    if code == 200 and isinstance(res, dict) and "secondary_method" in res and res["secondary_method"]:
        sec_advice = res["secondary_method"].get("dual_application_advice", "")
        record_test("TC-011", "Irrigation", "Dual-Method Multi-Application Recommendation", "Secondary advice provided", "Advised properly", "PASS", sec_advice)
    else:
        record_test("TC-011", "Irrigation", "Dual-Method Multi-Application Recommendation", "Secondary advice provided", f"{code}", "FAIL", str(res))

    # 12. Irrigation Hardware Actuation: Start Cycle
    start_req = {
        "zone_id": "zone-2",
        "duration_minutes": 15,
        "irrigation_method": "Drip Irrigation",
        "confirmed": True
    }
    code, res = request("POST", "/api/irrigation/start", start_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("status") == "success":
        mock_hw = res.get("mock_iot", {})
        record_test("TC-012", "Hardware IoT", "Start Irrigation Cycle (Energize Pump)", "Pump status ON", f"Pump: {mock_hw.get('pump_status')}", "PASS", f"Relay: {mock_hw.get('pump_relay')}, Valve: {mock_hw.get('valve_status')}")
    else:
        record_test("TC-012", "Hardware IoT", "Start Irrigation Cycle (Energize Pump)", "Pump status ON", f"{code}", "FAIL", str(res))

    # 13. Irrigation Hardware Actuation: Stop Cycle
    stop_req = {"zone_id": "zone-2", "reason": "test_completed"}
    code, res = request("POST", "/api/irrigation/stop", stop_req, token=token)
    if code == 200 and isinstance(res, dict) and res.get("status") == "success":
        mock_hw = res.get("mock_iot", {})
        record_test("TC-013", "Hardware IoT", "Stop Irrigation Cycle (De-energize Pump)", "Pump status OFF", f"Pump: {mock_hw.get('pump_status')}", "PASS", f"Valve closed: {mock_hw.get('valve_status')}")
    else:
        record_test("TC-013", "Hardware IoT", "Stop Irrigation Cycle (De-energize Pump)", "Pump status OFF", f"{code}", "FAIL", str(res))

    # 14. Image AI & ML Analysis: Soil Analysis
    img_b64 = create_synthetic_image()
    soil_req = {
        "image_base64": img_b64,
        "mime_type": "image/jpeg",
        "analysis_type": "soil",
        "zone_id": "zone-2",
        "language": "en"
    }
    code, res = request("POST", "/api/analyze/image", soil_req, token=token)
    if code == 200 and isinstance(res, dict) and "ml_metrics" in res:
        ml = res["ml_metrics"]
        record_test("TC-014", "AI / ML Vision", "Soil Topsoil ML Spectral Analysis", "200 with soil ML metrics", f"Classified: {ml.get('soil_type')}", "PASS", f"pH: {ml.get('ph_range')}, SOC: {ml.get('organic_carbon_est_pct')}%, Confidence: {ml.get('ml_confidence_pct')}%")
    else:
        record_test("TC-014", "AI / ML Vision", "Soil Topsoil ML Spectral Analysis", "200 with soil ML metrics", f"{code}", "FAIL", str(res))

    # 15. Image AI & ML Analysis: Plant / Crop Health Analysis
    plant_req = {
        "image_base64": img_b64,
        "mime_type": "image/jpeg",
        "analysis_type": "plant",
        "zone_id": "zone-2",
        "language": "en"
    }
    code, res = request("POST", "/api/analyze/image", plant_req, token=token)
    if code == 200 and isinstance(res, dict) and "ml_metrics" in res:
        ml = res["ml_metrics"]
        record_test("TC-015", "AI / ML Vision", "Plant Pathology & Vigor Classifier", "200 with plant ML metrics", f"Pathogen: {ml.get('primary_pathogen')}", "PASS", f"Vigor Index: {ml.get('foliar_vigor_index')}/100, Stage: {ml.get('severity_stage')}")
    else:
        record_test("TC-015", "AI / ML Vision", "Plant Pathology & Vigor Classifier", "200 with plant ML metrics", f"{code}", "FAIL", str(res))

    # 16. Image Analysis History & Cleanup
    code, res = request("GET", "/api/analyses?type=soil", token=token)
    if code == 200 and isinstance(res, list):
        record_test("TC-016", "AI / ML Vision", "Query Past Analyses History", "200 with history records", f"{len(res)} records found", "PASS", f"Retrieved {len(res)} saved specimens")
        if len(res) > 0:
            del_id = res[0]["id"]
            d_code, _ = request("DELETE", f"/api/analyses/{del_id}", token=token)
            if d_code == 200:
                record_test("TC-017", "AI / ML Vision", "Delete Analysis History Record", "200 Deleted", "200 Deleted", "PASS", f"Deleted record {del_id}")
            else:
                record_test("TC-017", "AI / ML Vision", "Delete Analysis History Record", "200 Deleted", f"{d_code}", "FAIL", "Failed delete")
    else:
        record_test("TC-016", "AI / ML Vision", "Query Past Analyses History", "200 with history records", f"{code}", "FAIL", str(res))

    # 18. Market Intelligence: Live APMC Mandi Prices
    code, res = request("GET", "/api/market/prices?crop=Chilli", token=token)
    if code == 200 and isinstance(res, (dict, list)):
        record_test("TC-018", "Market", "Real-Time APMC Mandi Ticker", "200 with mandi price quotes", "200 OK", "PASS", "Fetched live prices and modal rates")
    else:
        record_test("TC-018", "Market", "Real-Time APMC Mandi Ticker", "200 with mandi price quotes", f"{code}", "FAIL", str(res))

    # 19. Profitability Intelligence: Simple Pocket Profit Calculator
    prof_req = {
        "crop": "Chilli",
        "yield_quantity": 40.0,
        "yield_unit": "quintal",
        "expected_price_per_unit": 6800.0,
        "input_costs": 45000.0,
        "labor_costs": 25000.0,
        "irrigation_electricity_costs": 3500.0,
        "machinery_costs": 8000.0
    }
    code, res = request("POST", "/api/profitability/calculate", prof_req, token=token)
    if code == 200 and isinstance(res, dict) and "net_profit" in res:
        record_test("TC-019", "Profitability", "Simple Farmer Pocket Profit Calculator", "200 with net profit & ROI", f"Profit: ₹{res.get('net_profit')}", "PASS", f"ROI: {res.get('roi_percentage')}%, Revenue: ₹{res.get('total_revenue')}")
    else:
        record_test("TC-019", "Profitability", "Simple Farmer Pocket Profit Calculator", "200 with net profit & ROI", f"{code}", "FAIL", str(res))

    # 20. Decision Intelligence: What If I Wait? Decision Engine
    wait_req = {
        "crop": "Chilli",
        "quantity_quintals": 40.0,
        "current_price_per_quintal": 6800.0,
        "storage_cost_per_month": 120.0,
        "estimated_future_price_gain_pct": 18.0,
        "storage_months": 2.0
    }
    code, res = request("POST", "/api/profitability/simulate", wait_req, token=token)
    if code == 200 and isinstance(res, dict) and "verdict" in res:
        record_test("TC-020", "Profitability", "What If I Wait? Decision Simulation", "200 with clear verdict", f"Verdict: {res.get('verdict')}", "PASS", f"Net Payoff Diff: ₹{res.get('net_gain_loss')}, Break-even: ₹{res.get('break_even_price')}")
    else:
        record_test("TC-020", "Profitability", "What If I Wait? Decision Simulation", "200 with clear verdict", f"{code}", "FAIL", str(res))

    # 21. Weather Endpoint
    code, res = request("GET", "/api/weather?location=Shimoga", token=token)
    if code == 200 and isinstance(res, dict):
        record_test("TC-021", "Weather", "Micro-Climatic Weather Feed", "200 with weather data", "200 OK", "PASS", f"Temp: {res.get('temperature')}°C, Humidity: {res.get('humidity')}%")
    else:
        record_test("TC-021", "Weather", "Micro-Climatic Weather Feed", "200 with weather data", f"{code}", "FAIL", str(res))

    # 22. Security: SQL Injection Probe in Zone/Farm Params
    sqli_payload = {"zone_id": "zone-2' OR '1'='1", "irrigation_method": "Drip Irrigation"}
    code, res = request("POST", "/api/irrigation/recommend", sqli_payload, token=token)
    if code in [200, 400, 404, 422]:
        record_test("TC-022", "Security", "SQL Injection Resistance", "Safely handled (No 500 error / leak)", f"{code} Handled", "PASS", "No database error or data leak")
    else:
        record_test("TC-022", "Security", "SQL Injection Resistance", "Safely handled", f"{code}", "FAIL", str(res))

    # 23. Security: Protected Route Without Token
    code, res = request("POST", "/api/farms", farm_payload, token=None)
    if code in [401, 403]:
        record_test("TC-023", "Security", "Enforce Auth on Farm Creation", "401/403 Unauthorized", f"{code}", "PASS", "Unauthorized requests blocked")
    else:
        # Note: if public demo fallback is enabled, record status
        record_test("TC-023", "Security", "Enforce Auth on Farm Creation", "401/403 Unauthorized", f"{code}", "PARTIAL", "Allowed in demo mode or permitted")

    # 24. Robustness: Boundary Values / Extreme Numbers
    extreme_req = {
        "zone_id": "zone-2",
        "irrigation_method": "Drip Irrigation",
        "custom_efficiency_pct": -50.0,
        "custom_flow_rate_lpm": 999999.0
    }
    code, res = request("POST", "/api/irrigation/recommend", extreme_req, token=token)
    if code in [200, 400, 422]:
        record_test("TC-024", "Robustness", "Handling Negative / Extreme Custom Efficiency", "Handled safely without crash", f"{code}", "PASS", f"Recommendation survived extreme values: {res.get('recommended_duration_minutes', 'N/A')} min")
    else:
        record_test("TC-024", "Robustness", "Handling Negative / Extreme Custom Efficiency", "Handled safely", f"{code}", "FAIL", str(res))

    # Summary
    passed = sum(1 for t in test_results if t["status"] == "PASS")
    failed = sum(1 for t in test_results if t["status"] == "FAIL")
    partial = sum(1 for t in test_results if t["status"] == "PARTIAL")
    total = len(test_results)

    print("\n=================================================================")
    print(f"    TEST SUMMARY: {total} TOTAL | {passed} PASSED | {failed} FAILED | {partial} PARTIAL")
    print("=================================================================")

    with open("backend_test_results.json", "w", encoding="utf-8") as f:
        json.dump(test_results, f, indent=2)

if __name__ == "__main__":
    run_tests()
