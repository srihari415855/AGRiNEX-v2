"use client";
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, fileToBase64 } from "@/lib/api";
import { useApp } from "@/lib/AppContext";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Clock,
  Trash2,
  CheckCircle2,
  History,
  MapPin,
  Volume2,
  Square,
  Sparkles,
  Cpu,
  ShieldCheck,
  Droplets,
  Activity,
  MessageSquare,
  FlaskConical,
  Sprout,
  X,
  RefreshCw,
  AlertCircle,
  SwitchCamera
} from "lucide-react";
import { useSearchParams, useNavigate } from "@/lib/navigation";
import { speakText, stopAllPlayback } from "@/lib/voice";

export default function ImageAnalyzerView({
  type,
}: {
  type: "soil" | "plant" | "production";
}) {
  const { lang, activeFarm, farms } = useApp();
  const nav = useNavigate();
  const currentFarm = farms?.find((f: any) => f.id === activeFarm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [clockTime, setClockTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"report" | "ml" | "treatment">("report");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    const lat = currentFarm?.latitude ?? 13.1373;
    const lon = currentFarm?.longitude ?? 78.1298;
    api
      .get(`/weather?lat=${lat}&lon=${lon}`)
      .then((res) => setWeather(res.data?.data || res.data))
      .catch(() => {});
  }, [currentFarm?.latitude, currentFarm?.longitude]);

  // Live Camera Capture States
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileFallbackRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setClockTime(new Date());
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      stopAllPlayback();
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  const parseToDate = (rawDate?: string): Date => {
    if (!rawDate) return new Date();
    let s = String(rawDate).trim();
    if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) {
      s += "Z";
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const formatExactISTTime = (rawDate?: string, fallbackTime?: string) => {
    if (fallbackTime && /^\d{2}:\d{2}:\d{2}\s+(AM|PM)$/i.test(fallbackTime.trim())) {
      return fallbackTime.trim();
    }
    const d = parseToDate(rawDate);
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatExactISTDate = (rawDate?: string, fallbackDate?: string) => {
    if (fallbackDate && fallbackDate.length > 5) {
      return fallbackDate.trim();
    }
    const d = parseToDate(rawDate);
    return d.toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const [params] = useSearchParams();
  const zoneId = params.get("zone");

  const fetchHistory = () => {
    setLoadingHistory(true);
    const farmParam = activeFarm ? `farm_id=${activeFarm}&` : "";
    api
      .get(`/analyses?${farmParam}type=${type}`)
      .then((res) => {
        setSavedAnalyses(res.data || []);
      })
      .catch((err) => console.error("Failed to load past analyses", err))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [activeFarm, type]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    stopSpeaking();
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setCameraLoading(true);
    setCameraError(null);
    setIsCameraModalOpen(true);
    setCameraFacing(facing);

    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Live camera is not supported in this browser. You can select an image file instead.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      let msg = "Camera access denied or unavailable. Please grant camera permission in your browser.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Please allow camera permissions in your browser.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No camera found on this device. You can upload an existing photo instead.";
      }
      setCameraError(msg);
      toast.error(msg);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to capture image snapshot");
          return;
        }
        const capturedFile = new File([blob], `${type}-specimen-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onFile(capturedFile);
        stopCamera();
        toast.success("Specimen photo captured successfully!");
      },
      "image/jpeg",
      0.92
    );
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    startCamera(nextFacing);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    stopSpeaking();
    try {
      const { base64, mime } = await fileToBase64(file);
      const r = await api.post("/analyze/image", {
        image_base64: base64,
        mime_type: mime,
        analysis_type: type,
        zone_id: zoneId || null,
        farm_id: activeFarm || null,
        language: lang,
      });
      setResult(r.data);
      toast.success("AI & ML Analysis complete & saved to farm history");
      fetchHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSpeech = () => {
    if (!result?.result) return;
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setIsSpeaking(true);
      speakText({
        text: result.result,
        language: lang,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  const stopSpeaking = () => {
    stopAllPlayback();
    setIsSpeaking(false);
  };

  const handleDeleteAnalysis = async (id: string) => {
    try {
      await api.delete(`/analyses/${id}`);
      setSavedAnalyses((prev) => prev.filter((item) => item.id !== id));
      if (result?.id === id) {
        setResult(null);
        stopSpeaking();
      }
      toast.success("Analysis record deleted");
    } catch (err: any) {
      toast.error("Failed to delete analysis: " + err.message);
    }
  };

  const titles = {
    soil: t(lang, "soil_analysis"),
    plant: t(lang, "crop_health"),
    production: t(lang, "production"),
  };
  const hints = {
    soil: t(lang, "upload_soil_hint"),
    plant: t(lang, "upload_plant_hint"),
    production: t(lang, "upload_prod_hint"),
  };

  const ml = result?.ml_metrics;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-1 flex items-center gap-2">
            <span>📸 {titles[type]}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Instant Photo Analysis
            </span>
          </h1>
          <p className="text-sm text-stone-600">{hints[type]}</p>
        </div>

        {/* Real-Time Live Farm Synchronized Clock & Location Banner */}
        {clockTime && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-950 text-white shadow-sm flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-emerald-300">
                <Clock size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black font-mono tracking-tight text-white">
                    {clockTime.toLocaleTimeString("en-US", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    IST (UTC+05:30)
                  </span>
                </div>
                <div className="text-xs text-emerald-200/80 font-medium">
                  {clockTime.toLocaleDateString("en-US", {
                    timeZone: "Asia/Kolkata",
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-emerald-200/70">
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin size={13} className="text-emerald-400" />
                {currentFarm?.location || "Karnataka, India"}
              </span>
              <span>•</span>
              <span className="bg-emerald-800/60 px-2 py-0.5 rounded text-[11px] text-emerald-200 font-semibold border border-emerald-700/50">
                ML Feature Engine Ready
              </span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* Left Column: Specimen Upload + Protocol Guidelines + Live Telemetry + Quick Actions */}
          <div className="space-y-4">
            {/* Upload / Camera Specimen Card */}
            <Card className="rounded-2xl border border-stone-200 bg-white shadow-2xs">
              <CardContent className="p-6">
                {preview ? (
                  <div className="relative mb-3">
                    <img
                      src={preview}
                      alt="specimen preview"
                      className="w-full h-64 object-cover rounded-xl border border-stone-200"
                    />
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-[11px] text-white font-mono flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-400" />
                      <span>Specimen Ready for ML Inference</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-64 rounded-xl bg-stone-100 border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-500 mb-3 p-4 text-center">
                    <Camera size={40} className="mb-2 opacity-50 text-emerald-700" />
                    <span className="text-sm font-semibold text-stone-700">No field specimen selected</span>
                    <span className="text-xs text-stone-400 mt-1 max-w-xs">
                      Take or upload a high-resolution photo of {type === "soil" ? "soil tilth" : "foliage or crop leaf"}
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    data-testid={`${type}-camera-btn`}
                    onClick={() => startCamera()}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer transition shadow-2xs"
                  >
                    <Camera size={16} /> {t(lang, "take_photo")}
                  </button>
                  {/* Fallback hidden file input for camera */}
                  <input
                    ref={fileFallbackRef}
                    data-testid={`${type}-camera-input`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <label className="flex-1">
                    <input
                      data-testid={`${type}-upload-input`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onFile(e.target.files?.[0])}
                    />
                    <div className="flex items-center justify-center gap-2 h-11 rounded-lg border border-stone-300 hover:bg-stone-50 text-sm font-semibold cursor-pointer transition shadow-2xs text-stone-800">
                      <Upload size={16} /> {t(lang, "upload_photo")}
                    </div>
                  </label>
                </div>
                <Button
                  data-testid={`${type}-analyze-btn`}
                  disabled={!file || busy}
                  onClick={analyze}
                  className="w-full mt-3 h-11 bg-emerald-700 hover:bg-emerald-800 cursor-pointer disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  {busy ? (
                    <>
                      <Sparkles size={16} className="animate-spin text-emerald-300" />
                      <span>Extracting ML Features & Reasoning with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Cpu size={16} />
                      <span>Run ML & AI Diagnostics</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Live Environmental Field Telemetry & Pathogen Spore Risk */}
            <Card className="rounded-2xl border border-stone-200 bg-white shadow-2xs">
              <CardHeader className="pb-2.5 pt-4 px-5 border-b border-stone-100 flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-stone-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Activity size={15} className="text-emerald-700" />
                  <span>Live Field Telemetry & Microclimate Risk</span>
                </CardTitle>
                <StatusBadge kind="LIVE" />
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <div className="text-[10px] text-stone-500 font-semibold uppercase">Ambient Temp</div>
                    <div className="text-base font-extrabold text-stone-900">
                      {weather?.current?.temperature_2m != null ? `${Math.round(weather.current.temperature_2m)}°C` : "28.5°C"}
                    </div>
                    <div className="text-[9px] text-stone-400">Canopy surface</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <div className="text-[10px] text-stone-500 font-semibold uppercase">Relative Humidity</div>
                    <div className="text-base font-extrabold text-stone-900">
                      {weather?.current?.relative_humidity_2m != null ? `${weather.current.relative_humidity_2m}%` : "74%"}
                    </div>
                    <div className="text-[9px] text-amber-700 font-medium">Blight Spore Risk</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <div className="text-[10px] text-stone-500 font-semibold uppercase">Soil Moisture</div>
                    <div className="text-base font-extrabold text-emerald-700">
                      {currentFarm?.zones?.[0]?.last_moisture != null ? `${currentFarm.zones[0].last_moisture}%` : "62%"}
                    </div>
                    <div className="text-[9px] text-emerald-700 font-medium">Field Capacity</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-700 shrink-0" />
                    <span className="font-semibold">Vision ML Feature Engine</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-300">
                    Gemini 2.5 Flash + CNN
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Scientific Sampling Protocol & Field Best Practices */}
            <Card className="rounded-2xl border border-stone-200 bg-white shadow-2xs">
              <CardHeader className="pb-2 pt-4 px-5 border-b border-stone-100 flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-stone-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <FlaskConical size={15} className="text-teal-700" />
                  <span>{type === "soil" ? "Soil Tilth Sampling Protocol" : "Crop Health Sampling Protocol"}</span>
                </CardTitle>
                <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  ICAR Standards
                </span>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-2.5">
                {type === "soil" ? (
                  <div className="space-y-2 text-stone-600">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                      <span><strong>Root-Zone Core:</strong> Sample at 15cm (6 inches) depth using a clean auger or V-notch shovel cut.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                      <span><strong>Avoid Puddles:</strong> Do not sample waterlogged mud or freshly broadcast synthetic fertilizer lines.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                      <span><strong>Homogeneous Composite:</strong> Mix 3–5 sub-samples across the zone before imaging to ensure representative tilth.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                      <span><strong>Macro Photography:</strong> Ensure daylight illumination without cast shadows across soil crumbs.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-stone-600">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                      <span><strong>Necrotic Margins:</strong> Frame the transition boundary between healthy green lamina and diseased lesions.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                      <span><strong>Diffuse Daylight:</strong> Capture under natural, diffused lighting; avoid harsh solar glare or camera flash flare.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                      <span><strong>3-Tier Canopy Check:</strong> Inspect upper growth flush, mid-canopy leaves, and lower shaded foliage for systemic signs.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                      <span><strong>Abaxial Inspection:</strong> Turn leaf over to inspect underside for fungal spores, powdery mildew, or aphid clusters.</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Farm Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => nav(`/app/ask`)}
                className="h-9 text-xs font-semibold text-emerald-800 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl"
              >
                <MessageSquare size={13} className="text-emerald-700" />
                <span>Ask AI Assistant</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => nav(`/app/irrigation`)}
                className="h-9 text-xs font-semibold text-blue-800 border-blue-200 bg-blue-50/50 hover:bg-blue-100 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl"
              >
                <Droplets size={13} className="text-blue-600" />
                <span>Smart Irrigation</span>
              </Button>
            </div>
          </div>

          {/* Diagnostic & ML Metrics Results Card */}
          <Card className="rounded-2xl border border-stone-200 bg-white shadow-2xs flex flex-col">
            <CardHeader className="flex-row items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu size={18} className="text-emerald-700" />
                  <span>AI & ML Diagnostic Intelligence</span>
                </CardTitle>
              </div>
              {result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSpeech}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      isSpeaking
                        ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    }`}
                    title={isSpeaking ? "Stop Voice Readout" : "Listen to AI Diagnostic aloud"}
                  >
                    {isSpeaking ? (
                      <>
                        <Square size={12} />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={13} />
                        <span>Listen Aloud</span>
                      </>
                    )}
                  </button>
                  <StatusBadge kind="AI_IMAGE_ANALYSIS" />
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-4 sm:p-5">
              {!result && (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
                    <Sparkles size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">Instant Soil & Crop Health Analysis</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      Upload or capture a clear photo of your field soil or plant to receive an immediate diagnostic analysis, laboratory indicators, and treatment steps.
                    </p>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* Telemetry Header */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950 via-stone-900 to-emerald-950 text-white flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-emerald-400" />
                      <span className="font-mono font-bold text-white">
                        {formatExactISTTime(result.created_at, result.time_str)} IST
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-emerald-200">
                        {formatExactISTDate(result.created_at, result.date_str)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 font-medium">{currentFarm?.name || "Namfarm"}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={12} /> Stored in DB
                      </span>
                    </div>
                  </div>

                  {/* Interactive Tab Switcher */}
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
                    <button
                      onClick={() => setActiveTab("report")}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTab === "report"
                          ? "bg-white text-emerald-900 shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <Sparkles size={13} className="text-emerald-600" />
                      <span>Analysis Report</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("ml")}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTab === "ml"
                          ? "bg-white text-emerald-900 shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <Cpu size={13} className="text-teal-600" />
                      <span>Soil & Crop Details</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("treatment")}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTab === "treatment"
                          ? "bg-white text-emerald-900 shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <FlaskConical size={13} className="text-amber-600" />
                      <span>Treatment & Care</span>
                    </button>
                  </div>

                  {/* Tab 1: AI Vision Thorough Report */}
                  {activeTab === "report" && (
                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed max-h-[420px] overflow-y-auto bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                      {result.result.split("\n").map((line: string, i: number) => {
                        const trimmed = line.trim();
                        if (!trimmed) return <div key={i} className="h-1" />;
                        if (/^(\d+\.|\#+|\*\*)[A-Za-z\s&/•]+:?(\*\*)?$/.test(trimmed) && trimmed.length < 65) {
                          return (
                            <div key={i} className="pt-2 font-black text-emerald-950 text-sm border-b border-emerald-200/60 pb-0.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                              <span>{trimmed.replace(/^(\#+|\*+|\d+\.)\s*/, "").replace(/\*+$/, "")}</span>
                            </div>
                          );
                        }
                        if (trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                          const content = trimmed.replace(/^[•\-\*]\s*/, "");
                          const colonIdx = content.indexOf(":");
                          if (colonIdx > 0 && colonIdx < 35) {
                            const label = content.slice(0, colonIdx);
                            const rest = content.slice(colonIdx + 1);
                            return (
                              <div key={i} className="pl-2 flex items-start gap-1.5 text-stone-700">
                                <span className="text-emerald-600 font-bold shrink-0">•</span>
                                <div>
                                  <span className="font-bold text-stone-900">{label}:</span>
                                  <span>{rest}</span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={i} className="pl-2 flex items-start gap-1.5 text-stone-700">
                              <span className="text-emerald-600 font-bold shrink-0">•</span>
                              <span>{content}</span>
                            </div>
                          );
                        }
                        return (
                          <p key={i} className="text-stone-700">
                            {trimmed}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab 2: Machine Learning Feature Analytics */}
                  {activeTab === "ml" && (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {ml ? (
                        <>
                          {/* Soil ML Cards */}
                          {type === "soil" && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                                <span className="text-[10px] uppercase font-bold text-amber-800">Identified Soil Type</span>
                                <div className="text-sm font-black text-amber-950 mt-0.5">{ml.soil_type}</div>
                                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                  {ml.ml_confidence_pct}% Match Confidence
                                </span>
                              </div>

                              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                                <span className="text-[10px] uppercase font-bold text-emerald-800">Estimated Soil pH</span>
                                <div className="text-sm font-black text-emerald-950 mt-0.5">{ml.ph_range}</div>
                                <span className="text-[10px] text-emerald-700 font-medium">Optimal rootzone availability</span>
                              </div>

                              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                                <span className="text-[10px] uppercase font-bold text-teal-800">Organic Carbon (SOC)</span>
                                <div className="text-sm font-black text-teal-950 mt-0.5">{ml.organic_carbon_est_pct}%</div>
                                <span className="text-[10px] text-teal-700 font-medium">Reflectance absorption proxy</span>
                              </div>

                              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                                <span className="text-[10px] uppercase font-bold text-blue-800">Water Retention</span>
                                <div className="text-xs font-bold text-blue-950 mt-0.5">{ml.water_retention_capacity}</div>
                              </div>
                            </div>
                          )}

                          {/* Plant Health ML Cards */}
                          {type === "plant" && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                                <span className="text-[10px] uppercase font-bold text-rose-800">Diagnosed Condition</span>
                                <div className="text-xs font-black text-rose-950 mt-0.5">{ml.primary_pathogen}</div>
                                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                                  {ml.ml_confidence_pct}% Match Confidence
                                </span>
                              </div>

                              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                                <span className="text-[10px] uppercase font-bold text-amber-800">Infection Stage</span>
                                <div className="text-xs font-black text-amber-950 mt-0.5">{ml.severity_stage}</div>
                                <span className="text-[10px] text-amber-700 font-medium">Affected Area: {ml.affected_canopy_percentage}%</span>
                              </div>

                              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                                <span className="text-[10px] uppercase font-bold text-emerald-800">Foliar Vigor Index</span>
                                <div className="text-lg font-black text-emerald-950 mt-0.5">{ml.foliar_vigor_index}/100</div>
                                <div className="w-full bg-emerald-200 h-1.5 rounded-full mt-1 overflow-hidden">
                                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${ml.foliar_vigor_index}%` }} />
                                </div>
                              </div>

                              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
                                <span className="text-[10px] uppercase font-bold text-stone-700">Foliar Symptoms</span>
                                <div className="text-[11px] font-medium text-stone-800 mt-1">
                                  Chlorosis: {ml.chlorosis_ratio_pct}% &bull; Necrosis: {ml.necrotic_ratio_pct}%
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ML Model Version Badge */}
                          <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 flex items-center justify-between">
                            <span className="font-semibold text-stone-800">Analysis Engine:</span>
                            <span className="font-mono text-emerald-800 font-bold">{ml.ml_model_version}</span>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
                          Diagnostic metrics were synthesized into the primary report.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Treatment Protocol & Action Plan */}
                  {activeTab === "treatment" && (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 text-xs">
                      {type === "soil" && ml ? (
                        <>
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                            <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                              <Sprout size={14} className="text-emerald-700" />
                              Organic Soil Amendment Dose
                            </span>
                            <p className="text-stone-700">
                              Apply <strong className="text-emerald-950 font-black">{ml.amendment_fym_tonnes_per_acre} tonnes/acre</strong> of well-rotted Farmyard Manure (FYM) or enriched vermicompost before the next sowing window.
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                            <span className="font-bold text-teal-900 text-xs flex items-center gap-1.5">
                              <FlaskConical size={14} className="text-teal-700" />
                              Basal Chemical & Bio-fertilizer Protocol
                            </span>
                            <p className="text-stone-700 leading-relaxed">
                              {ml.basal_fertilizer_protocol}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                            <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                              <Activity size={14} className="text-amber-700" />
                              Top Recommended Crops for this Soil
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {ml.suitable_crops.map((c: string) => (
                                <span key={c} className="px-2 py-0.5 rounded-md bg-white border border-amber-300 font-semibold text-amber-900 text-[11px]">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : type === "plant" && ml ? (
                        <>
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                            <span className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-rose-700" />
                              Targeted Curative Chemical Spray
                            </span>
                            <p className="text-stone-800 font-medium">
                              {ml.curative_spray}
                            </p>
                            <span className="text-[10px] text-stone-500 block pt-0.5">
                              Spray during clear early morning hours (6:30 - 9:00 AM) using fine hollow-cone nozzle.
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                            <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                              <Sprout size={14} className="text-emerald-700" />
                              Organic & Biological Alternatives
                            </span>
                            <p className="text-stone-800 font-medium">
                              {ml.organic_alternative}
                            </p>
                          </div>

                          {ml.action_steps && (
                            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                              <span className="font-bold text-stone-900 text-xs">Recommended Agronomic Actions:</span>
                              <ul className="space-y-1 pl-1">
                                {ml.action_steps.map((st: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-1.5 text-stone-700 text-[11px]">
                                    <span className="text-emerald-600 font-bold shrink-0">&bull;</span>
                                    <span>{st}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-stone-600">
                          Follow the care protocol outlined in the primary report.
                        </div>
                      )}

                      {/* Interactive Ask Assistant Button */}
                      <button
                        onClick={() => nav(`/app/ask`)}
                        className="w-full mt-2 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition"
                      >
                        <MessageSquare size={14} />
                        <span>Ask Farm Assistant about this report</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saved Diagnostic History */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <History size={18} className="text-emerald-700" />
              <span>Saved {titles[type]} History ({savedAnalyses.length})</span>
            </h2>
            <span className="text-xs text-stone-500">
              Preserved in database &bull; Included in Consolidated Master Report
            </span>
          </div>

          {savedAnalyses.length === 0 ? (
            <Card className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
              No saved {titles[type].toLowerCase()} records yet for this farm. Upload and analyze an image above to save your first evaluation.
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {savedAnalyses.map((item) => (
                <Card
                  key={item.id}
                  className="rounded-xl border border-stone-200 bg-white p-4 hover:border-emerald-300 transition shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Log #{item.id.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-stone-700 font-semibold flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                        <Clock size={12} className="text-emerald-600" />
                        <span className="font-mono font-bold text-stone-900">{formatExactISTTime(item.created_at, item.time_str)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          IST (UTC+05:30)
                        </span>
                        <span className="text-stone-400">•</span>
                        <span className="text-stone-600">{formatExactISTDate(item.created_at, item.date_str)}</span>
                      </span>
                      <button
                        onClick={() => handleDeleteAnalysis(item.id)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-stone-700 whitespace-pre-wrap line-clamp-4 bg-stone-50 p-2.5 rounded-lg font-mono">
                    {item.result}
                  </div>
                  <button
                    onClick={() => {
                      setResult(item);
                      stopSpeaking();
                    }}
                    className="mt-2 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>View Diagnostic Details</span>
                    <span>&rarr;</span>
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Camera Scanner Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-700 text-white flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-stone-950/80">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Camera size={18} />
                </span>
                <span className="font-bold text-sm text-stone-100">
                  Live {type === "soil" ? "Soil Tilth" : "Crop Leaf"} Camera
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
                  title="Switch Camera (Front/Back)"
                >
                  <SwitchCamera size={16} />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Camera Viewport */}
            <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-900/90 z-10 text-stone-300">
                  <RefreshCw size={28} className="animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Starting camera stream...</span>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center space-y-3 z-10">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-xs text-stone-300 max-w-xs mx-auto leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => startCamera()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl"
                    >
                      Retry Camera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        stopCamera();
                        fileFallbackRef.current?.click();
                      }}
                      className="border-stone-700 text-stone-300 hover:bg-stone-800 text-xs font-bold rounded-xl"
                    >
                      Choose from Gallery
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Targeting Reticle */}
                  <div className="absolute inset-8 border-2 border-emerald-400/50 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between">
                      <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                      <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                    </div>
                    <div className="text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-emerald-300 text-[10px] font-mono tracking-wider">
                        ALIGN SPECIMEN IN FRAME
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                      <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                    </div>
                  </div>
                </>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Modal Controls Footer */}
            <div className="p-4 bg-stone-950 flex items-center justify-between border-t border-stone-800">
              <span className="text-[11px] text-stone-400">
                Mode: <strong className="text-stone-200 capitalize">{cameraFacing === "environment" ? "Back Camera" : "Front Camera"}</strong>
              </span>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={stopCamera}
                  className="text-stone-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  data-testid="camera-snap-btn"
                  disabled={!cameraStream || Boolean(cameraError)}
                  onClick={capturePhoto}
                  className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  <Camera size={16} />
                  <span>Snap Specimen</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
