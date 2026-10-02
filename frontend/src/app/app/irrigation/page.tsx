"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useApp } from "@/lib/AppContext";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Droplets,
  Square,
  AlertCircle,
  CheckCircle2,
  Waves,
  Activity,
  RefreshCw,
  Plus,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  Gauge,
  Flame,
  Power,
  Zap,
  ArrowRight,
  ShieldCheck,
  Check,
  History,
  Timer,
  ChevronRight,
  Info,
  Sun,
  CloudRain,
  Snowflake,
  Sliders,
  Settings2,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  irrigationService,
  IRRIGATION_METHODS,
  IrrigationMethod,
  IrrigationSessionState,
  IrrigationRecommendation,
  MockIoTTelemetry,
  IrrigationHistoryItem,
} from "@/lib/irrigationService";

export default function SmartIrrigationPage() {
  const { lang, activeFarm } = useApp();

  // 1. Data states
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<IrrigationMethod | string>("Drip Irrigation");
  const [secondaryMethod, setSecondaryMethod] = useState<string>("");
  const [customMethodName, setCustomMethodName] = useState<string>("Pitcher / Clay Pot Drip");
  const [customEfficiencyPct, setCustomEfficiencyPct] = useState<number>(80);
  const [customFlowRateLpm, setCustomFlowRateLpm] = useState<number>(30);
  const [selectedSeason, setSelectedSeason] = useState<string>("Auto (Current Season)");
  const [soilMoistureOverride, setSoilMoistureOverride] = useState<number | "">("");
  const [showMethodsComparison, setShowMethodsComparison] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [calculatingRec, setCalculatingRec] = useState<boolean>(false);
  const [recommendation, setRecommendation] = useState<IrrigationRecommendation | null>(null);

  // 2. Active Session & Timer states
  const [sessionState, setSessionState] = useState<IrrigationSessionState>("READY");
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [originalDurationMin, setOriginalDurationMin] = useState<number>(15);
  const [totalPlannedSeconds, setTotalPlannedSeconds] = useState<number>(15 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [cumulativeAddedMinutes, setCumulativeAddedMinutes] = useState<number>(0);
  const [customAddMinutes, setCustomAddMinutes] = useState<string>("");

  // 3. Mock IoT Controller Hardware state
  const [mockIot, setMockIot] = useState<MockIoTTelemetry>({
    device_id: "ESP32-AGRI-GATEWAY-01",
    firmware_version: "v2.4.1-sim",
    connection_status: "CONNECTED",
    hardware_mode: "SIMULATED",
    pump_status: "OFF",
    pump_relay: "RELAY-PUMP-MAIN (DE-ENERGIZED)",
    valve_status: "CLOSED",
    flow_rate_lpm: 0.0,
    pressure_bar: 0.0,
    power_draw_kw: 0.02,
  });

  // 4. Dialog & Alert states
  const [stopConfirmOpen, setStopConfirmOpen] = useState<boolean>(false);
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);
  const [stoppedBannerOpen, setStoppedBannerOpen] = useState<boolean>(false);
  const [lastCompletedSession, setLastCompletedSession] = useState<{
    zoneName: string;
    method: string;
    durationMinutes: number;
    waterConservedLitres: number;
  } | null>(null);
  const [stopping, setStopping] = useState<boolean>(false);
  const [starting, setStarting] = useState<boolean>(false);

  // 5. History & Logs
  const [history, setHistory] = useState<IrrigationHistoryItem[]>([]);

  // Timer reference to avoid competing intervals
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve currently selected zone object
  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || zones[0] || null;
  }, [zones, selectedZoneId]);

  // Load zones & past irrigation cycles
  const loadData = async () => {
    const target = activeFarm || "demo-farm";
    setLoading(true);
    try {
      const zRes = await api.get(`/farms/${target}/zones`);
      const zoneList: any[] = zRes.data || [];
      setZones(zoneList);

      // Pre-select Zone 2 if available, or first zone
      if (!selectedZoneId && zoneList.length > 0) {
        const zone2 = zoneList.find((z) => z.name.toLowerCase().includes("zone 2") || z.id === "demo-z2");
        if (zone2) {
          setSelectedZoneId(zone2.id);
        } else {
          setSelectedZoneId(zoneList[0].id);
        }
      }

      // Load history
      const hData = await irrigationService.getHistory();
      setHistory(hData);

      // Check if an active session is already running on the server
      const statusRes = await irrigationService.getStatus();
      if (statusRes.mock_iot) {
        setMockIot(statusRes.mock_iot);
      }
      if (statusRes.active_sessions && statusRes.active_sessions.length > 0) {
        const active = statusRes.active_sessions[0];
        setActiveEventId(active.id);
        setSelectedZoneId(active.zone_id);
        setSelectedMethod((active.irrigation_method as IrrigationMethod) || "Drip Irrigation");
        setOriginalDurationMin(active.original_duration_minutes || active.duration_minutes);
        setCumulativeAddedMinutes(active.added_minutes || 0);
        setRemainingSeconds(active.remaining_seconds);
        setTotalPlannedSeconds(active.duration_minutes * 60);
        setElapsedSeconds(active.elapsed_seconds || 0);
        setSessionState("RUNNING");
      }
    } catch (e) {
      console.error("Failed to load irrigation data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeFarm]);

  // Generate or recalculate recommendation when zone, method, season, or custom parameters change
  useEffect(() => {
    if (!selectedZone || sessionState === "RUNNING") return;

    let isMounted = true;
    const fetchRec = async () => {
      setCalculatingRec(true);
      try {
        const isCustom = typeof selectedMethod === "string" && (selectedMethod.includes("Other") || selectedMethod.includes("Custom"));
        const rec = await irrigationService.getRecommendation(
          selectedZone,
          selectedMethod,
          activeFarm || undefined,
          {
            secondary_method: secondaryMethod || undefined,
            custom_method_name: isCustom ? customMethodName : undefined,
            custom_efficiency_pct: isCustom ? customEfficiencyPct : undefined,
            custom_flow_rate_lpm: isCustom ? customFlowRateLpm : undefined,
            season: selectedSeason !== "Auto (Current Season)" ? selectedSeason : undefined,
            soil_moisture_override: soilMoistureOverride !== "" ? Number(soilMoistureOverride) : undefined,
          }
        );
        if (isMounted) {
          setRecommendation(rec);
          setOriginalDurationMin(rec.recommended_duration_minutes);
          setTotalPlannedSeconds(rec.recommended_duration_minutes * 60);
          setRemainingSeconds(rec.recommended_duration_minutes * 60);
          setElapsedSeconds(0);
          setCumulativeAddedMinutes(0);
          setSessionState("READY");
        }
      } catch (err) {
        console.error("Recommendation calculation error:", err);
      } finally {
        if (isMounted) setCalculatingRec(false);
      }
    };

    fetchRec();

    return () => {
      isMounted = false;
    };
  }, [
    selectedZoneId,
    selectedMethod,
    secondaryMethod,
    customMethodName,
    customEfficiencyPct,
    customFlowRateLpm,
    selectedSeason,
    soilMoistureOverride,
    activeFarm,
  ]);

  // LIVE COUNTDOWN TIMER ENGINE
  useEffect(() => {
    if (sessionState === "RUNNING") {
      // Clear any prior timer
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setRemainingSeconds((prevRemaining) => {
          // Automatic completion when remaining reaches zero
          if (prevRemaining <= 1) {
            handleAutomaticCompletion();
            return 0;
          }
          return prevRemaining - 1;
        });

        setElapsedSeconds((prevElapsed) => prevElapsed + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionState]);

  // Format countdown time string safely (never NaN, negative, or invalid)
  const formatTimer = (seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Live cumulative water volume delivered calculation
  const cumulativeWaterLitres = useMemo(() => {
    const rate = mockIot.flow_rate_lpm || 22.4;
    return Math.round((elapsedSeconds * rate) / 60);
  }, [elapsedSeconds, mockIot.flow_rate_lpm]);

  // START IRRIGATION (User pressed YES)
  const handleStartIrrigation = async () => {
    if (!selectedZone) {
      toast.error("Please select a target field zone first.");
      return;
    }

    const duration = recommendation?.recommended_duration_minutes || originalDurationMin || 15;
    setStarting(true);
    setStoppedBannerOpen(false);

    try {
      const isCustom = typeof selectedMethod === "string" && (selectedMethod.includes("Other") || selectedMethod.includes("Custom"));
      const res = await irrigationService.startIrrigation(
        selectedZone.id,
        selectedMethod,
        duration,
        recommendation?.soil_condition,
        isCustom ? customMethodName : undefined,
        secondaryMethod || undefined
      );

      setActiveEventId(res.event_id);
      setMockIot(res.mock_iot);
      setOriginalDurationMin(duration);
      setTotalPlannedSeconds(duration * 60);
      setRemainingSeconds(duration * 60);
      setElapsedSeconds(0);
      setCumulativeAddedMinutes(0);
      setSessionState("RUNNING");

      toast.success(
        `Irrigation started for ${selectedZone.name}! Mock IoT pump energized and solenoid valve opened.`,
        { duration: 4000 }
      );

      // Refresh history in background
      irrigationService.getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      toast.error("Failed to start irrigation: " + (err.message || "Simulated gateway error"));
    } finally {
      setStarting(false);
    }
  };

  // STANDBY / LATER (User pressed LATER)
  const handleStandbyLater = () => {
    setSessionState("READY");
    toast.info(`Irrigation setup retained on standby for ${selectedZone?.name || "selected zone"}.`, {
      description: "Hardware controller remains OFF. You can start anytime.",
    });
  };

  // MANUAL TIME ADJUSTMENT / ADD TIME (CORE REQUIREMENT)
  // Crucial: Added time is ADDED TO CURRENT REMAINING TIME! (NEW REMAINING TIME = CURRENT REMAINING TIME + ADDED TIME)
  const handleAddTime = async (minutesToAdd: number) => {
    if (minutesToAdd <= 0 || isNaN(minutesToAdd)) {
      toast.error("Invalid duration to add. Must be greater than 0 minutes.");
      return;
    }

    const secondsToAdd = minutesToAdd * 60;

    // Direct state update adding to CURRENT REMAINING TIME
    setRemainingSeconds((prev) => {
      const newRemaining = prev + secondsToAdd;
      return newRemaining;
    });

    setTotalPlannedSeconds((prev) => prev + secondsToAdd);
    setCumulativeAddedMinutes((prev) => prev + minutesToAdd);

    // Update backend / hardware timer in background
    try {
      const res = await irrigationService.extendIrrigation(
        minutesToAdd,
        activeEventId || undefined,
        selectedZone?.id
      );
      if (res.mock_iot) setMockIot(res.mock_iot);
    } catch (err) {
      console.warn("Backend extension sync error, continuing client timer:", err);
    }

    const newTotalRemaining = remainingSeconds + secondsToAdd;
    const formattedNewTime = formatTimer(newTotalRemaining);

    toast.success(
      `Added +${minutesToAdd >= 60 ? `${minutesToAdd / 60} hour` : `${minutesToAdd} minutes`} to active cycle!`,
      {
        description: `New remaining time: ${formattedNewTime}. Active solenoid valve timer extended.`,
        duration: 3500,
      }
    );
  };

  // MANUAL STOP IRRIGATION
  const handleManualStop = async () => {
    setStopping(true);
    try {
      const res = await irrigationService.stopIrrigation(
        selectedZone?.id,
        activeEventId || undefined,
        true
      );

      if (res.mock_iot) {
        setMockIot(res.mock_iot);
      } else {
        setMockIot((prev) => ({
          ...prev,
          pump_status: "OFF",
          valve_status: "CLOSED",
          flow_rate_lpm: 0,
          pressure_bar: 0,
        }));
      }

      setSessionState("MANUALLY_STOPPED");
      setStopConfirmOpen(false);
      setStoppedBannerOpen(true);

      toast.warning("Irrigation Stopped", {
        description: `Cycle for ${selectedZone?.name} was halted manually. Solenoid valve closed and pump turned OFF.`,
        duration: 4000,
      });

      // Refresh history
      irrigationService.getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      toast.error("Failed to stop irrigation: " + (err.message || "Gateway communication error"));
    } finally {
      setStopping(false);
    }
  };

  // AUTOMATIC IRRIGATION COMPLETION (Countdown reached 00:00)
  const handleAutomaticCompletion = async () => {
    setSessionState("COMPLETED");

    // Deactivate hardware
    try {
      const res = await irrigationService.stopIrrigation(
        selectedZone?.id,
        activeEventId || undefined,
        false
      );
      if (res.mock_iot) setMockIot(res.mock_iot);
    } catch (err) {
      setMockIot((prev) => ({
        ...prev,
        pump_status: "OFF",
        valve_status: "CLOSED",
        flow_rate_lpm: 0,
        pressure_bar: 0,
      }));
    }

    const totalMinutesRun = Math.max(1, Math.round(elapsedSeconds / 60));
    const waterConserved = Math.round(totalMinutesRun * 18.2);

    setLastCompletedSession({
      zoneName: selectedZone?.name || "Zone 2",
      method: selectedMethod,
      durationMinutes: originalDurationMin + cumulativeAddedMinutes,
      waterConservedLitres: waterConserved,
    });

    setSuccessModalOpen(true);

    // Refresh history
    irrigationService.getHistory().then(setHistory).catch(() => {});
  };

  // Reset after completion or stopped
  const handleResetForNewCycle = () => {
    setSuccessModalOpen(false);
    setStoppedBannerOpen(false);
    setSessionState("READY");
    setElapsedSeconds(0);
    setCumulativeAddedMinutes(0);
    const recMin = recommendation?.recommended_duration_minutes || 15;
    setRemainingSeconds(recMin * 60);
    setTotalPlannedSeconds(recMin * 60);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
                <Droplets size={22} className="animate-bounce" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>{t(lang, "smart_irrigation")}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                    IoT Gateway V2
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                  Precision rootzone moisture intelligence & automated solenoid valve telemetry
                </p>
              </div>
            </div>
          </div>

          {/* Quick status pill & refresh */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {sessionState === "RUNNING" ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white shadow-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider">● Valve Flowing</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Controller Standby</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 px-3 text-xs font-semibold text-stone-700 rounded-xl hover:bg-stone-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: ACTIVE IRRIGATION IN PROGRESS SCREEN (Dedicated View)  */}
        {/* ============================================================== */}
        {sessionState === "RUNNING" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Active Session Hero Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-blue-700">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
                  backgroundSize: "32px 32px, 48px 48px",
                }}
              />

              <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Left details */}
                <div className="space-y-3 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/25 border border-blue-400/40 text-blue-200 text-xs font-bold uppercase tracking-wider">
                    <Waves size={14} className="animate-pulse text-cyan-300" />
                    <span>IRRIGATION IN PROGRESS</span>
                  </div>

                  <div>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
                      <span>{selectedZone?.name || "Zone 2"}</span>
                      <span className="text-base font-normal text-blue-200">({selectedZone?.crop || "Chilli"})</span>
                    </h2>
                    <p className="text-sm text-blue-200/90 mt-1 flex items-center justify-center md:justify-start gap-2">
                      <span>Method: <strong className="text-white">{selectedMethod}</strong></span>
                      <span>•</span>
                      <span>Soil: <strong className="text-white">{selectedZone?.soil_type || "Sandy loam"}</strong></span>
                    </p>
                  </div>

                  <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-blue-200 font-mono">
                    <span className="bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-500/30">
                      Original Rec: <strong>{originalDurationMin} min</strong>
                    </span>
                    {cumulativeAddedMinutes > 0 && (
                      <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-400/30">
                        Added: <strong>+{cumulativeAddedMinutes} min</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: GIANT LIVE COUNTDOWN TIMER DISPLAY */}
                <div className="flex flex-col items-center">
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ring background */}
                    <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-blue-500/15 border-4 border-cyan-400/40 flex items-center justify-center shadow-inner relative">
                      <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-transparent border-b-cyan-300 border-l-transparent animate-spin duration-3000" />
                      
                      <div className="text-center px-4">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-200 mb-1 flex items-center justify-center gap-1">
                          <Timer size={13} className="animate-spin text-cyan-300" />
                          <span>Remaining Time</span>
                        </div>
                        <div
                          data-testid="live-timer-countdown"
                          className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-md"
                        >
                          {formatTimer(remainingSeconds)}
                        </div>
                        <div className="text-xs text-cyan-200/80 mt-1 font-mono">
                          {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s elapsed
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flow rate & delivery pill */}
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-cyan-200 text-xs font-mono border border-white/20">
                    <Droplets size={12} className="text-cyan-400" />
                    <span>Live Discharge: {cumulativeWaterLitres} Litres</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MOCK IoT HARDWARE CONTROLLER TELEMETRY CARD */}
            <Card className="rounded-3xl border border-stone-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="bg-stone-50/80 border-b border-stone-100 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Cpu size={16} className="text-blue-600" />
                  <span>Simulated IoT Hardware Telemetry & Actuators</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    GATEWAY ONLINE
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">ESP32-AGRI-01</span>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Pump status */}
                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center justify-between text-xs text-blue-700 font-semibold mb-1">
                      <span>Main Pump Relay</span>
                      <Power size={14} className="text-blue-600" />
                    </div>
                    <div data-testid="mock-pump-status" className="text-lg font-black text-blue-950 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                      <span>{mockIot.pump_status}</span>
                    </div>
                    <div className="text-[10px] text-blue-600 font-mono mt-0.5">RELAY-01 ENERGIZED</div>
                  </div>

                  {/* Solenoid Valve */}
                  <div className="p-3.5 rounded-2xl bg-cyan-50 border border-cyan-200">
                    <div className="flex items-center justify-between text-xs text-cyan-700 font-semibold mb-1">
                      <span>Solenoid Valve</span>
                      <Waves size={14} className="text-cyan-600" />
                    </div>
                    <div data-testid="mock-valve-status" className="text-lg font-black text-cyan-950 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                      <span>{mockIot.valve_status}</span>
                    </div>
                    <div className="text-[10px] text-cyan-700 font-mono mt-0.5">VALVE-{selectedZone?.name?.replace(/\s+/g, "") || "Z2"}</div>
                  </div>

                  {/* Flow Rate */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
                      <span>Water Flow Rate</span>
                      <Droplets size={14} className="text-emerald-600" />
                    </div>
                    <div className="text-lg font-black text-emerald-950">
                      {mockIot.flow_rate_lpm || 22.4} <span className="text-xs font-normal text-emerald-700">L/min</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-mono mt-0.5">YF-S201 Flow Sensor</div>
                  </div>

                  {/* Line Pressure */}
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
                    <div className="flex items-center justify-between text-xs text-purple-700 font-semibold mb-1">
                      <span>Inline Pressure</span>
                      <Gauge size={14} className="text-purple-600" />
                    </div>
                    <div className="text-lg font-black text-purple-950">
                      {mockIot.pressure_bar || 1.85} <span className="text-xs font-normal text-purple-700">bar</span>
                    </div>
                    <div className="text-[10px] text-purple-700 font-mono mt-0.5">Transducer Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ACTION CONTROLS: ADD TIME & STOP IRRIGATION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* MANUAL TIME ADJUSTMENT / ADD TIME (CORE REQUIREMENT) */}
              <Card className="lg:col-span-2 rounded-3xl border border-stone-200 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-stone-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-stone-900 flex items-center gap-2">
                        <Clock size={18} className="text-blue-600" />
                        <span>Manual Time Adjustment (Add Time)</span>
                      </CardTitle>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Increases current remaining time live. Does not reset or restart the countdown.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl">
                      Live Remaining: {formatTimer(remainingSeconds)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {/* Preset Buttons */}
                  <div>
                    <Label className="text-xs font-bold text-stone-700 mb-2 block">Quick Time Extensions</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { label: "+5 min", mins: 5 },
                        { label: "+10 min", mins: 10 },
                        { label: "+15 min", mins: 15 },
                        { label: "+30 min", mins: 30 },
                        { label: "+1 hour", mins: 60, highlight: true },
                      ].map((btn) => (
                        <Button
                          key={btn.label}
                          data-testid={`add-time-${btn.mins}`}
                          onClick={() => handleAddTime(btn.mins)}
                          className={`h-11 font-bold text-xs rounded-xl cursor-pointer shadow-xs transition ${
                            btn.highlight
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white ring-2 ring-blue-300"
                              : "bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-300"
                          }`}
                        >
                          <Plus size={13} className="mr-1" />
                          <span>{btn.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Minutes Input */}
                  <div className="pt-2 border-t border-stone-100 flex items-center gap-2.5">
                    <div className="flex-1">
                      <Label className="text-[11px] font-semibold text-stone-600 mb-1 block">Custom Duration (Minutes)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 25, 45, 90"
                        min="1"
                        max="240"
                        value={customAddMinutes}
                        onChange={(e) => setCustomAddMinutes(e.target.value)}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <Button
                      data-testid="add-custom-time-btn"
                      onClick={() => {
                        const parsed = parseInt(customAddMinutes, 10);
                        if (parsed > 0) {
                          handleAddTime(parsed);
                          setCustomAddMinutes("");
                        } else {
                          toast.error("Please enter a valid positive number of minutes");
                        }
                      }}
                      disabled={!customAddMinutes || parseInt(customAddMinutes, 10) <= 0}
                      className="h-10 px-4 mt-5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
                    >
                      <Plus size={13} className="mr-1" />
                      <span>Add Custom Time</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* STOP IRRIGATION CARD */}
              <Card className="rounded-3xl border border-rose-200 bg-rose-50/50 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
                    <Square size={17} className="fill-current text-rose-600" />
                    <span>Emergency Stop</span>
                  </CardTitle>
                  <p className="text-xs text-rose-700 leading-relaxed mt-1">
                    Immediately deactivates the mock pump relay, shuts the solenoid valve, and marks cycle as stopped.
                  </p>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="p-3 rounded-2xl bg-white/80 border border-rose-200 text-[11px] text-rose-800 mb-4 font-mono">
                    Zone: <strong>{selectedZone?.name}</strong> • Method: <strong>{selectedMethod}</strong>
                  </div>
                  <Button
                    data-testid="stop-irrigation-btn"
                    variant="destructive"
                    onClick={() => setStopConfirmOpen(true)}
                    disabled={stopping}
                    className="w-full h-12 text-sm font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Square size={16} className="fill-current" />
                    <span>{stopping ? "Deactivating Relays..." : "STOP IRRIGATION"}</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: SETUP & RECOMMENDATION INTERFACE (When NOT running)    */}
        {/* ============================================================== */}
        {sessionState !== "RUNNING" && (
          <div className="space-y-6">
            {/* MANUALLY STOPPED NOTIFICATION BANNER */}
            {stoppedBannerOpen && (
              <div className="p-5 rounded-3xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                    <Square size={18} className="fill-current text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">Irrigation Stopped</h3>
                    <p className="text-xs text-amber-700 mt-0.5">
                      The cycle for {selectedZone?.name} was halted manually. Solenoid valve closed and pump turned OFF.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setStoppedBannerOpen(false)}
                  className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl h-8 px-4 shrink-0"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* STEP 1: IRRIGATION METHOD SELECTION & FARM ADAPTABILITY */}
            <Card className="rounded-3xl border border-stone-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="bg-stone-50/70 pb-3 border-b border-stone-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                        1
                      </span>
                      <CardTitle className="text-base font-bold text-stone-900">
                        {t(lang, "method_selection") || "Select Irrigation Method & Climate Factors"}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-stone-500">
                      Choose from precision drip, sprinklers, traditional furrow/flood, or define custom methods used across your farm.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      Primary: {selectedMethod === "Other (Custom)" ? customMethodName : selectedMethod}
                    </span>
                    {secondaryMethod && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                        + Dual: {secondaryMethod}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* 1.1 Seasonal Climate Mode Selector */}
                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sun size={18} className="text-amber-600" />
                    <div>
                      <div className="text-xs font-bold text-blue-950">Cropping Season & Evapotranspiration (ET₀)</div>
                      <div className="text-[11px] text-stone-600">
                        Climate directly influences soil evaporation and crop water requirement.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {[
                      { label: "🔄 Auto (Current Date)", value: "Auto (Current Season)", icon: "🔄" },
                      { label: "☀️ Summer (Zaid • 7.2 mm/d)", value: "Summer (Zaid)", icon: "☀️" },
                      { label: "🌧️ Monsoon (Kharif • 4.2 mm/d)", value: "Monsoon (Kharif)", icon: "🌧️" },
                      { label: "❄️ Winter (Rabi • 3.2 mm/d)", value: "Winter (Rabi)", icon: "❄️" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSelectedSeason(s.value)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                          selectedSeason === s.value
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
                        }`}
                      >
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1.2 Primary Irrigation Methods Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {IRRIGATION_METHODS.map((m) => {
                    const isSelected = selectedMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        data-testid={`method-${m.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                        onClick={() => setSelectedMethod(m.id)}
                        className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-50/90 border-blue-600 ring-2 ring-blue-400/30 shadow-sm"
                            : "bg-stone-50/60 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{m.icon}</span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <div className="font-extrabold text-xs text-stone-900 line-clamp-1">{m.name}</div>
                          <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                            {m.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-blue-700">{m.efficiency}% Eff.</span>
                          <span className="text-stone-400 truncate max-w-[100px]">{m.waterSavings}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 1.3 Custom Method Configuration (When "Other (Custom)" is selected) */}
                {selectedMethod === "Other (Custom)" && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Settings2 size={16} className="text-amber-800" />
                        <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                          Define Your Custom Farm Irrigation Method
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                        Custom Parameters Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[11px] font-bold text-amber-950 mb-1 block">
                          Method Name / Technology
                        </Label>
                        <Input
                          value={customMethodName}
                          onChange={(e) => setCustomMethodName(e.target.value)}
                          placeholder="e.g. Solar Pitcher Clay Pot, Bamboo Drip..."
                          className="h-9 text-xs bg-white border-amber-300 font-bold"
                        />
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none">
                          {[
                            "Pitcher / Matka Drip",
                            "Bamboo Gravity Pipe",
                            "Solar Bubble Drip",
                            "Border Strip Flood",
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCustomMethodName(preset)}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold cursor-pointer shrink-0"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[11px] font-bold text-amber-950 mb-1">
                          <span>Application Efficiency:</span>
                          <span className="font-mono text-amber-900">{customEfficiencyPct}%</span>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={98}
                          step={1}
                          value={customEfficiencyPct}
                          onChange={(e) => setCustomEfficiencyPct(Number(e.target.value))}
                          className="w-full accent-amber-700 cursor-pointer h-2 bg-amber-200 rounded-lg mt-2"
                        />
                        <div className="flex justify-between text-[10px] text-amber-800 mt-1">
                          <span>40% (Permeable)</span>
                          <span>80% (Standard)</span>
                          <span>98% (Ultra Precision)</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[11px] font-bold text-amber-950 mb-1">
                          <span>Delivery Flow Rate:</span>
                          <span className="font-mono text-amber-900">{customFlowRateLpm} L/min</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={150}
                          step={5}
                          value={customFlowRateLpm}
                          onChange={(e) => setCustomFlowRateLpm(Number(e.target.value))}
                          className="w-full accent-amber-700 cursor-pointer h-2 bg-amber-200 rounded-lg mt-2"
                        />
                        <div className="flex justify-between text-[10px] text-amber-800 mt-1">
                          <span>5 LPM (Micro trickle)</span>
                          <span>30 LPM (Pump outlet)</span>
                          <span>150 LPM (High flow)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1.4 Multiple Methods (Dual System) & Soil Override Panel */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Secondary Irrigation Method Selector */}
                  <div>
                    <Label className="text-xs font-bold text-stone-800 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Waves size={14} className="text-indigo-600" />
                        <span>Secondary / Supplemental Method (Dual Irrigation)</span>
                      </span>
                      {secondaryMethod && (
                        <button
                          type="button"
                          onClick={() => setSecondaryMethod("")}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </Label>
                    <Select value={secondaryMethod || "none"} onValueChange={(v) => setSecondaryMethod(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9 rounded-xl bg-white border-stone-200 text-xs font-semibold">
                        <SelectValue placeholder="None (Single Method Cycle)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">None (Single Method Cycle)</SelectItem>
                        {IRRIGATION_METHODS.filter((m) => m.id !== selectedMethod && m.id !== "Other (Custom)").map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.icon} {m.name} ({m.efficiency}% eff)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                      Useful for dual setups (e.g. Primary Drip for root zone + Micro-Sprinkler for canopy cooling & fertigation).
                    </p>
                  </div>

                  {/* Soil Moisture Deficit Simulation Override */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-stone-800 mb-1">
                      <span className="flex items-center gap-1.5">
                        <Droplets size={14} className="text-blue-600" />
                        <span>Live Soil Moisture Override</span>
                      </span>
                      <span className="font-mono text-xs text-blue-700">
                        {soilMoistureOverride !== "" ? `${soilMoistureOverride}% (Simulated)` : `${selectedZone?.last_moisture ?? 32.1}% (Sensor)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={10}
                        max={70}
                        step={1}
                        value={soilMoistureOverride !== "" ? Number(soilMoistureOverride) : Math.round(selectedZone?.last_moisture ?? 32.1)}
                        onChange={(e) => setSoilMoistureOverride(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-2 bg-stone-200 rounded-lg"
                      />
                      {soilMoistureOverride !== "" && (
                        <button
                          type="button"
                          onClick={() => setSoilMoistureOverride("")}
                          className="text-[10px] font-bold text-stone-500 hover:text-stone-700 bg-stone-200 px-2 py-1 rounded-md shrink-0 cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      Test recommendation under severe dry spell (15%) or post-rain condition (50%).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* STEP 2: DIGITAL TWIN FIELD ZONE SELECTION */}
            <Card className="rounded-3xl border border-stone-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="bg-stone-50/70 pb-3 border-b border-stone-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                      2
                    </span>
                    <CardTitle className="text-base font-bold text-stone-900">
                      {t(lang, "target_zone") || "Select Digital Twin Field Zone"}
                    </CardTitle>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Selected Zone: {selectedZone?.name || "Zone 2"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {zones.map((z) => {
                    const isSelected = selectedZoneId === z.id;
                    const isZoneRunning = history.some((h) => h.zone_id === z.id && h.state === "running");
                    const moist = z.last_moisture ?? 45.0;

                    let moistColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
                    if (moist < 25) moistColor = "text-rose-700 bg-rose-50 border-rose-200";
                    else if (moist < 40) moistColor = "text-amber-700 bg-amber-50 border-amber-200";

                    return (
                      <button
                        key={z.id}
                        data-testid={`zone-select-card-${z.id}`}
                        onClick={() => setSelectedZoneId(z.id)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-400/30 shadow-sm"
                            : "bg-stone-50/60 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5">
                            <span>{z.name}</span>
                            {isZoneRunning && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white animate-pulse">
                                FLOWING
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-stone-600 mb-3 flex items-center gap-2">
                          <span className="font-semibold text-stone-800">{z.crop || "No crop assigned"}</span>
                          <span>•</span>
                          <span>{z.soil_type || "Red loam"}</span>
                          {z.area && (
                            <>
                              <span>•</span>
                              <span>{z.area} {z.area_unit || "acre"}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-200/60">
                          <span className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-[11px] ${moistColor}`}>
                            💧 {moist.toFixed(1)}% Moisture
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                            {z.status || "healthy"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* STEP 3 & 4: SOIL ANALYSIS & AI RECOMMENDATION CARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Soil Telemetry Summary */}
              <Card className="rounded-3xl border border-stone-200 bg-white shadow-xs">
                <CardHeader className="bg-stone-50/70 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center">
                      3
                    </span>
                    <CardTitle className="text-sm font-bold text-stone-900">
                      Relevant Soil Analysis
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-3.5">
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                    <div className="text-xs text-amber-900 font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>Target Zone Soil</span>
                      <span className="font-mono text-amber-700">{selectedZone?.name}</span>
                    </div>
                    <div className="text-sm font-extrabold text-stone-900">
                      {selectedZone?.soil_type || "Sandy loam"}
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {recommendation?.soil_condition || "Moderate water retention capacity. Good rootzone permeability."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                      <span>Soil Moisture vs Field Capacity</span>
                      <span className="font-mono font-bold text-blue-700">
                        {recommendation?.current_moisture_pct || 32.1}% / {recommendation?.target_moisture_pct || 60}%
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.round(((recommendation?.current_moisture_pct || 32.1) / (recommendation?.target_moisture_pct || 60)) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono">
                      <span>Deficit: {recommendation?.moisture_deficit_pct || 27.9}%</span>
                      <span>Target: {recommendation?.target_moisture_pct || 60}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SMART IRRIGATION DURATION & ACCURATE TIME RECOMMENDATION */}
              <Card className="lg:col-span-2 rounded-3xl border-2 border-blue-300 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 shadow-md">
                <CardHeader className="pb-3 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                      4
                    </span>
                    <div>
                      <CardTitle className="text-base font-extrabold text-blue-950 flex items-center gap-2">
                        <Sparkles size={18} className="text-blue-600" />
                        <span>Smart Irrigation & Accurate Time Recommendation</span>
                      </CardTitle>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Analyzed using soil moisture, crop coefficient, season, and zone area.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-600 text-white shadow-2xs">
                      {recommendation?.season || selectedSeason}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMethodsComparison(!showMethodsComparison)}
                      className="h-8 px-2.5 text-[11px] font-bold border-blue-300 text-blue-700 bg-white hover:bg-blue-50 rounded-xl cursor-pointer"
                    >
                      {showMethodsComparison ? "▲ Hide Comparison" : "📊 Compare All Methods"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {/* Comprehensive Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                    <div className="p-2.5 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
                      <div className="text-[10px] text-stone-400 font-bold uppercase">Zone & Area</div>
                      <div className="text-xs font-black text-stone-900 mt-0.5 truncate">{selectedZone?.name || "Zone 2"}</div>
                      <div className="text-[10px] text-blue-700 font-mono font-semibold">{recommendation?.area_acres || selectedZone?.area || 1.5} ac ({recommendation?.area_sqm?.toLocaleString()} m²)</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
                      <div className="text-[10px] text-stone-400 font-bold uppercase">Method</div>
                      <div className="text-xs font-black text-stone-900 mt-0.5 truncate">{recommendation?.irrigation_method || selectedMethod}</div>
                      <div className="text-[10px] text-emerald-700 font-mono font-semibold">{recommendation?.method_efficiency_pct || 90}% Eff. • {recommendation?.system_flow_rate_lpm || 22.4} LPM</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
                      <div className="text-[10px] text-stone-400 font-bold uppercase">Crop Demand</div>
                      <div className="text-xs font-black text-stone-900 mt-0.5 truncate">{selectedZone?.crop || "Chilli"}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{recommendation?.season || "Summer"} • ET₀ {recommendation?.seasonal_et0_mm_day || 7.2}mm</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs">
                      <div className="text-[10px] text-blue-200 font-bold uppercase">Recommended Run</div>
                      <div data-testid="recommended-duration-stat" className="text-base font-black mt-0.5">
                        {recommendation?.recommended_duration_minutes || originalDurationMin} min
                      </div>
                      <div className="text-[10px] text-blue-200 font-mono">{recommendation?.recommended_duration_formatted || `${recommendation?.recommended_duration_minutes || 15} min`}</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
                      <div className="text-[10px] text-stone-400 font-bold uppercase">Gross Water</div>
                      <div className="text-xs font-black text-cyan-900 font-mono mt-0.5">
                        {recommendation?.gross_water_litres?.toLocaleString() || "107,242"} L
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">Net: {recommendation?.net_water_litres?.toLocaleString()} L</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white border border-blue-200/80 shadow-2xs">
                      <div className="text-[10px] text-stone-400 font-bold uppercase">Pump Energy</div>
                      <div className="text-xs font-black text-amber-900 font-mono mt-0.5">
                        {recommendation?.energy_estimate?.energy_kwh || 0.94} kWh
                      </div>
                      <div className="text-[10px] text-amber-700 font-semibold font-mono">~₹{recommendation?.energy_estimate?.estimated_cost_inr || 3.3} cost</div>
                    </div>
                  </div>

                  {/* ACCURATE OPTIMAL TIMING RECOMMENDATION BANNER */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-sm space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-cyan-400" />
                        <span className="text-xs font-black tracking-wider uppercase text-cyan-300">
                          ACCURATE TIME-OF-DAY IRRIGATION WINDOW
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                          Next Cycle: In {recommendation?.next_irrigation_days || 3} Days
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-white/10 border border-white/10 space-y-1">
                        <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span>Recommended Start Window</span>
                        </div>
                        <div className="text-sm font-black text-white font-mono">
                          {recommendation?.optimal_timing?.recommended_window || "05:30 AM – 08:30 AM (Early Morning)"}
                        </div>
                        <p className="text-[11px] text-stone-300 leading-relaxed pt-0.5">
                          {recommendation?.optimal_timing?.explanation || "Irrigating during cooler morning hours minimizes thermal drift and avoids up to 35% evaporative loss."}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle size={12} className="text-rose-400" />
                          <span>High-Risk Window to Avoid</span>
                        </div>
                        <div className="text-sm font-black text-rose-200 font-mono">
                          {recommendation?.optimal_timing?.avoid_window || "11:00 AM – 04:00 PM (Peak Heat & Solar Radiation)"}
                        </div>
                        <p className="text-[11px] text-stone-300 leading-relaxed pt-0.5">
                          Irrigating in high midday heat causes rapid droplet vaporization, crusts topsoil, and can scald young foliage.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DUAL / SECONDARY METHOD GUIDANCE CARD (If active) */}
                  {recommendation?.secondary_method && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <Waves size={15} className="text-indigo-700" />
                          <span className="font-extrabold">Dual-Method Strategy: {recommendation.irrigation_method} + {recommendation.secondary_method.method_name}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-200 text-indigo-900">
                          Combined Run
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-700 leading-relaxed">
                        {recommendation.secondary_method.dual_application_advice}
                      </p>
                      <div className="flex items-center gap-4 text-[10px] text-indigo-900 pt-1 font-mono font-semibold">
                        <span>Secondary Run: {recommendation.secondary_method.recommended_duration_minutes} min</span>
                        <span>•</span>
                        <span>Secondary Water: {recommendation.secondary_method.gross_water_litres?.toLocaleString()} L</span>
                        <span>•</span>
                        <span>Secondary Efficiency: {recommendation.secondary_method.efficiency_pct}%</span>
                      </div>
                    </div>
                  )}

                  {/* MULTI-METHOD COMPARISON TABLE (Collapsible) */}
                  {showMethodsComparison && recommendation?.methods_comparison && (
                    <div className="p-4 rounded-2xl bg-white border-2 border-blue-200 shadow-xs space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={14} className="text-blue-600" />
                            <span>Comparison Across All Irrigation Methods (for {selectedZone?.name || "Zone 2"})</span>
                          </h4>
                          <p className="text-[11px] text-stone-500">
                            See how duration and water volume vary across different farm irrigation setups.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-stone-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-extrabold text-[10px]">
                            <tr>
                              <th className="py-2 px-3">Irrigation Method</th>
                              <th className="py-2 px-3">Efficiency</th>
                              <th className="py-2 px-3">Flow Rate</th>
                              <th className="py-2 px-3">Run Duration</th>
                              <th className="py-2 px-3">Gross Water</th>
                              <th className="py-2 px-3">Water Savings</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 bg-white">
                            {recommendation.methods_comparison.map((item, idx) => (
                              <tr
                                key={idx}
                                className={item.is_selected ? "bg-blue-50/70 font-semibold" : "hover:bg-stone-50"}
                              >
                                <td className="py-2 px-3 flex items-center gap-1.5">
                                  <span>{item.icon}</span>
                                  <span className="font-bold text-stone-900">{item.method_name}</span>
                                  {item.is_selected && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">
                                      CURRENT
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-blue-700 font-bold">{item.efficiency_pct}%</td>
                                <td className="py-2 px-3 font-mono text-stone-600">{item.flow_rate_lpm} LPM</td>
                                <td className="py-2 px-3 font-mono font-bold text-stone-900">{item.duration_formatted}</td>
                                <td className="py-2 px-3 font-mono text-stone-700">{item.gross_water_litres?.toLocaleString()} L</td>
                                <td className="py-2 px-3 text-[11px] text-emerald-700 font-semibold">{item.water_savings_vs_flood}</td>
                                <td className="py-2 px-3 text-right">
                                  {!item.is_selected && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedMethod(item.method_name as IrrigationMethod);
                                      }}
                                      className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 text-stone-700 font-bold border border-stone-200 cursor-pointer"
                                    >
                                      Select
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key Factors Breakdown */}
                  <div>
                    <Label className="text-xs font-bold text-stone-700 mb-2 block">
                      Agronomic Factors Used For Time & Volume Recommendation:
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {(recommendation?.factors || []).map((f) => (
                        <div key={f.name} className="p-3 rounded-xl bg-white border border-stone-200 text-xs">
                          <div className="flex items-center justify-between font-bold text-stone-800">
                            <span>{f.name}</span>
                            <span className="font-mono text-blue-700">{f.value}</span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{f.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Plain Language Explanation */}
                  {recommendation?.explanation && (
                    <div className="p-3.5 rounded-2xl bg-blue-100/40 border border-blue-200 text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
                      <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <span>{recommendation.explanation}</span>
                    </div>
                  )}

                  {/* ======================================================= */}
                  {/* STEP 5: START CONFIRMATION ([YES] [LATER])                */}
                  {/* ======================================================= */}
                  <div className="pt-4 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-black text-stone-900">
                        {t(lang, "start_irrigation_now_prompt") || "Do you want to start irrigation now?"}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Will energize pump relay & open solenoid valve for {recommendation?.recommended_duration_minutes || originalDurationMin} minutes ({recommendation?.gross_water_litres?.toLocaleString() || "107,242"} Litres).
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        data-testid="irr-standby-later-btn"
                        variant="outline"
                        onClick={handleStandbyLater}
                        className="h-11 px-5 rounded-2xl border-stone-300 font-bold text-xs text-stone-700 cursor-pointer hover:bg-stone-100 shadow-2xs"
                      >
                        {t(lang, "later") || "LATER"}
                      </Button>

                      <Button
                        data-testid="irr-start-yes-btn"
                        onClick={handleStartIrrigation}
                        disabled={starting || !selectedZone}
                        className="h-11 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer shadow-md flex items-center gap-2"
                      >
                        <Droplets size={16} />
                        <span>{starting ? "Starting..." : `${t(lang, "yes_start") || "YES"} — Start Irrigation Now`}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* RECENT IRRIGATIONS LOG & VALVE TELEMETRY HISTORY               */}
        {/* ============================================================== */}
        <Card className="rounded-3xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-stone-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-stone-900 flex items-center gap-2">
              <History size={18} className="text-stone-500" />
              <span>Irrigation Activity History & Valve Cycles</span>
            </CardTitle>
            <span className="text-xs font-semibold text-stone-400 font-mono">
              {history.length} Past Cycles Recorded
            </span>
          </CardHeader>
          <CardContent className="p-5">
            {history.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-6">No irrigation cycles recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {history.slice(0, 8).map((h) => {
                  const zName = zones.find((z) => z.id === h.zone_id)?.name || h.zone_id;
                  const isRunning = h.state === "running";

                  return (
                    <div
                      key={h.id}
                      className={`p-3.5 rounded-2xl border text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        isRunning
                          ? "bg-blue-50 border-blue-300 ring-1 ring-blue-400/30"
                          : "bg-stone-50/60 border-stone-200"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-stone-900">{zName}</span>
                          <span className="text-xs text-stone-500">
                            • {h.irrigation_method || "Drip Irrigation"}
                          </span>
                          {isRunning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              Running Now
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : "Recently"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        <span className="text-xs text-stone-700 bg-white border border-stone-200 px-2.5 py-1 rounded-xl font-mono">
                          {h.duration_minutes} min
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl border ${
                            h.state === "stopped"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : h.state === "running"
                              ? "bg-blue-100 text-blue-900 border-blue-300 font-extrabold"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {h.state || "completed"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* STOP CONFIRMATION MODAL */}
      <Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Square size={20} className="fill-current text-rose-600" />
              <span>Confirm Manual Stop</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 leading-relaxed">
            Immediately close solenoid valve and deactivate main pump relay for{" "}
            <strong className="text-stone-900">{selectedZone?.name || "Zone 2"}</strong>?
          </p>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
            Note: This cycle will be marked as <strong>Stopped</strong>, not completed.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStopConfirmOpen(false)} className="rounded-xl">
              Keep Running
            </Button>
            <Button
              data-testid="confirm-stop-btn"
              onClick={handleManualStop}
              disabled={stopping}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
            >
              {stopping ? "Stopping..." : "Halt Irrigation Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUCCESS MODAL (AUTOMATIC COMPLETION AT 00:00) */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="rounded-3xl max-w-md text-center p-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
            <CheckCircle2 size={32} />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-stone-900 text-center">
              ✓ Irrigation Successful
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 mt-1">
            Irrigation for <strong className="text-stone-900">{lastCompletedSession?.zoneName || "Zone 2"}</strong> has been completed successfully.
          </p>

          <div className="my-4 p-4 rounded-2xl bg-stone-50 border border-stone-200 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Method:</span>
              <strong className="text-stone-900">{lastCompletedSession?.method || selectedMethod}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Duration:</span>
              <strong className="text-blue-700">{lastCompletedSession?.durationMinutes || originalDurationMin} minutes</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Pump & Solenoid Status:</span>
              <span className="font-mono text-stone-700 font-bold">OFF (Valves Closed)</span>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              data-testid="success-modal-ok-btn"
              onClick={handleResetForNewCycle}
              className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-2xl text-sm"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
