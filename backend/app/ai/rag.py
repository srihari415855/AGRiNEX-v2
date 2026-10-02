"""
AGRiNEX RAG Engine (Retrieval-Augmented Generation)
Curated knowledge base of ICAR Agronomic Research, Crop Diagnostics,
Precision Irrigation Standards, and AGRiNEX Platform Documentation.
"""

from typing import List, Dict, Any, Optional
import re
import math

KNOWLEDGE_DOCUMENTS = [
    {
        "id": "agrinex-features",
        "title": "AGRiNEX Intelligent Platform Overview & Navigation",
        "category": "platform",
        "source": "AGRiNEX Platform Architecture Guide v2.4",
        "content": (
            "AGRiNEX is an AI-powered agricultural intelligence platform designed for Indian farmers. "
            "Key modules include: 1. Farm Overview & Dashboard: Real-time sensor telemetry, farm alerts, and quick actions. "
            "2. Digital Twin: Interactive visual representation of the farm, zone layouts, soil status, and pump actuators. "
            "3. Zone Management: Dedicated control per zone (soil type, crop, acreage, and irrigation history). "
            "4. Soil Analysis: Spectral camera scans providing texture, pH, organic carbon, and NPK estimates with laboratory correlation. "
            "5. Plant Health: Leaf pathology vision analysis detecting 20+ viral, fungal, and bacterial infections with confidence scores. "
            "6. Crop Recommender (What to Grow): Soil and season-driven suitability scoring for profitable crops. "
            "7. Precision Irrigation: Smart water scheduling, IoT valve telemetry, soil tension metrics, and automated run-time calculators. "
            "8. What-If Simulator: Scenario modeling for drought, unseasonal rainfall, temperature spikes, or water rationing. "
            "9. APMC Mandi Intelligence: Live modal prices, historical trends, and market distance analytics across Karnataka and all Indian states. "
            "10. Buyer Network: Direct B2B connection with verified food processors, exporters, and APMC traders without middlemen. "
            "11. Production & Profitability: Yield tracking, input cost breakdown, revenue forecasting, and ROI analytics. "
            "12. Master Reports: Automated multi-page PDF agronomic dossiers exportable for bank loans and crop insurance."
        )
    },
    {
        "id": "tomato-agronomy",
        "title": "Tomato (Solanum lycopersicum) Agronomy & Disease Management",
        "category": "crop_science",
        "source": "ICAR-IIHR (Indian Institute of Horticultural Research) Technical Bulletin",
        "content": (
            "Tomato grows best in well-drained red loam or sandy loam soils with pH between 6.0 and 7.0. "
            "Water Requirements: 4 to 6 litres per plant per day via drip irrigation during fruiting stage. "
            "Fertigation Schedule: N:P:K ratio 180:100:150 kg/hectare. Split nitrogen and potassium applications weekly. "
            "Major Diseases & Scientific Mitigations: "
            "1. Early Blight (Alternaria solani): Concentric target-board leaf spots. Spray Mancozeb 75% WP @ 2.5 g/L or Azoxystrobin @ 1 ml/L. "
            "2. Late Blight (Phytophthora infestans): Water-soaked dark brown lesions under high humidity. Spray Metalaxyl + Mancozeb @ 2 g/L. "
            "3. Bacterial Wilt (Ralstonia solanacearum): Rapid daytime wilting with green foliage. Soil drench with Copper Hydroxide @ 2 g/L; practice 3-year crop rotation. "
            "4. Tomato Yellow Leaf Curl Virus (TYLCV): Transmitted by whitefly (Bemisia tabaci). Install yellow sticky traps (15/acre); spray Neem oil 10,000 ppm @ 2 ml/L or Thiamethoxam 25% WG @ 0.3 g/L."
        )
    },
    {
        "id": "chilli-agronomy",
        "title": "Chilli (Capsicum annuum) Cultivation & Pest Protocols",
        "category": "crop_science",
        "source": "ICAR Central Horticultural Experiment Station Advisory",
        "content": (
            "Chilli requires warm, humid climate during growth and dry weather during fruit maturation. Optimum temperature 20°C - 30°C. "
            "Soil: Light loam with good drainage. Sensitive to water stagnation which causes damping off. "
            "Nutrient Management: FYM 25 t/ha, NPK 120:60:60 kg/ha. Apply 50% N and full P & K at planting, balance N in two splits at 30 and 60 days. "
            "Key Pest Management: "
            "1. Chilli Thrips (Scirtothrips dorsalis): Causes upward leaf curling ('boat shape'). Spray Spinosad 45% SC @ 0.3 ml/L or Fipronil 5% SC @ 1.5 ml/L. "
            "2. Yellow Mites (Polyphagotarsonemus latus): Causes downward leaf curling ('inverted boat'). Spray Fenazaquin 10% EC @ 2 ml/L or Wettable Sulphur @ 3 g/L. "
            "3. Anthracnose / Fruit Rot (Colletotrichum capsici): Circular sunken spots on ripe fruits. Spray Difenoconazole 25% EC @ 1 ml/L or Propiconazole @ 1 ml/L."
        )
    },
    {
        "id": "ragi-agronomy",
        "title": "Finger Millet / Ragi (Eleusine coracana) Production Guidelines",
        "category": "crop_science",
        "source": "University of Agricultural Sciences, Bangalore (UASB) Package of Practices",
        "content": (
            "Ragi is an exceptionally hardy, drought-resilient cereal rich in calcium and dietary fiber. "
            "Climate & Soil: Thrives in red loam, clay loam, and sandy loam. Ideal rainfed crop during Kharif (July-November). "
            "Recommended Varieties: GPU-28, ML-365, MR-1, KMR-301 for Southern Karnataka and Deccan plateau. "
            "Irrigation Schedule: For irrigated ragi, critical moisture stages are: 1. Tillering stage (20-25 days after sowing), "
            "2. Panicle initiation stage (40-45 DAS), 3. Flowering and milk stage (65-75 DAS). Stress during grain filling reduces yield by 40%. "
            "Disease Control: Finger Blast and Neck Blast (Pyricularia grisea). Treat seeds with Pseudomonas fluorescens @ 10 g/kg; spray Tricyclazole 75% WP @ 0.6 g/L upon early spindle-shaped leaf lesion onset."
        )
    },
    {
        "id": "mango-agronomy",
        "title": "Mango Orchard Management & Seasonal Care",
        "category": "crop_science",
        "source": "ICAR-CISH (Central Institute for Subtropical Horticulture)",
        "content": (
            "Mango orchards require strategic seasonal moisture management. "
            "Irrigation Directive: Completely withdraw irrigation for 2 months prior to flower bud differentiation (typically October-November in South India) "
            "to induce vegetative dormancy and stimulate profuse floral bloom. Resume drip irrigation once fruit set reaches pea size. "
            "Major Pests & Disease: "
            "1. Powdery Mildew (Oidium mangiferae): White powdery dusting on inflorescences causing fruit drop. Spray Wettable Sulphur @ 2 g/L or Hexaconazole @ 1 ml/L at panicle emergence. "
            "2. Mango Hopper (Amritodus atkinsoni): Secretes honeydew causing sooty mold. Spray Imidacloprid 17.8% SL @ 0.3 ml/L prior to flowering. "
            "3. Fruit Fly (Bactrocera dorsalis): Install Methyl Eugenol pheromone traps @ 6-8 traps per acre."
        )
    },
    {
        "id": "irrigation-standards",
        "title": "Precision Drip Irrigation & Soil Moisture Benchmarks",
        "category": "irrigation",
        "source": "National Mission on Micro Irrigation & ICAR Water Technology Centre",
        "content": (
            "Soil Moisture Metric Interpretations: "
            "- Moisture > 60%: Saturated to field capacity. No irrigation needed. Risk of root hypoxia if prolonged. "
            "- Moisture 45% - 60%: Optimal agronomic range. Maximum capillary nutrient uptake without root stress. "
            "- Moisture 30% - 44%: Moderate depletion zone. Plan 20-30 minute drip cycle depending on crop stage. "
            "- Moisture < 30%: High moisture deficit. Permanent wilting risk approaching. Immediate irrigation required. "
            "Soil Textural Dynamics: "
            "- Red Loam: Field capacity ~28-32% volume, moderate infiltration (15-20 mm/hr). Best suited for pulses and vegetables. "
            "- Sandy Loam: Rapid drainage (25-35 mm/hr), lower water retention. Requires frequent, short irrigation pulses. "
            "- Clay Loam: High water retention, slow infiltration (<8 mm/hr). Must avoid over-irrigation to prevent root rot."
        )
    },
    {
        "id": "soil-health-amendments",
        "title": "Soil Chemistry, pH Correction, and Organic Regeneration",
        "category": "soil_science",
        "source": "ICAR Indian Institute of Soil Science (IISS) Guidelines",
        "content": (
            "Soil pH Benchmarks: "
            "- Acidic Soils (pH < 6.0): Restricts phosphorus and molybdenum availability; induces aluminum toxicity. Amend with Agricultural Lime (CaCO3) @ 500-1000 kg/ha or Dolomite. "
            "- Neutral Soils (pH 6.5 - 7.5): Optimal for almost all horticultural and field crops. Nutrient availability is maximized. "
            "- Alkaline / Sodic Soils (pH > 8.0): Fixes iron, zinc, and manganese causing interveinal chlorosis. Amend with Agricultural Gypsum (CaSO4.2H2O) @ 1.5 - 3 t/ha followed by deep leaching. "
            "Organic Carbon Enhancement: "
            "- Target Organic Carbon > 0.75%. Incorporate green manure crops (Sunnhemp / Crotalaria juncea or Dhaincha) before flowering. "
            "- Apply well-decomposed Farmyard Manure (FYM) @ 10-15 t/ha or Vermicompost @ 2.5 t/ha to foster beneficial mycorrhizal fungi."
        )
    },
    {
        "id": "apmc-mandi-trading",
        "title": "APMC Mandi Economics, Price Discovery & Selling Strategies",
        "category": "market",
        "source": "e-NAM (National Agriculture Market) Agmarknet Agricultural Economics",
        "content": (
            "APMC Mandi Pricing Dynamics: "
            "- Commodity prices fluctuate based on daily arrivals (supply), holiday logistics, and inter-state consumption hubs (e.g. Bangalore, Mumbai, Chennai). "
            "- Modal Price: The most frequently transacted price in the yard, representing realistic farmer receipts after quality grading. "
            "- Value Addition Tactics: Grading tomatoes into Grade A (uniform red, firm, defect-free) fetches 25-35% price premium over ungraded mixed crates. "
            "- Direct Buyer Contracts: AGRiNEX connects farmers with institutional procurement centers, reducing mandi commission (6-8%) and transportation leakage. "
            "- Minimum Support Price (MSP): Government guaranteed floor price declared for Kharif/Rabi crops like Ragi, Paddy, Maize, Cotton, and Pulses."
        )
    },
    {
        "id": "weather-risk-mitigation",
        "title": "Agro-Meteorological Extreme Weather & Climate Resilience",
        "category": "weather",
        "source": "India Meteorological Department (IMD) Gramin Krishi Mausam Sewa",
        "content": (
            "Managing Weather Extremes: "
            "1. Unseasonal Heavy Rain Alert (>30 mm within 24h): Clear field drainage channels immediately to prevent waterlogging; postpone pesticide and fertilizer foliar sprays; harvest mature vegetable fruits to avoid split skin. "
            "2. Heatwave & High Evapotranspiration (>36°C with RH < 40%): Apply light evening drip irrigation; apply kaolin clay spray (5%) or straw mulching to conserve root zone moisture; provide shade nets over young nursery beds. "
            "3. High Humidity & Fog (>85% RH for 3+ consecutive days): High risk for fungal blast, downy mildew, and anthracnose. Apply protective prophylactic systemic fungicides (e.g. Carbendazim + Mancozeb @ 2 g/L) immediately."
        )
    }
]

def _tokenize(text: str) -> List[str]:
    """Tokenize and normalize text for lexical matching."""
    text = text.lower()
    tokens = re.findall(r'[a-z0-9\u0900-\u097F\u0C80-\u0CFF]+', text)
    stop_words = {
        "the", "a", "an", "is", "are", "and", "or", "in", "on", "at", "to", "for", 
        "of", "with", "by", "from", "it", "my", "your", "what", "how", "can", "do",
        "i", "me", "we", "this", "that", "these", "those"
    }
    return [t for t in tokens if t not in stop_words and len(t) > 2]

def search_knowledge_base(query: str, top_k: int = 3, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Search curated agronomic and platform knowledge base using BM25-inspired term scoring
    combined with category boosting and semantic density.
    """
    if not query or not query.strip():
        return []

    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    scored_docs = []
    
    for doc in KNOWLEDGE_DOCUMENTS:
        if category and doc.get("category") != category:
            continue
            
        doc_text = f"{doc['title']} {doc['content']}".lower()
        doc_tokens = _tokenize(doc_text)
        doc_len = max(len(doc_tokens), 1)
        
        score = 0.0
        matched_terms = []
        
        # Title matches carry 3x weight
        title_text = doc['title'].lower()
        
        for q_tok in q_tokens:
            tf = doc_tokens.count(q_tok)
            if tf > 0:
                matched_terms.append(q_tok)
                # BM25-like sublinear term frequency weighting
                tf_score = math.log(1.0 + tf) / (1.0 + 0.5 * (doc_len / 150.0))
                score += tf_score * 2.0
                
                if q_tok in title_text:
                    score += 4.0
                    
        # Check phrase or partial n-gram matches
        if any(term in doc_text for term in ["tomato", "chilli", "ragi", "mango", "drip", "weather", "mandi", "soil", "ph"]):
            for key in ["tomato", "chilli", "ragi", "mango", "drip", "weather", "mandi", "soil", "ph"]:
                if key in query.lower() and key in doc_text:
                    score += 3.5

        if score > 0.5:
            scored_docs.append({
                "id": doc["id"],
                "title": doc["title"],
                "source": doc["source"],
                "category": doc["category"],
                "snippet": doc["content"][:400] + "...",
                "full_content": doc["content"],
                "score": round(score, 2),
                "matched_terms": matched_terms
            })

    # Sort descending by score
    scored_docs.sort(key=lambda d: d["score"], reverse=True)
    return scored_docs[:top_k]

def format_rag_context_for_prompt(results: List[Dict[str, Any]]) -> str:
    """Format RAG search results into a clean, structured context string for the LLM."""
    if not results:
        return ""
        
    lines = ["RELEVANT AGRONOMIC & PLATFORM KNOWLEDGE BASE (GROUND TRUTH):"]
    for i, res in enumerate(results, 1):
        lines.append(f"[{i}] {res['title']} (Source: {res['source']}):\n{res['full_content']}")
    return "\n\n".join(lines)
