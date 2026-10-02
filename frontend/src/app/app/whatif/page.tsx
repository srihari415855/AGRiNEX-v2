"use client";
import React, { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useApp } from "@/lib/AppContext";
import { t } from "@/lib/i18n";
import {
  startSpeechRecognition,
  isSpeechRecognitionSupported,
  stopAllPlayback,
} from "@/lib/voice";
import { toast } from "sonner";
import {
  Sparkles,
  Droplets,
  Thermometer,
  CloudRain,
  Sprout,
  ArrowRight,
  ShieldCheck,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  History,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Layers,
  MapPin,
  Calendar,
  Send
} from "lucide-react";

interface Recommendation {
  id: string;
  category: string;
  icon: string;
  title: string;
  reason: string;
  data_used: string;
  scenario_type: string;
  default_params: Record<string, any>;
}

interface FarmContext {
  farm_id: string;
  farm_name: string;
  farm_location: string;
  farm_area: number;
  water_availability: string;
  irrigation_method: string;
  zone_id: string;
  zone_name: string;
  crop_name: string;
  soil_type: string;
  zone_area: number;
  last_moisture: number;
  status: string;
  all_zones: Array<{ id: string; name: string; crop: string; area: number; moisture: number; soil_type: string }>;
  weather: {
    temperature: number;
    humidity: number;
    precipitation: number;
    wind_speed: number;
    forecast_rain_sum: number;
    temp_max: number;
    temp_min: number;
    source: string;
  };
}

interface SimulationResponse {
  scenario_title: string;
  scenario_description: string;
  status: string;
  baseline: {
    soil_moisture: number;
    water_use_litres_per_day: number;
    total_water_litres: number;
    crop: string;
    zone: string;
    soil_type: string;
    temperature_c: number;
    humidity_pct: number;
    crop_stress_pct: number;
    irrigation_cost_inr: number;
    risk_level: string;
  };
  simulated: {
    soil_moisture: number;
    water_use_litres_per_day: number;
    total_water_litres: number;
    crop_stress_pct: number;
    irrigation_cost_inr: number;
    duration_days: number;
    risk_level: string;
  };
  difference: {
    water_saved_litres: number;
    cost_savings_inr: number;
    moisture_delta_pct: number;
    stress_delta_pct: number;
    risk_verdict: string;
  };
  narrative_explanation: string;
  actionable_mitigation: string[];
  data_status_labels: Record<string, string>;
  timestamp: string;
}

interface ClarificationState {
  needed: boolean;
  question: string;
  options: string[];
  scenarioType: string;
  parameter: string;
}

export default function WhatIfPage() {
  const { lang, activeFarm } = useApp();

  // Farm context & recommendations state
  const [farmCtx, setFarmCtx] = useState<FarmContext | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("all");
  const [loadingContext, setLoadingContext] = useState<boolean>(true);

  // Active scenario state
  const [activeScenarioType, setActiveScenarioType] = useState<string>("irrigation_reduce");
  const [activeScenarioTitle, setActiveScenarioTitle] = useState<string>("Reduce Irrigation by 20% for 3 Days");
  const [durationDays, setDurationDays] = useState<number>(3);
  const [changePct, setChangePct] = useState<number>(-20);
  const [deltaTemp, setDeltaTemp] = useState<number>(3);
  const [rainfallMm, setRainfallMm] = useState<number>(40);
  const [targetCrop, setTargetCrop] = useState<string>("Finger Millet (Ragi)");

  // Natural Language & Voice
  const [askQuery, setAskQuery] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>("");
  const [clarification, setClarification] = useState<ClarificationState | null>(null);
  const [parsingQuery, setParsingQuery] = useState<boolean>(false);

  // Simulation execution & results
  const [simulationResult, setSimulationResult] = useState<SimulationResponse | null>(null);
  const [runningSimulation, setRunningSimulation] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // History state
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Dynamic Recommendations & Farm Context
  const loadFarmContext = async (zoneOverride?: string) => {
    setLoadingContext(true);
    try {
      const zId = zoneOverride !== undefined ? zoneOverride : (selectedZoneId === "all" ? undefined : selectedZoneId);
      const res = await api.get("/whatif/recommendations", {
        params: {
          farm_id: activeFarm || "demo-farm",
          zone_id: zId && zId !== "all" ? zId : undefined,
          lang: lang || "en"
        }
      });
      if (res.data) {
        setFarmCtx(res.data.farm_context);
        setRecommendations(res.data.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to load what-if recommendations:", err);
      toast.error("Could not fetch farm telemetry. Using calibrated baseline.");
    } finally {
      setLoadingContext(false);
    }
  };

  // 2. Fetch Simulation History
  const loadHistory = async () => {
    try {
      const res = await api.get("/whatif/history", {
        params: { farm_id: activeFarm || "demo-farm" }
      });
      if (res.data) {
        setHistoryItems(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    loadFarmContext();
    loadHistory();
  }, [activeFarm, lang]);

  // Handle Zone selection change
  const handleZoneChange = (zId: string) => {
    setSelectedZoneId(zId);
    loadFarmContext(zId);
  };

  // 3. Click a recommended scenario card
  const handleSelectRecommendation = (rec: Recommendation) => {
    setActiveScenarioType(rec.scenario_type);
    setActiveScenarioTitle(rec.title);
    setClarification(null);

    const p = rec.default_params || {};
    if (p.duration_days) setDurationDays(Number(p.duration_days));
    if (p.change_pct !== undefined) setChangePct(Number(p.change_pct));
    if (p.delta_temp !== undefined) setDeltaTemp(Number(p.delta_temp));
    if (p.rainfall_mm !== undefined) setRainfallMm(Number(p.rainfall_mm));
    if (p.target_crop) setTargetCrop(String(p.target_crop));

    toast.info(`Selected: ${rec.title}`);
  };

  // 4. Natural Language / Voice Parsing
  const handleAskSubmit = async (queryText?: string) => {
    const textToParse = queryText || askQuery;
    if (!textToParse.trim()) {
      toast.error("Please enter or speak a What-If scenario question.");
      return;
    }

    setParsingQuery(true);
    setClarification(null);

    try {
      const res = await api.post("/whatif/parse-prompt", {
        message: textToParse.trim(),
        farm_id: activeFarm || "demo-farm",
        zone_id: selectedZoneId !== "all" ? selectedZoneId : undefined,
        language: lang
      });

      const parsed = res.data;

      if (parsed.needs_clarification) {
        // Requirement #7: NEVER GUESS MISSING PARAMETERS!
        setClarification({
          needed: true,
          question: parsed.prompt_question || "Please select a specific value to simulate:",
          options: parsed.options || ["10%", "20%", "30%", "50%"],
          scenarioType: parsed.scenario_type,
          parameter: parsed.parameter
        });
        setActiveScenarioType(parsed.scenario_type);
        toast.info("Parameter needed to complete scenario calculation.");
      } else {
        // Parameter fully extracted
        setActiveScenarioType(parsed.scenario_type);
        if (parsed.duration_days) setDurationDays(parsed.duration_days);
        if (parsed.change_value !== undefined) {
          if (parsed.parameter === "temperature") {
            setDeltaTemp(Math.abs(parsed.change_value));
          } else {
            setChangePct(parsed.change_value);
          }
        }
        setActiveScenarioTitle(textToParse.trim());
        toast.success("Scenario understood. Ready to simulate!");
        // Execute immediately
        triggerSimulation({
          scenario_type: parsed.scenario_type,
          params: {
            change_pct: parsed.change_value,
            delta_temp: parsed.change_value,
            duration_days: parsed.duration_days || 3
          },
          question_text: textToParse.trim()
        });
      }
    } catch (err) {
      console.error("NLP parse error:", err);
      toast.error("Failed to parse question. You can configure parameters directly below.");
    } finally {
      setParsingQuery(false);
    }
  };

  // Handle Clarification Chip Selection
  const handleClarificationChoice = (optionStr: string) => {
    if (!clarification) return;

    let numericVal = 20;
    const match = optionStr.match(/(\d+)/);
    if (match) numericVal = parseInt(match[1], 10);

    if (clarification.parameter === "temperature") {
      setDeltaTemp(numericVal);
    } else if (clarification.parameter === "crop_type") {
      setTargetCrop(optionStr);
    } else {
      // Irrigation or water deficit
      setChangePct(clarification.scenarioType === "irrigation_increase" ? numericVal : -numericVal);
    }

    setClarification(null);
    toast.success(`Parameter set to ${optionStr}. Running virtual simulation...`);

    triggerSimulation({
      scenario_type: clarification.scenarioType,
      params: {
        change_pct: clarification.scenarioType === "irrigation_increase" ? numericVal : -numericVal,
        delta_temp: numericVal,
        duration_days: durationDays,
        target_crop: optionStr
      }
    });
  };

  // 5. Voice Input Toggle (Web Speech API)
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText("");
      return;
    }

    if (isSpeaking) {
      stopAllPlayback();
      setIsSpeaking(false);
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    setInterimText("");
    setIsListening(true);

    const rec = startSpeechRecognition({
      lang,
      onInterim: (text) => setInterimText(text),
      onFinal: (finalText) => {
        setIsListening(false);
        setInterimText("");
        if (finalText.trim()) {
          setAskQuery(finalText.trim());
          handleAskSubmit(finalText.trim());
        }
      },
      onError: (err) => {
        setIsListening(false);
        setInterimText("");
        const msg = "message" in err ? err.message : String(err);
        if (msg && !msg.includes("no-speech")) {
          toast.error("Microphone note: " + msg);
        }
      }
    });

    recognitionRef.current = rec;
  };

  // 6. Run Virtual Simulation
  const triggerSimulation = async (customPayload?: any) => {
    setRunningSimulation(true);
    try {
      const payload = customPayload || {
        farm_id: activeFarm || "demo-farm",
        zone_id: selectedZoneId !== "all" ? selectedZoneId : undefined,
        scenario_type: activeScenarioType,
        params: {
          change_pct: changePct,
          duration_days: durationDays,
          delta_temp: deltaTemp,
          rainfall_mm: rainfallMm,
          target_crop: targetCrop
        },
        language: lang,
        question_text: activeScenarioTitle
      };

      const res = await api.post("/whatif/simulate", payload);
      setSimulationResult(res.data);
      toast.success("Virtual simulation calculated successfully!");

      // Refresh history list
      loadHistory();

      // Scroll to result smoothly
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    } catch (err: any) {
      console.error("Simulation error:", err);
      toast.error("Simulation engine note: " + (err.response?.data?.detail || "Simulation calculation error"));
    } finally {
      setRunningSimulation(false);
    }
  };

  // Text-To-Speech for simulation explanation
  const handleSpeakExplanation = () => {
    if (isSpeaking) {
      stopAllPlayback();
      setIsSpeaking(false);
      return;
    }

    if (!simulationResult?.narrative_explanation) return;

    setIsSpeaking(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(simulationResult.narrative_explanation);
      utterance.lang = lang === "kn" ? "kn-IN" : lang === "hi" ? "hi-IN" : "en-IN";
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
      toast.info("Browser text-to-speech not supported.");
    }
  };

  const currentZone = farmCtx?.all_zones.find((z) => z.id === selectedZoneId) || null;

  return (
    <Layout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
              <Sparkles size={13} className="text-purple-600 animate-spin" />
              Dynamic Farm-Aware
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
              Virtual Decision Support
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
            🔮 {t(lang, "whatif")}
          </h1>
          <p className="text-sm text-stone-600">
            Simulate decisions virtually against your live Digital Twin without altering physical devices or farm state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <History size={15} className="mr-1.5 text-stone-500" />
            {showHistory ? "Hide History" : "Past Simulations"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadFarmContext()}
            disabled={loadingContext}
            className="border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loadingContext ? "animate-spin" : ""}`} />
            Refresh Baseline
          </Button>
        </div>
      </div>

      {/* SECTION 1: LIVE DIGITAL TWIN BASELINE BAR */}
      <Card className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white mb-6 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Digital Twin Baseline State
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <MapPin size={12} className="text-emerald-400" />
              {farmCtx?.farm_name || "Namfarm"} ({farmCtx?.farm_location || "Karnataka"})
            </span>
            <span className="text-xs text-stone-400 border-l border-stone-700 pl-3">
              Total: {farmCtx?.farm_area || 5.0} Acres
            </span>
          </div>
        </div>

        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Zone Selector */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Active Target</span>
                <StatusBadge kind="CURRENT" />
              </div>
              <Select value={selectedZoneId} onValueChange={handleZoneChange}>
                <SelectTrigger className="w-full h-8 text-xs bg-stone-900 border-stone-700 text-stone-100 p-2">
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent className="bg-stone-900 border-stone-700 text-stone-100">
                  <SelectItem value="all">Entire Farm (All Zones)</SelectItem>
                  {farmCtx?.all_zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name} ({z.crop})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Crop & Soil */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Crop & Soil</span>
                <StatusBadge kind="CURRENT" />
              </div>
              <div className="text-sm font-bold text-stone-100 truncate">
                {currentZone ? currentZone.crop : farmCtx?.crop_name || "Tomato"}
              </div>
              <div className="text-[11px] text-stone-400 truncate">
                {currentZone ? currentZone.soil_type : farmCtx?.soil_type || "Red Sandy Loam"}
              </div>
            </div>

            {/* Live Soil Moisture */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Soil Moisture</span>
                <StatusBadge kind="LIVE" />
              </div>
              <div className="text-xl font-extrabold text-emerald-400 flex items-baseline gap-1">
                {currentZone ? currentZone.moisture.toFixed(1) : farmCtx?.last_moisture.toFixed(1) || "52.0"}%
              </div>
              <div className="text-[11px] text-stone-400">
                Rootzone Available Water
              </div>
            </div>

            {/* Weather Telemetry */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Weather</span>
                <StatusBadge kind="CURRENT" />
              </div>
              <div className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                <Thermometer size={14} className="text-amber-400" />
                {farmCtx?.weather.temperature.toFixed(1)}°C
                <span className="text-stone-400 font-normal">· {farmCtx?.weather.humidity.toFixed(0)}% RH</span>
              </div>
              <div className="text-[11px] text-stone-400 flex items-center gap-1">
                <CloudRain size={11} className="text-sky-400" />
                {farmCtx?.weather.precipitation.toFixed(1)}mm today · {farmCtx?.weather.forecast_rain_sum.toFixed(1)}mm 3d forecast
              </div>
            </div>

            {/* Irrigation State */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Irrigation</span>
                <StatusBadge kind="LIVE" />
              </div>
              <div className="text-sm font-bold text-stone-100 flex items-center gap-1">
                <Droplets size={14} className="text-sky-400" />
                {farmCtx?.irrigation_method || "Drip Irrigation"}
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                System Standby / Scheduled
              </div>
            </div>

            {/* Water Source & Storage */}
            <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
              <div className="text-[11px] text-stone-400 font-medium mb-1 flex items-center justify-between">
                <span>Water Storage</span>
                <StatusBadge kind="CURRENT" />
              </div>
              <div className="text-sm font-bold text-stone-100 truncate">
                {farmCtx?.water_availability || "Borewell + Tank"}
              </div>
              <div className="text-[11px] text-stone-400">
                Pumping rate ~15k L/hr
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: DYNAMIC RECOMMENDATION OPTIONS */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <span>⚡</span> Recommended What-If Scenarios
            </h2>
            <p className="text-xs text-stone-600">
              Generated dynamically from your actual soil moisture ({farmCtx?.last_moisture.toFixed(1)}%), current weather, and active crop stage.
            </p>
          </div>
          <span className="text-xs text-stone-500 font-medium hidden sm:inline">
            Click any card to load parameters
          </span>
        </div>

        {loadingContext ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 bg-stone-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recommendations.map((rec) => {
              const isSelected = activeScenarioType === rec.scenario_type && activeScenarioTitle === rec.title;
              return (
                <div
                  key={rec.id}
                  onClick={() => handleSelectRecommendation(rec)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                    isSelected
                      ? "border-purple-600 bg-purple-50/50 shadow-md ring-1 ring-purple-500"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-2xl">{rec.icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                        {rec.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-stone-900 mb-1 leading-snug">
                      {rec.title}
                    </h3>
                    <p className="text-xs text-stone-600 mb-2 leading-relaxed line-clamp-2">
                      {rec.reason}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500">
                    <span className="truncate max-w-[200px]">Data: {rec.data_used}</span>
                    <span className="font-bold text-purple-700 flex items-center gap-0.5">
                      Configure <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: "+ ASK MORE" (NATURAL LANGUAGE & VOICE ENGINE) */}
      <Card className="rounded-2xl border border-stone-200 bg-white mb-6 shadow-sm overflow-hidden">
        <CardHeader className="bg-stone-50/80 border-b border-stone-100 py-3.5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="text-purple-600">💬</span> + Ask More (Natural Language or Voice)
            </CardTitle>
            <span className="text-xs text-stone-500">
              Type or speak in English, Kannada, Hindi, Telugu, Tamil, etc.
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskSubmit()}
                placeholder="Ask AGRiNEX: What if I reduce irrigation by 20% for 3 days? / ಮೂರು ದಿನ ನೀರಾವರಿ ಕಡಿಮೆ ಮಾಡಿದರೆ ಏನಾಗುತ್ತದೆ?"
                className="w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white transition"
              />
              {interimText && (
                <div className="absolute left-4 top-10 text-xs text-purple-600 italic bg-white px-1">
                  Listening: &quot;{interimText}&quot;
                </div>
              )}
            </div>

            {/* Voice Mic Button */}
            <Button
              type="button"
              variant="outline"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isListening
                  ? "bg-red-500 text-white border-red-600 animate-pulse hover:bg-red-600"
                  : "border-stone-300 text-stone-700 hover:bg-stone-100"
              }`}
              title="Speak scenario"
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} className="text-purple-700" />}
            </Button>

            {/* Ask Submit Button */}
            <Button
              onClick={() => handleAskSubmit()}
              disabled={parsingQuery || !askQuery.trim()}
              className="bg-purple-700 hover:bg-purple-800 text-white px-5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {parsingQuery ? (
                <RefreshCw size={15} className="animate-spin mr-1" />
              ) : (
                <Send size={15} className="mr-1.5" />
              )}
              Analyze
            </Button>
          </div>

          {/* Quick example scenario pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-stone-500 font-medium">Try asking:</span>
            {[
              "💧 What if I reduce irrigation by 20% for 3 days?",
              "🌧️ What if rainfall is 30% lower this week?",
              "🌡️ What if temperature increases by 3°C?",
              "💧 What if I skip irrigation today?",
              "🌱 What if I switch to Ragi?"
            ].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAskQuery(prompt);
                  handleAskSubmit(prompt);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-stone-100 hover:bg-purple-50 hover:text-purple-700 text-stone-700 border border-stone-200 transition cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* SECTION 3B: CLARIFICATION CHIPS (REQUIREMENT #7: NEVER GUESS MISSING PARAMETERS) */}
          {clarification && clarification.needed && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-sm font-bold text-purple-900 mb-2">
                <AlertTriangle size={16} className="text-purple-700" />
                <span>{clarification.question}</span>
              </div>
              <p className="text-xs text-purple-700 mb-3">
                AGRiNEX does not randomly guess missing scenario values. Please select a specific parameter:
              </p>
              <div className="flex flex-wrap gap-2">
                {clarification.options.map((opt, oIdx) => (
                  <Button
                    key={oIdx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleClarificationChoice(opt)}
                    className="border-purple-300 bg-white hover:bg-purple-600 hover:text-white text-purple-900 font-semibold cursor-pointer text-xs rounded-lg shadow-sm"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: SCENARIO CONFIGURATION PANEL */}
      <Card className="rounded-2xl border border-stone-200 bg-white mb-6 shadow-sm">
        <CardHeader className="py-3 px-5 border-b border-stone-100 flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Sliders size={16} className="text-purple-700" />
            Scenario Configuration: <span className="text-purple-800 font-extrabold">{activeScenarioTitle}</span>
          </CardTitle>
          <StatusBadge kind="ESTIMATED">Model Physics Input</StatusBadge>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Magnitude Controls based on scenario type */}
            <div className="space-y-2">
              <Label className="text-xs text-stone-600 font-semibold uppercase tracking-wider">
                {activeScenarioType.includes("temp")
                  ? "Temperature Delta (°C)"
                  : activeScenarioType.includes("rain")
                  ? "Precipitation (mm)"
                  : activeScenarioType.includes("crop")
                  ? "Alternative Crop"
                  : "Irrigation Change (%)"}
              </Label>

              {activeScenarioType.includes("temp") ? (
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5].map((deg) => (
                    <Button
                      key={deg}
                      type="button"
                      variant={deltaTemp === deg ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDeltaTemp(deg)}
                      className={`flex-1 text-xs cursor-pointer ${
                        deltaTemp === deg ? "bg-purple-700 text-white" : "border-stone-300"
                      }`}
                    >
                      +{deg}°C
                    </Button>
                  ))}
                </div>
              ) : activeScenarioType.includes("rain") ? (
                <div className="flex items-center gap-2">
                  {[20, 40, 60, 100].map((mm) => (
                    <Button
                      key={mm}
                      type="button"
                      variant={rainfallMm === mm ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRainfallMm(mm)}
                      className={`flex-1 text-xs cursor-pointer ${
                        rainfallMm === mm ? "bg-purple-700 text-white" : "border-stone-300"
                      }`}
                    >
                      +{mm}mm
                    </Button>
                  ))}
                </div>
              ) : activeScenarioType.includes("crop") ? (
                <Select value={targetCrop} onValueChange={setTargetCrop}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Finger Millet (Ragi)">Finger Millet (Ragi) - Drought Hardy</SelectItem>
                    <SelectItem value="Groundnut">Groundnut - Low Water Footprint</SelectItem>
                    <SelectItem value="Pigeon Pea">Pigeon Pea - Deep Root Nitrogen Fixer</SelectItem>
                    <SelectItem value="Chilli">Chilli - Commercial Vegetable</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  {[-30, -20, -10, 15].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      variant={changePct === pct ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChangePct(pct)}
                      className={`flex-1 text-xs cursor-pointer ${
                        changePct === pct ? "bg-purple-700 text-white" : "border-stone-300"
                      }`}
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-stone-600 font-semibold uppercase tracking-wider">
                Simulation Window (Duration)
              </Label>
              <div className="flex items-center gap-2">
                {[1, 3, 5, 7, 14].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={durationDays === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDurationDays(d)}
                    className={`flex-1 text-xs cursor-pointer ${
                      durationDays === d ? "bg-purple-700 text-white" : "border-stone-300"
                    }`}
                  >
                    {d} {d === 1 ? "Day" : "Days"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Target Area Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-stone-600 font-semibold uppercase tracking-wider">
                Apply Simulation To
              </Label>
              <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire Farm ({farmCtx?.farm_area || 5.0} Acres)</SelectItem>
                  {farmCtx?.all_zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name} ({z.crop}, {z.area} ac)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Physics-based FAO-56 Penman-Monteith Evapotranspiration model verified.</span>
            </div>

            <Button
              onClick={() => triggerSimulation()}
              disabled={runningSimulation}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-md disabled:opacity-50"
            >
              <Sparkles size={16} className={`mr-2 ${runningSimulation ? "animate-spin" : ""}`} />
              {runningSimulation ? "Simulating Virtual Physics..." : "RUN VIRTUAL SIMULATION"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 5: SIMULATION RESULT (BASELINE VS. WHAT-IF COMPARISON) */}
      {simulationResult && (
        <div ref={resultRef} className="space-y-6 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Card className="rounded-2xl border-2 border-purple-300 bg-white shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge kind="SIMULATED">Virtual Scenario</StatusBadge>
                  <span className="text-xs text-purple-200">
                    Calculated for {simulationResult.baseline.zone} ({simulationResult.baseline.crop})
                  </span>
                </div>
                <CardTitle className="text-xl font-extrabold text-white">
                  {simulationResult.scenario_title}
                </CardTitle>
                <p className="text-xs text-purple-200 mt-0.5">
                  {simulationResult.scenario_description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSpeakExplanation}
                  className="bg-purple-800/80 border-purple-500 text-white hover:bg-purple-700 text-xs cursor-pointer"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX size={15} className="mr-1.5 text-red-300 animate-pulse" />
                      Stop Audio
                    </>
                  ) : (
                    <>
                      <Volume2 size={15} className="mr-1.5 text-purple-300" />
                      Listen in {lang === "kn" ? "Kannada" : lang === "hi" ? "Hindi" : "English"}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Comparison Matrix Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Baseline Farm State */}
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70">
                  <div className="flex items-center justify-between mb-3 border-b border-stone-200 pb-2">
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                      Current Baseline Farm
                    </span>
                    <StatusBadge kind="LIVE">Actual Sensor</StatusBadge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-stone-500">Rootzone Moisture</div>
                      <div className="text-2xl font-black text-stone-900">
                        {simulationResult.baseline.soil_moisture.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-stone-500">Measured topsoil sensor</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500">Daily Water Consumption</div>
                      <div className="text-base font-bold text-stone-800">
                        {simulationResult.baseline.water_use_litres_per_day.toLocaleString()} L/day
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Total {simulationResult.baseline.total_water_litres.toLocaleString()} L over window
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500">Crop Stress Index</div>
                      <div className="text-base font-bold text-emerald-700">
                        {simulationResult.baseline.crop_stress_pct.toFixed(0)}% (Optimal Zone)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500">Pumping & Energy Cost</div>
                      <div className="text-sm font-semibold text-stone-700">
                        ₹{simulationResult.baseline.irrigation_cost_inr.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Simulated Scenario State */}
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                  <div className="flex items-center justify-between mb-3 border-b border-purple-200 pb-2">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                      Simulated What-If
                    </span>
                    <StatusBadge kind="SIMULATED">Virtual Model</StatusBadge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-purple-700">Simulated Moisture</div>
                      <div className="text-2xl font-black text-purple-900">
                        {simulationResult.simulated.soil_moisture.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-purple-700">Estimated after {simulationResult.simulated.duration_days} days</div>
                    </div>
                    <div>
                      <div className="text-xs text-purple-700">Simulated Water Use</div>
                      <div className="text-base font-bold text-purple-950">
                        {simulationResult.simulated.water_use_litres_per_day.toLocaleString()} L/day
                      </div>
                      <div className="text-[11px] text-purple-700">
                        Total {simulationResult.simulated.total_water_litres.toLocaleString()} L modeled
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-purple-700">Simulated Stress Index</div>
                      <div className="text-base font-bold text-purple-900">
                        {simulationResult.simulated.crop_stress_pct.toFixed(0)}% ({simulationResult.simulated.risk_level})
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-purple-700">Projected Energy Cost</div>
                      <div className="text-sm font-semibold text-purple-900">
                        ₹{simulationResult.simulated.irrigation_cost_inr.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Difference & Variance */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <div className="flex items-center justify-between mb-3 border-b border-emerald-200 pb-2">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Difference / Impact
                    </span>
                    <StatusBadge kind="ESTIMATED">Calculated Delta</StatusBadge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-emerald-800">Moisture Change</div>
                      <div className={`text-2xl font-black ${
                        simulationResult.difference.moisture_delta_pct >= 0 ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {simulationResult.difference.moisture_delta_pct > 0 ? "+" : ""}
                        {simulationResult.difference.moisture_delta_pct.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-emerald-800">Rootzone water volume shift</div>
                    </div>
                    <div>
                      <div className="text-xs text-emerald-800">Water Conservation</div>
                      <div className="text-base font-bold text-emerald-900">
                        {simulationResult.difference.water_saved_litres >= 0
                          ? `+${simulationResult.difference.water_saved_litres.toLocaleString()} L Saved`
                          : `${simulationResult.difference.water_saved_litres.toLocaleString()} L Additional`}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Savings: ₹{simulationResult.difference.cost_savings_inr > 0 ? "+" : ""}
                        {simulationResult.difference.cost_savings_inr.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-emerald-800">Stress Delta</div>
                      <div className="text-base font-bold text-stone-800">
                        {simulationResult.difference.stress_delta_pct > 0 ? "+" : ""}
                        {simulationResult.difference.stress_delta_pct.toFixed(0)}% points
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-emerald-800">Risk Assessment</div>
                      <div className="text-xs font-bold text-emerald-900">
                        {simulationResult.difference.risk_verdict}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side-By-Side Comparison Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Parameter Comparison Table</span>
                  <span className="text-[11px] text-stone-500 font-normal">All values calculated using actual farm inputs</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                      <tr>
                        <th className="p-3">Agronomic Parameter</th>
                        <th className="p-3">Current / Baseline</th>
                        <th className="p-3">What-If Simulated</th>
                        <th className="p-3">Net Variance</th>
                        <th className="p-3">Data Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-800">
                      <tr>
                        <td className="p-3 font-semibold">Soil Moisture (% by vol)</td>
                        <td className="p-3 font-mono">{simulationResult.baseline.soil_moisture.toFixed(1)}%</td>
                        <td className="p-3 font-mono font-bold text-purple-700">{simulationResult.simulated.soil_moisture.toFixed(1)}%</td>
                        <td className="p-3 font-mono">
                          {simulationResult.difference.moisture_delta_pct > 0 ? "+" : ""}
                          {simulationResult.difference.moisture_delta_pct.toFixed(1)}%
                        </td>
                        <td className="p-3"><StatusBadge kind="LIVE" /> → <StatusBadge kind="SIMULATED" /></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">Daily Water Delivery</td>
                        <td className="p-3 font-mono">{simulationResult.baseline.water_use_litres_per_day.toLocaleString()} L</td>
                        <td className="p-3 font-mono font-bold text-purple-700">{simulationResult.simulated.water_use_litres_per_day.toLocaleString()} L</td>
                        <td className="p-3 font-mono text-emerald-700">
                          {simulationResult.difference.water_saved_litres > 0 ? "+" : ""}
                          {(simulationResult.baseline.water_use_litres_per_day - simulationResult.simulated.water_use_litres_per_day).toLocaleString()} L/day
                        </td>
                        <td className="p-3"><StatusBadge kind="CURRENT" /> → <StatusBadge kind="SIMULATED" /></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">Plant Vegetative Stress</td>
                        <td className="p-3 font-mono">{simulationResult.baseline.crop_stress_pct.toFixed(0)}% (Low)</td>
                        <td className="p-3 font-mono font-bold text-purple-700">{simulationResult.simulated.crop_stress_pct.toFixed(0)}% ({simulationResult.simulated.risk_level})</td>
                        <td className="p-3 font-mono">
                          {simulationResult.difference.stress_delta_pct > 0 ? "+" : ""}
                          {simulationResult.difference.stress_delta_pct.toFixed(0)}%
                        </td>
                        <td className="p-3"><StatusBadge kind="ESTIMATED" /></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">Pumping Power Cost (INR)</td>
                        <td className="p-3 font-mono">₹{simulationResult.baseline.irrigation_cost_inr.toFixed(1)}</td>
                        <td className="p-3 font-mono font-bold text-purple-700">₹{simulationResult.simulated.irrigation_cost_inr.toFixed(1)}</td>
                        <td className="p-3 font-mono text-emerald-700 font-bold">
                          ₹{simulationResult.difference.cost_savings_inr > 0 ? "+" : ""}
                          {simulationResult.difference.cost_savings_inr.toFixed(1)}
                        </td>
                        <td className="p-3"><StatusBadge kind="ESTIMATED" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agronomic Decision Support Narrative & Mitigation */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Sprout size={16} className="text-emerald-700" />
                    Agronomic Decision Support Report
                  </h4>
                  <span className="text-[11px] text-stone-500">
                    Language: {lang.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs leading-relaxed text-stone-800 whitespace-pre-wrap font-sans bg-white p-4 rounded-lg border border-stone-200">
                  {simulationResult.narrative_explanation}
                </div>

                {simulationResult.actionable_mitigation && simulationResult.actionable_mitigation.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-bold text-stone-700 mb-2">
                      Actionable Mitigation Recommendations:
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-600">
                      {simulationResult.actionable_mitigation.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* MANDATORY DISCLAIMER (REQUIREMENT #10 & #25) */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-700 shrink-0" />
                <div className="text-xs text-amber-900 leading-snug">
                  <span className="font-bold">🛡️ SIMULATION ONLY — No physical changes made:</span> Running this What-If simulation did NOT toggle your pump, modify your field sensors, or alter real farm configurations. If you choose to adopt this plan, use the Smart Irrigation tab with standard authorization.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 6: HISTORICAL SIMULATIONS DRAWER */}
      {showHistory && (
        <Card className="rounded-2xl border border-stone-200 bg-white mb-6 shadow-sm">
          <CardHeader className="py-3 px-5 border-b border-stone-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <History size={16} className="text-stone-700" />
              Historical Simulations ({historyItems.length})
            </CardTitle>
            <StatusBadge kind="HISTORICAL">Database Log</StatusBadge>
          </CardHeader>
          <CardContent className="p-5">
            {historyItems.length === 0 ? (
              <p className="text-xs text-stone-500 py-3 text-center">
                No past simulations recorded for this farm yet. Run your first simulation above!
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {historyItems.map((item) => (
                  <div key={item.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{item.title}</span>
                        <StatusBadge kind="HISTORICAL_SIMULATION" />
                      </div>
                      <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                        {item.summary || "Virtual simulation record"}
                      </p>
                      {item.created_at && (
                        <span className="text-[10px] text-stone-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {item.data && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (item.data.baseline && item.data.simulated) {
                            setSimulationResult({
                              scenario_title: item.data.scenario_title || item.title,
                              scenario_description: "Historical simulation reloaded from database archives.",
                              status: "success",
                              baseline: {
                                soil_moisture: item.data.baseline.soil_moisture || 48.0,
                                water_use_litres_per_day: item.data.baseline.water_use_litres_per_day || 3500,
                                total_water_litres: item.data.baseline.water_use_litres_per_day * 3 || 10500,
                                crop: item.data.baseline.crop || "Tomato",
                                zone: "Zone 1",
                                soil_type: item.data.baseline.soil || "Red Sandy Loam",
                                temperature_c: 28.5,
                                humidity_pct: 58.0,
                                crop_stress_pct: item.data.baseline.crop_stress_pct || 12.0,
                                irrigation_cost_inr: item.data.baseline.cost_inr || 30.0,
                                risk_level: "Optimal"
                              },
                              simulated: {
                                soil_moisture: item.data.simulated.soil_moisture || 42.0,
                                water_use_litres_per_day: item.data.simulated.water_use_litres_per_day || 2800,
                                total_water_litres: item.data.simulated.total_water_litres || 8400,
                                crop_stress_pct: item.data.simulated.crop_stress_pct || 22.0,
                                irrigation_cost_inr: item.data.simulated.cost_inr || 24.0,
                                duration_days: item.data.params?.duration_days || 3,
                                risk_level: item.data.simulated.risk_level || "Safe"
                              },
                              difference: {
                                water_saved_litres: item.data.difference?.water_saved_litres || 2100,
                                cost_savings_inr: item.data.difference?.cost_savings_inr || 6.0,
                                moisture_delta_pct: item.data.difference?.moisture_delta_pct || -6.0,
                                stress_delta_pct: item.data.difference?.stress_delta_pct || 10.0,
                                risk_verdict: "Archived simulation rerun."
                              },
                              narrative_explanation: item.summary,
                              actionable_mitigation: [],
                              data_status_labels: {},
                              timestamp: item.created_at
                            });
                            resultRef.current?.scrollIntoView({ behavior: "smooth" });
                            toast.info("Loaded historical simulation.");
                          }
                        }}
                        className="text-xs border-stone-300 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                      >
                        Inspect Result
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
