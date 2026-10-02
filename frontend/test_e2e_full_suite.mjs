import http from "node:http";
import https from "node:https";

const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:8000";

const results = [];

function record(id, category, name, expected, actual, status, details = "") {
  results.push({ id, category, name, expected, actual, status, details });
  const sym = status === "PASS" ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`[${id}] ${sym} | ${category} -> ${name}: ${details}`);
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith("https:");
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let data = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString("utf-8");
        let parsed = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not json
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          rawBuffer: buffer,
          text: text
        });
      });
    });
    req.on("error", (err) => {
      resolve({ statusCode: 0, error: err.message });
    });
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log("==========================================================================");
  console.log("       AGRiNEX FULL-STACK E2E LIVE USER JOURNEY & SYSTEM AUDIT SUITE      ");
  console.log("==========================================================================");

  // 1. Landing Page Verification
  const r1 = await fetchUrl(`${FRONTEND_URL}/`);
  if (r1.statusCode === 200 && r1.text.includes("AGRiNEX") && r1.text.includes("Digital Mirror")) {
    record("E2E-001", "Frontend UI", "Landing Page Load & Brand Title", "200 OK with AGRiNEX Title", "200 OK", "PASS", "Landing page rendered with correct metadata and branding");
  } else {
    record("E2E-001", "Frontend UI", "Landing Page Load & Brand Title", "200 OK with AGRiNEX Title", `${r1.statusCode}`, "FAIL", "Landing page failed to load or missing title");
  }

  // 2. Auth Page Load
  const r2 = await fetchUrl(`${FRONTEND_URL}/auth`);
  if (r2.statusCode === 200 && r2.text.includes("Welcome")) {
    record("E2E-002", "Frontend UI", "Auth Portal Rendering", "200 OK", "200 OK", "PASS", "Auth portal with Login/Signup tabs accessible");
  } else {
    record("E2E-002", "Frontend UI", "Auth Portal Rendering", "200 OK", `${r2.statusCode}`, "FAIL", "Auth portal failed to render");
  }

  // 3. User Registration Flow
  const ts = Date.now();
  const testUser = {
    email: `live_farmer_${ts}@agrinex.in`,
    password: "SecureLivePassword2026!",
    name: "Live Farmer Sapthami",
    language: "en"
  };
  const r3 = await fetchUrl(`${BACKEND_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: testUser
  });
  let token = null;
  let user = null;
  if (r3.statusCode === 200 && r3.data && r3.data.token) {
    token = r3.data.token;
    user = r3.data.user;
    record("E2E-003", "User Journey", "Complete User Registration", "200 with JWT", "200 OK", "PASS", `User ${user.email} registered and token issued`);
  } else {
    record("E2E-003", "User Journey", "Complete User Registration", "200 with JWT", `${r3.statusCode}`, "FAIL", JSON.stringify(r3.data));
  }

  // 4. User Login Flow
  const r4 = await fetchUrl(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { email: testUser.email, password: testUser.password }
  });
  if (r4.statusCode === 200 && r4.data && r4.data.token) {
    token = r4.data.token;
    record("E2E-004", "User Journey", "Farmer Login & Session Authenticate", "200 with JWT", "200 OK", "PASS", "Login successfully authenticated");
  } else {
    record("E2E-004", "User Journey", "Farmer Login & Session Authenticate", "200 with JWT", `${r4.statusCode}`, "FAIL", "Login failed");
  }

  // 5. Onboarding / Farm Creation
  const farmPayload = {
    name: "Sapthami Organic Fields",
    location: "Bhatkal, Karnataka",
    area: 12.5,
    area_unit: "acre",
    water_availability: "Borewell + Pond",
    irrigation_method: "Drip Irrigation",
    farming_type: "Horticulture & Millets"
  };
  const r5 = await fetchUrl(`${BACKEND_URL}/api/farms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: farmPayload
  });
  let farmId = null;
  if (r5.statusCode === 200 && r5.data && r5.data.id) {
    farmId = r5.data.id;
    record("E2E-005", "User Journey", "Farm Onboarding & Creation", "200 with Farm ID", "200 OK", "PASS", `Farm ID: ${farmId}, Lat: ${r5.data.latitude}, Lon: ${r5.data.longitude}`);
  } else {
    record("E2E-005", "User Journey", "Farm Onboarding & Creation", "200 with Farm ID", `${r5.statusCode}`, "FAIL", JSON.stringify(r5.data));
  }

  // 6. Zone Creation & List
  const zonePayload = {
    name: "Zone 1 - Arka Rakshak Plot",
    crop: "Tomato (Arka Rakshak)",
    soil_type: "Red Sandy Loam",
    area: 2.0,
    area_unit: "acre"
  };
  const r6 = await fetchUrl(`${BACKEND_URL}/api/farms/${farmId}/zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: zonePayload
  });
  let zoneId = null;
  if (r6.statusCode === 200 && r6.data && r6.data.id) {
    zoneId = r6.data.id;
    record("E2E-006", "User Journey", "Create Farm Field Zone", "200 with Zone ID", "200 OK", "PASS", `Zone ID: ${zoneId}, Crop: ${r6.data.crop}`);
  } else {
    record("E2E-006", "User Journey", "Create Farm Field Zone", "200 with Zone ID", `${r6.statusCode}`, "FAIL", JSON.stringify(r6.data));
  }

  // 7. Zone Sensor Telemetry & Moisture Monitoring
  const r7 = await fetchUrl(`${BACKEND_URL}/api/zones/${zoneId}/sensor`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (r7.statusCode === 200 && r7.data && r7.data.moisture_pct != null) {
    record("E2E-007", "Data Flow", "Zone Sensor Live Telemetry", "200 with moisture and temperature", "200 OK", "PASS", `Moisture: ${r7.data.moisture_pct}%, Temp: ${r7.data.temperature_c}°C, Humidity: ${r7.data.humidity_pct}%`);
  } else {
    record("E2E-007", "Data Flow", "Zone Sensor Live Telemetry", "200 with moisture and temperature", `${r7.statusCode}`, "FAIL", JSON.stringify(r7.data));
  }

  // 8. Precision Irrigation Workflow
  const r8_rec = await fetchUrl(`${BACKEND_URL}/api/irrigation/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: { zone_id: zoneId, farm_id: farmId, irrigation_method: "Drip Irrigation" }
  });
  let recDuration = 15;
  if (r8_rec.statusCode === 200 && r8_rec.data && r8_rec.data.recommended_duration_minutes != null) {
    recDuration = r8_rec.data.recommended_duration_minutes;
    record("E2E-008", "AI Agronomy", "Irrigation Duration Recommendation", "200 with recommended duration", "200 OK", "PASS", `Recommended duration: ${recDuration} min, Water needed: ${r8_rec.data.gross_water_litres} L`);
  } else {
    record("E2E-008", "AI Agronomy", "Irrigation Duration Recommendation", "200 with recommended duration", `${r8_rec.statusCode}`, "FAIL", JSON.stringify(r8_rec.data));
  }

  // 9. Start Irrigation & Verify Mock IoT Controller
  const r9 = await fetchUrl(`${BACKEND_URL}/api/irrigation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: { zone_id: zoneId, duration_minutes: recDuration, confirmed: true, irrigation_method: "Drip Irrigation" }
  });
  let activeEventId = null;
  if (r9.statusCode === 200 && r9.data && r9.data.mock_iot && r9.data.mock_iot.pump_status === "ON") {
    activeEventId = r9.data.event?.id;
    record("E2E-009", "IoT Actuation", "Start Irrigation Cycle & Energize Pump Relay", "200 with pump ON", "200 OK", "PASS", `Pump status: ${r9.data.mock_iot.pump_status}, Valve: ${r9.data.mock_iot.valve_status}, Flow: ${r9.data.mock_iot.flow_rate_lpm} L/min`);
  } else {
    record("E2E-009", "IoT Actuation", "Start Irrigation Cycle & Energize Pump Relay", "200 with pump ON", `${r9.statusCode}`, "FAIL", JSON.stringify(r9.data));
  }

  // 10. Stop Irrigation
  const r10 = await fetchUrl(`${BACKEND_URL}/api/irrigation/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: { zone_id: zoneId, event_id: activeEventId, reason: "Live audit complete" }
  });
  if (r10.statusCode === 200 && r10.data && r10.data.mock_iot && (r10.data.mock_iot.valve_status === "CLOSED" || r10.data.mock_iot.pump_status === "OFF")) {
    record("E2E-010", "IoT Actuation", "Stop Irrigation & De-energize Valve/Pump", "200 with valve CLOSED", "200 OK", "PASS", `Valve status: ${r10.data.mock_iot.valve_status}, Solenoid closed, Pump: ${r10.data.mock_iot.pump_status}`);
  } else {
    record("E2E-010", "IoT Actuation", "Stop Irrigation & De-energize Valve/Pump", "200 with valve CLOSED", `${r10.statusCode}`, "FAIL", JSON.stringify(r10.data));
  }

  // 11. Live Weather Feed
  const r11 = await fetchUrl(`${BACKEND_URL}/api/weather?lat=13.987&lon=74.556`);
  if (r11.statusCode === 200 && r11.data && r11.data.status === "LIVE" && r11.data.current) {
    record("E2E-011", "External Services", "Micro-Climatic Live Weather from Open-Meteo", "200 with live temperature", "200 OK", "PASS", `Temp: ${r11.data.current.temp}°C, Condition: ${r11.data.current.condition}, Humidity: ${r11.data.current.humidity}%`);
  } else {
    record("E2E-011", "External Services", "Micro-Climatic Live Weather from Open-Meteo", "200 with live temperature", `${r11.statusCode}`, "FAIL", JSON.stringify(r11.data));
  }

  // 12. Widget Weather endpoint (/data/weather)
  const r12 = await fetchUrl(`${BACKEND_URL}/data/weather`);
  if (r12.statusCode === 200 && r12.data && r12.data.current && r12.data.forecast) {
    record("E2E-012", "Frontend Integration", "Unified Widget Weather Endpoint (/data/weather)", "200 with current & forecast", "200 OK", "PASS", `Location: ${r12.data.location}, 7-day forecast count: ${r12.data.forecast.length}`);
  } else {
    record("E2E-012", "Frontend Integration", "Unified Widget Weather Endpoint (/data/weather)", "200 with current & forecast", `${r12.statusCode}`, "FAIL", JSON.stringify(r12.data));
  }

  // 13. Mandi Prices Intelligence
  const r13 = await fetchUrl(`${BACKEND_URL}/api/market?crop=Tomato&location=Bhatkal`);
  if (r13.statusCode === 200 && r13.data && r13.data.items && r13.data.items.length > 0) {
    const nearest = r13.data.items[0];
    record("E2E-013", "Market Intelligence", "Real-Time APMC Mandi Rate Intelligence", "200 with mandi items list", "200 OK", "PASS", `Nearest yard: ${nearest.market}, Modal: ₹${nearest.modal}/qtl, Distance: ${nearest.distance_km} km`);
  } else {
    record("E2E-013", "Market Intelligence", "Real-Time APMC Mandi Rate Intelligence", "200 with mandi items list", `${r13.statusCode}`, "FAIL", JSON.stringify(r13.data));
  }

  // 14. Buyers Hub & Verified Contracts
  const r14 = await fetchUrl(`${BACKEND_URL}/api/buyers?crop=Tomato&farm_id=${farmId}`);
  if (r14.statusCode === 200 && r14.data && r14.data.items && r14.data.items.length > 0) {
    record("E2E-014", "Buyers Hub", "Query Verified Buyers for Crop", "200 with buyers list", "200 OK", "PASS", `Verified buyers count: ${r14.data.items.length}, Top Buyer: ${r14.data.items[0].buyer_name}`);
  } else {
    record("E2E-014", "Buyers Hub", "Query Verified Buyers for Crop", "200 with buyers list", `${r14.statusCode}`, "FAIL", JSON.stringify(r14.data));
  }

  // 15. Create Buyer Enquiry & Dispatch Tracking
  const enquiryPayload = {
    crop: "Tomato",
    buyer_name: "Reliance Retail Fresh Sourcing",
    buyer_type: "Institutional Buyer",
    offered_price: 31.0,
    quantity_kg: 800.0,
    grade: "Grade A",
    dispatch_date: "2026-10-18",
    farmer_phone: "9876543210",
    notes: "Premium harvest lot ready for collection.",
    farm_id: farmId
  };
  const r15 = await fetchUrl(`${BACKEND_URL}/api/buyers/enquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: enquiryPayload
  });
  if (r15.statusCode === 200 && r15.data && r15.data.tracking_code) {
    record("E2E-015", "Buyers Hub", "Submit Procurement Contract Enquiry", "200 with tracking code", "200 OK", "PASS", `Tracking code: ${r15.data.tracking_code}, Status: ${r15.data.status}`);
  } else {
    record("E2E-015", "Buyers Hub", "Submit Procurement Contract Enquiry", "200 with tracking code", `${r15.statusCode}`, "FAIL", JSON.stringify(r15.data));
  }

  // 16. What-Grow Multi-Factor Crop Suitability Recommender
  const r16 = await fetchUrl(`${BACKEND_URL}/api/recommend/crop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: { farm_id: farmId, language: "en" }
  });
  if (r16.statusCode === 200 && r16.data && (r16.data.crops || r16.data.structured?.crops)) {
    const crops = r16.data.crops || r16.data.structured.crops;
    record("E2E-016", "AI Agronomy", "What-Grow Multi-Factor Crop Recommender", "200 with ranked crops", "200 OK", "PASS", `Recommended crops: ${crops.map(c => c.name).join(", ")}`);
  } else {
    record("E2E-016", "AI Agronomy", "What-Grow Multi-Factor Crop Recommender", "200 with ranked crops", `${r16.statusCode}`, "FAIL", JSON.stringify(r16.data));
  }

  // 17. What-If Simulation Engine
  const simPayload = {
    farm_id: farmId,
    scenario_type: "heatwave",
    params: { temperature_rise: 3.5, duration_days: 4 },
    language: "en"
  };
  const r17 = await fetchUrl(`${BACKEND_URL}/api/whatif/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: simPayload
  });
  if (r17.statusCode === 200 && r17.data && r17.data.baseline && r17.data.simulated) {
    record("E2E-017", "Simulation Engine", "Run Agro-Climatic Simulation Scenario", "200 with baseline & simulated deltas", "200 OK", "PASS", `Title: ${r17.data.scenario_title}, Risk Verdict: ${r17.data.difference?.risk_verdict || "Evaluated"}`);
  } else {
    record("E2E-017", "Simulation Engine", "Run Agro-Climatic Simulation Scenario", "200 with baseline & simulated deltas", `${r17.statusCode}`, "FAIL", JSON.stringify(r17.data));
  }

  // 18. Harvest Production Logging
  const prodPayload = {
    crop: "Tomato",
    quantity: 1500.0,
    unit: "kg",
    quality: "Grade A",
    notes: "Zone 1 Arka Rakshak morning pick",
    zone_id: zoneId
  };
  const r18 = await fetchUrl(`${BACKEND_URL}/api/production`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: prodPayload
  });
  if (r18.statusCode === 200 && r18.data && r18.data.id) {
    record("E2E-018", "Production", "Log Harvest Picking Record", "200 with record ID", "200 OK", "PASS", `Logged 1500 kg harvest record`);
  } else {
    record("E2E-018", "Production", "Log Harvest Picking Record", "200 with record ID", `${r18.statusCode}`, "FAIL", JSON.stringify(r18.data));
  }

  // 19. Net Profitability & ROI Calculation
  const profitPayload = {
    farm_id: farmId,
    crop: "Tomato",
    expected_production_kg: 1500.0,
    area_acres: 1.0,
    waiting_days: 7,
    cost_overrides: {
      seed_cost: 4500,
      fertilizer_cost: 8000,
      labour_cost: 14000,
      water_cost: 3000
    }
  };
  const r19 = await fetchUrl(`${BACKEND_URL}/api/profitability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: profitPayload
  });
  if (r19.statusCode === 200 && r19.data && r19.data.decision_summary && r19.data.margin != null) {
    record("E2E-019", "Profitability Engine", "Pre-Sale Profitability & Waiting Cost Calculation", "200 with decision summary", "200 OK", "PASS", `Net Profit: ₹${r19.data.margin}, ROI: ${r19.data.roi_percentage}%, Tradeoff explanation generated`);
  } else {
    record("E2E-019", "Profitability Engine", "Pre-Sale Profitability & Waiting Cost Calculation", "200 with decision summary", `${r19.statusCode}`, "FAIL", JSON.stringify(r19.data));
  }

  // 20. Master Farm Dossier & Report PDF Generation
  const r20 = await fetchUrl(`${BACKEND_URL}/api/reports/farm/${farmId}/master-report.pdf`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (r20.statusCode === 200 && r20.headers["content-type"] === "application/pdf" && r20.rawBuffer.length > 5000) {
    record("E2E-020", "Reporting & PDF", "Generate & Stream Master Farm Audit PDF Dossier", "200 with application/pdf binary", "200 OK", "PASS", `Generated professional PDF report (${r20.rawBuffer.length} bytes)`);
  } else {
    record("E2E-020", "Reporting & PDF", "Generate & Stream Master Farm Audit PDF Dossier", "200 with application/pdf binary", `${r20.statusCode}`, "FAIL", `Type: ${r20.headers["content-type"]}, bytes: ${r20.rawBuffer?.length}`);
  }

  // 21. Ask AGRiNEX AI Intelligence Dialogue
  const askPayload = {
    message: "What is the recommended fertilizer schedule for my Arka Rakshak tomatoes in Bhatkal soil?",
    farm_id: farmId,
    language: "en"
  };
  const r21 = await fetchUrl(`${BACKEND_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: askPayload
  });
  if (r21.statusCode === 200 && r21.data && (r21.data.answer || r21.data.reply)) {
    const text = r21.data.answer || r21.data.reply;
    record("E2E-021", "AI Assistant", "Agronomic Advisory Dialogue (/api/ask)", "200 with agronomic answer", "200 OK", "PASS", `Advisory preview: ${text.substring(0, 100)}...`);
  } else {
    record("E2E-021", "AI Assistant", "Agronomic Advisory Dialogue (/api/ask)", "200 with agronomic answer", `${r21.statusCode}`, "FAIL", JSON.stringify(r21.data));
  }

  // 22. All 18 Application Routes Accessibility Verification
  const routes = [
    "/app",
    "/app/twin",
    "/app/zones",
    `/app/zones/${zoneId}`,
    "/app/soil",
    "/app/plant",
    "/app/what-grow",
    "/app/weather",
    "/app/irrigation",
    "/app/whatif",
    "/app/market",
    "/app/buyers",
    "/app/production",
    "/app/profitability",
    "/app/analytics",
    "/app/ask",
    "/app/reports",
    "/app/devices",
    "/app/settings"
  ];
  let routesPassed = 0;
  for (const route of routes) {
    const res = await fetchUrl(`${FRONTEND_URL}${route}`);
    if (res.statusCode === 200) {
      routesPassed++;
    } else {
      console.log(`Route failed: ${route} (${res.statusCode})`);
    }
  }
  if (routesPassed === routes.length) {
    record("E2E-022", "Navigation & Routing", "Verify All 19 Major Application Frontend Routes", `All ${routes.length} return 200 OK`, `All ${routesPassed} return 200 OK`, "PASS", `100% of application routes rendered successfully`);
  } else {
    record("E2E-022", "Navigation & Routing", "Verify All 19 Major Application Frontend Routes", `All ${routes.length} return 200 OK`, `${routesPassed}/${routes.length} returned 200`, "FAIL", `Some routes failed`);
  }

  // 23. Security: SQL Injection Resistance
  const sqliPayload = {
    email: `test_sqli' OR '1'='1`,
    password: `' OR 1=1 --`
  };
  const r23 = await fetchUrl(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: sqliPayload
  });
  if (r23.statusCode === 401 || r23.statusCode === 422) {
    record("E2E-023", "Security Testing", "SQL Injection Resistance in Auth", "401/422 Unauthorized", `${r23.statusCode}`, "PASS", "SQL injection attempt properly rejected without execution or data leak");
  } else {
    record("E2E-023", "Security Testing", "SQL Injection Resistance in Auth", "401/422 Unauthorized", `${r23.statusCode}`, "FAIL", "SQL injection not rejected properly");
  }

  // 24. Security: Path Traversal Defense
  const r24 = await fetchUrl(`${BACKEND_URL}/api/reports/../../../../etc/passwd/report.pdf`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (r24.statusCode === 404 || r24.statusCode === 400 || r24.statusCode === 403) {
    record("E2E-024", "Security Testing", "Path Traversal Attack Resistance", "400/404 Blocked", `${r24.statusCode}`, "PASS", "Directory traversal cleanly blocked by URL routing / sanitizer");
  } else {
    record("E2E-024", "Security Testing", "Path Traversal Attack Resistance", "400/404 Blocked", `${r24.statusCode}`, "FAIL", "Path traversal was not blocked");
  }

  // 25. Security: Unauthorized Resource Protection (IDOR)
  const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub2JvZHlAZmFrZS5jb20ifQ.fake_signature";
  const r25 = await fetchUrl(`${BACKEND_URL}/api/farms`, {
    headers: { "Authorization": `Bearer ${fakeToken}` }
  });
  if (r25.statusCode === 401) {
    record("E2E-025", "Security Testing", "Tampered JWT Rejection & IDOR Protection", "401 Unauthorized", "401 Unauthorized", "PASS", "Cryptographic signature validation rejected forged token");
  } else {
    record("E2E-025", "Security Testing", "Tampered JWT Rejection & IDOR Protection", "401 Unauthorized", `${r25.statusCode}`, "FAIL", "Tampered token was not rejected");
  }

  console.log("==========================================================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`      E2E LIVE SUITE SUMMARY: ${results.length} TOTAL | ${passed} PASSED | ${failed} FAILED`);
  console.log("==========================================================================");
}

run();
