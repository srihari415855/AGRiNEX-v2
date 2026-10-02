# 🌾 AGRiNEX — Farm Intelligence & Precision Agriculture Platform

<div align="center">

[![Platform Version](https://img.shields.io/badge/version-2.5_Enterprise-emerald.svg?style=for-the-badge)](https://github.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![AI Engine](https://img.shields.io/badge/Google_Gemini-Multimodal_AI-orange.svg?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)

**A Spatial Digital Twin, AI Agronomic Reasoning Engine, Upgraded Multi-Method Precision Irrigation Controller, Mandi Market Intelligence System, and Edge IoT Automation Platform.**

[Key Features](#-key-features) • [System Architecture](#-system-architecture) • [Agronomic Methodology](#-mathematical--agronomic-engine) • [Quick Start](#-quick-start-guide) • [API Reference](#-api-endpoints-overview) • [Testing](#-testing--quality-assurance)

---

</div>

## 📖 Overview

**AGRiNEX** is an AI-powered, IoT-integrated **Digital Mirror of the Actual Farm**. It solves the critical disconnect between laboratory agronomic science, real-time microclimate sensors, APMC mandi trading economics, and practical on-farm operations.

Rather than offering generic advice or disconnected calculators, AGRiNEX anchors every decision to the exact physical reality of a registered agricultural parcel:
- **Spatial Topology & Soil Characteristics**: Soil texture, root-zone depth, and current moisture deficit.
- **Crop Phenology**: Dynamic crop coefficient ($K_c$) and stage-specific water requirements.
- **Microclimate Evapotranspiration**: Seasonal Penman-Monteith reference evapotranspiration ($ET_0$) via real-time satellite & weather feeds.
- **Market Dynamics**: Live APMC Mandi modal prices, price velocity, freight deductions, and storage holding payoffs.
- **Physical Actuation**: Edge IoT valve & pump relay interlocking with pressure relief safeguards.

---

## 🌟 Key Features

### 🗺️ 1. Spatial Digital Twin & Zone Management
- Interactive canvas and geospatial mapping of farm acreage partitioned into distinct micro-zones.
- Per-zone tracking: crop variety, soil classification (Sandy Loam, Red Loam, Clay Loam, Black Cotton), sowing date, growth stage, and real-time moisture levels.

### 💧 2. Multi-Method Precision Irrigation & Diurnal Timing Engine
- **9 Irrigation Methods Supported**:
  1. 🌱 Subsurface Drip (95% efficiency, 14.5 LPM)
  2. 💧 Standard Drip (90% efficiency, 22.4 LPM — calibrated 15-min baseline)
  3. 💦 Micro-Sprinkler (82% efficiency, 18.0 LPM)
  4. 🎯 Rain Gun / Center Pivot (80% efficiency, 60.0 LPM)
  5. 🌧️ Overhead Sprinkler (75% efficiency, 38.5 LPM)
  6. 〰️ Furrow Irrigation (65% efficiency, 55.0 LPM)
  7. 🚿 Manual / Hose Pipe (60% efficiency, 28.0 LPM)
  8. 🌊 Flood / Basin (55% efficiency, 85.0 LPM)
  9. ⚙️ Other / Custom Method (configurable 50%–99% efficiency and custom LPM)
- **Dual-Method Coordination**: Simultaneous root-zone delivery and foliar cooling with run-time balancing.
- **Diurnal Timing Windows**: Recommends optimal evaporation-minimizing hours (e.g. `05:30 AM – 08:30 AM` or `05:30 PM – 07:30 PM`) and flags high-loss midday periods (`11:00 AM – 04:00 PM`), saving **30%–35%** in water evaporation.

### 🧪 3. Vision AI Soil Health & Nutrient Scanner
- Upload topsoil photographs (0–15 cm root zone) to evaluate organic matter, colorimetric humic saturation, and porosity.
- Generates organic restoration prescriptions (Farmyard Manure, Jeevamrutha, bio-fertilizers, and pH buffering amendments).

### 🔍 4. Plant Disease Diagnosis & Dual Treatment Rx
- Instant leaf and foliage disease identification using computer vision and multimodal Gemini AI.
- Delivers actionable dual prescriptions: **Organic** (Neem oil, *Trichoderma viride*) and **Chemical** (Copper Oxychloride, Azoxystrobin) with dilution ratios, application intervals, and safety withholding periods.

### 🌱 5. Crop Recommendation Engine
- Multi-factor agronomic vector analysis combining Nitrogen (N), Phosphorus (P), Potassium (K), soil pH, annual rainfall, and temperature ranges against ICAR agronomic thresholds.

### 📊 6. Real-Time APMC Mandi Market Intelligence
- Real-time mandi price tracking across regional agricultural markets with Minimum, Maximum, and Modal prices.
- 7-Day price trend velocity (+₹/quintal/week).
- Freight friction deduction (₹/km/quintal) showing the net realization across alternative destination mandis.

### 💰 7. "What If I Wait?" Profitability & Storage Simulator
- Clear 3-step financial calculator: Yield in Quintals/Bags, Realized Price, and Production Costs to show net pocket profit and ROI.
- **Cold Storage Holding Economics**: Simulates storage fees (₹/bag/month) and weight shrinkage ($1.5\% - 3.5\%$) against projected price recovery to output a definite **"SELL NOW"** or **"HOLD FOR HIGHER PRICE"** recommendation.

### 🎙️ 8. Multilingual AI Agronomic Companion ("Ask AGRiNEX")
- Natural voice and text dialogue grounded in real-time farm telemetry, local Indian Standard Time (IST), and live weather.
- Native multi-lingual capabilities in **English**, **Hindi (हिन्दी)**, and **Kannada (ಕನ್ನಡ)**.
- Integrated Text-to-Speech (TTS) via ElevenLabs / Web Speech API and Speech-to-Text (STT) audio transcription.

### 📡 9. Edge IoT Controller & Hardware Actuation
- ESP32 gateway integration (`ESP32-AGRI-GATEWAY-01`) for main pump relay switching and solenoid valve actuation.
- Automatic hardware countdown shutoff, flow rate telemetry (LPM), and line pressure safety trips.

### 📑 10. Master Farm Audit & PDF Dossier Generation
- Automated generation of enterprise farm dossiers and telemetry audit reports using ReportLab with Indian Standard Time (IST) formatting.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION TIER (Next.js 16 + React 19)            │
│  🗺️ Digital Twin  💧 Irrigation  🧪 Soil AI  🔍 Pathology  📊 Mandi    │
│  💰 Profit Sim    🎙️ Voice AI    📱 Telemetry Dashboard  📑 Reports   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API / JSON (Axios)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    API GATEWAY (FastAPI :8000)                         │
│  /api/auth     /api/farms     /api/zones     /api/irrigation           │
│  /api/soil     /api/disease   /api/whatif    /api/market    /api/ask   │
└─────────┬─────────────────────────┬──────────────────────────┬─────────┘
          │                         │                          │
┌─────────▼───────────────┐ ┌───────▼────────────────┐ ┌───────▼─────────┐
│   AGRONOMIC ENGINES     │ │    AI & VISION LAYER   │ │   EDGE IOT      │
│ • FAO-56 Penman ET0     │ │ • Google Gemini Vision │ │ • ESP32 Gateway │
│ • NIR / GIR Water Math  │ │ • Pathology ResNet/LLM │ │ • Pump Relays   │
│ • Diurnal Window Solar  │ │ • ElevenLabs Voice     │ │ • Solenoids     │
│ • Storage Holding Sim   │ │ • Open-Meteo Weather   │ │ • Flow / Pres.  │
└─────────┬───────────────┘ └────────────────────────┘ └─────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────────────┐
│                    PERSISTENCE (SQLAlchemy ORM)                        │
│             SQLite (agrinex.db) / PostgreSQL + PostGIS Ready           │
│    Farms • Zones • Irrigation Logs • Soil Scans • Reports • Users      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 Mathematical & Agronomic Engine

The precision irrigation subsystem computes requirements using validated FAO-56 irrigation science:

```
1. Daily Crop Evapotranspiration:
   ETc = Kc × ET0

2. Soil Moisture Deficit & Net Irrigation Requirement (NIR):
   Deficit% = θ_FC - θ_current
   NIR_mm   = (Deficit% / 100) × Zr × ρ_soil × 1000

3. Gross Irrigation Requirement (GIR) & Volumetric Delivery:
   GIR_mm   = NIR_mm / η_irrigation
   V_litres = GIR_mm × (Area_acres × 4046.86)

4. Operational Run Duration:
   T_minutes = V_litres / (Q_LPM × ScaleFactor)

5. Pumping Energy & Utility Cost:
   E_kWh    = P_kW × (T_minutes / 60)
   Cost_INR = E_kWh × Tariff_INR (default: ₹4.50 / kWh)
```

Where:
- $\theta_{FC}$ = Target Field Capacity ($60\%$)
- $\theta_{current}$ = Real-time sensor root-zone moisture percentage
- $Z_r$ = Effective crop rooting depth (metres)
- $\rho_{soil}$ = Soil water factor
- $\eta_{irrigation}$ = Method application efficiency ($0.55$ for Flood up to $0.95$ for Subsurface Drip)
- $Q_{LPM}$ = System discharge delivery rate in Litres Per Minute

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.3.6** (App Router & Turbopack) | Server-side rendering, routing, and fast client navigation |
| **UI Library** | **React 19.2.8** | Component architecture & state management |
| **Language** | **TypeScript 5.0+** | Strict end-to-end type safety |
| **Styling** | **TailwindCSS 4.0** | High-performance modern utility styling |
| **Component Primitives** | **Radix UI** (Dialog, Select, Tabs, Slot, Label) | Accessible UI component primitives |
| **Icons & Visuals** | **Lucide React** (`lucide-react`) | Responsive icons |
| **Data Visualization** | **Recharts 3.10.1** | Real-time charts for moisture, prices, and water balance |
| **Notifications** | **Sonner** | Clean toast notifications |
| **Backend Framework** | **FastAPI 0.115+** | High-performance Python async REST API |
| **ASGI Server** | **Uvicorn 0.30+** | Production-ready ASGI server |
| **Database & ORM** | **SQLAlchemy 2.0+** & **SQLite** | Relational data persistence with schema migrations |
| **Data Validation** | **Pydantic v2** | Request/response schema validation |
| **AI & Multimodal Vision** | **Google Gemini API** | Image disease diagnosis, soil analysis & NLP chat |
| **Voice Synthesis** | **ElevenLabs API** / Web Speech API | Multi-language voice responses (English, Hindi, Kannada) |
| **Weather Telemetry** | **Open-Meteo API** | Live local temperatures, solar radiation, and rainfall |
| **Document Generation** | **ReportLab 4.0+** & **Pillow** | Automated generation of comprehensive PDF farm audits |

---

## 📁 Repository Structure

```
AGRiNEX/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py             # User signup, JWT authentication, and profiles
│   │   │   ├── farms.py            # Farm entity lifecycle and spatial boundaries
│   │   │   ├── zones.py            # Zone management, telemetry, and status
│   │   │   ├── ai.py               # Gemini Vision, plant pathology, STT & TTS
│   │   │   └── data.py             # Irrigation engine, Mandi, weather, reports
│   │   ├── auth.py                 # Password hashing & JWT token validation
│   │   ├── crud.py                 # Core database CRUD utilities
│   │   ├── database.py             # SQLAlchemy session & SQLite connection engine
│   │   ├── iot_controller.py       # ESP32 hardware relay actuation & interlocks
│   │   ├── main.py                 # FastAPI application root & middleware setup
│   │   ├── ml_engine.py            # Agronomic rules, NPK thresholds, and ML
│   │   ├── models.py               # Relational database models
│   │   ├── pdf_generator.py        # ReportLab PDF master audit document builder
│   │   ├── schemas.py              # Pydantic v2 schemas and validation models
│   │   └── whatif_engine.py        # "What If" simulation and NLP prompt parser
│   ├── .env.example                # Template for backend environment variables
│   ├── agrinex.db                  # Local SQLite database
│   ├── requirements.txt            # Python dependencies
│   ├── test_comprehensive_suite.py # End-to-end automated QA integration suite
│   └── update_admin_and_db.py      # Database seeder and admin setup script
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/             # Login and signup authentication routes
│   │   │   ├── app/                # Main application routes (/twin, /irrigation, etc.)
│   │   │   ├── dashboard/          # Farm overview dashboard
│   │   │   ├── demo/               # One-click demo showcase mode
│   │   │   ├── onboarding/         # New farm onboarding wizard
│   │   │   ├── layout.tsx          # Root layout with font and metadata
│   │   │   └── page.tsx            # Landing & entry page
│   │   ├── components/
│   │   │   ├── AskAgrinex.tsx      # Multilingual conversational voice AI modal
│   │   │   ├── DashboardView.tsx   # Primary farm overview dashboard interface
│   │   │   ├── DigitalTwin.tsx     # Spatial farm & zone digital twin map
│   │   │   ├── ImageAnalyzerView.tsx # Soil & plant vision diagnosis scanner
│   │   │   ├── Layout.tsx          # Unified sidebar and navigation header
│   │   │   └── ui/                 # Radix UI and styled interface components
│   │   ├── i18n/                   # English, Hindi, and Kannada localization
│   │   └── lib/                    # API client (Axios), AppContext, navigation
│   ├── package.json                # Frontend dependencies and scripts
│   └── tsconfig.json               # TypeScript compiler configuration
│
├── agrinex_walkthrough_document.html # Comprehensive technical specification
├── prerequistes.md                 # System hardware and runtime requirements
├── run_project.bat                 # Windows one-click dual-service launcher
└── run_project.ps1                 # PowerShell dual-service launcher
```

---

## 🚀 Quick Start Guide

### System Prerequisites
- **Python**: `3.10` or higher ([Download Python](https://www.python.org/downloads/))
- **Node.js**: `18.x`, `20.x`, or `22.x` ([Download Node.js](https://nodejs.org/))
- **Git**: Installed and available in `PATH`

---

### Method A: One-Click Launch (Windows)

Double-click `run_project.bat` or run in PowerShell:
```powershell
.\run_project.ps1
```
This automatically launches both the FastAPI backend (`http://127.0.0.1:8000`) and Next.js frontend (`http://localhost:3000`) in separate dedicated consoles.

---

### Method B: Manual Step-by-Step Setup

#### Step 1: Clone the Repository
```bash
git clone https://github.com/srihari415855/AGRiNEX-v2.git
cd AGRiNEX
```

#### Step 2: Configure and Start the Backend
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment:
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (create .env)
copy .env.example .env

# Initialize database schema and demo accounts
python update_admin_and_db.py

# Launch FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
> The API will be active at **`http://127.0.0.1:8000`** with interactive Swagger documentation at **`http://127.0.0.1:8000/docs`**.

#### Step 3: Configure and Start the Frontend
Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js with Turbopack
npm run dev
```
> The frontend application will be active at **`http://localhost:3000`**.

---

## 🔑 Demo Credentials

For immediate exploration and testing, pre-seeded accounts are provided:

| Role | Email | Password | Pre-configured Data |
| :--- | :--- | :--- | :--- |
| **Farm Administrator** | `admin@gmail.com` | `Admin@123` | **Namfarm** (10.0 acres, 5 active zones, sample audit reports) |
| **Lead Farmer** | `shettysapthami15@gmail.com` | `Agrinex@2026` | **Namfarm** (8.0 acres, Bhatkal, Karnataka, active telemetry) |

*You can also click **"Demo Mode"** on the landing page or register a new custom account via `/signup`.*

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

```env
# Required for Gemini Vision AI, Plant Pathology & Multilingual Assistant
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: ElevenLabs API Key for voice responses (falls back to Web Speech API if omitted)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

> **Obtaining a Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/) to generate a free Gemini API key.

### Frontend Configuration (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## 🌐 API Endpoints Overview

The FastAPI backend exposes comprehensive RESTful services:

### Authentication & Profiles (`/api/auth`)
- `POST /api/auth/signup` — Register a new farmer profile.
- `POST /api/auth/login` — Authenticate and receive a JWT access token.
- `GET /api/auth/me` — Retrieve current authenticated user profile.

### Digital Twin & Farms (`/api/farms` & `/api/zones`)
- `GET /api/farms` — List all farms owned by the user.
- `POST /api/farms` — Create a new farm boundary and acreage profile.
- `GET /api/farms/{farm_id}/zones` — List all micro-zones in a specific farm.
- `POST /api/farms/{farm_id}/zones` — Add a new zone with crop and soil parameters.
- `GET /api/zones/{zone_id}/sensor` — Fetch real-time telemetry from zone probes.

### Precision Irrigation & IoT Control (`/api/irrigation`)
- `POST /api/irrigation/recommend` — Calculate duration, water volume, and diurnal windows.
- `POST /api/irrigation/start` — Energize pump relay and open solenoid valves.
- `POST /api/irrigation/stop` — Close solenoid valves and shut off pump.
- `POST /api/irrigation/extend` — Add additional runtime minutes to an active session.
- `GET /api/irrigation/status` — Query live valve states, line pressure, and elapsed time.

### AI Diagnostics & Multilingual Assistant (`/api/ai` & `/api/data`)
- `POST /api/analyze/image` — Multimodal Vision AI for soil health or plant pathology.
- `POST /api/recommend/crop` — Agronomic crop suitability vector calculation.
- `POST /api/ask` — Conversational assistant with farm context in English, Hindi, or Kannada.
- `POST /api/tts` — High-fidelity Text-to-Speech audio generation.
- `POST /api/stt` — Speech-to-Text agricultural audio transcription.

### Market Intelligence & Economics (`/api/data` & `/api/whatif`)
- `GET /api/market-prices` — Live APMC Mandi rates, price spreads, and freight deductions.
- `POST /api/profitability` — Calculate net farm profit and ROI.
- `POST /api/whatif/simulate` — Cold storage holding simulation vs. immediate sale.
- `POST /api/whatif/parse-prompt` — Natural language prompt parser for scenario simulation.

### Reports & Audits (`/api/reports`)
- `GET /api/reports/farm/{farm_id}/master-report.pdf` — Stream comprehensive PDF farm audit.
- `POST /api/reports/analytics/generate` — Generate longitudinal resource efficiency report.

---

## 🧪 Testing & Quality Assurance

AGRiNEX comes with an automated integration test suite validating API contracts, irrigation duration math, authentication, and report generation:

### Run Backend Integration Tests
```bash
cd backend
python test_comprehensive_suite.py
```

### Run Frontend Typecheck & Build Validation
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **Satellite NDVI Index Integration**: Ingestion of Sentinel-2 and Landsat multispectral imagery for automated canopy vigor mapping.
- [ ] **Cellular NB-IoT Direct Gateway**: Direct MQTT/CoAP connectivity for remote farms without local Wi-Fi.
- [ ] **Offline PWA Capability**: IndexedDB offline caching and local sync for intermittent rural connectivity.
- [ ] **Decentralized Mandi Contracts**: Smart contract escrow for forward buyer purchase agreements.

---

## 📄 License & Attribution

Distributed under the **MIT License**. See `LICENSE` for more information.

Developed with agricultural science, modern software engineering, and respect for farmers worldwide.

<div align="center">
  <sub>Built with ❤️ for Indian & Global Agriculture • AGRiNEX Enterprise Platform</sub>
</div>
