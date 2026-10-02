import { api } from "./api";

export type IrrigationMethod =
  | "Drip Irrigation"
  | "Sprinkler Irrigation"
  | "Subsurface Drip"
  | "Micro-Sprinkler"
  | "Furrow Irrigation"
  | "Flood / Basin Irrigation"
  | "Rain Gun / Center Pivot"
  | "Manual / Hose Pipe"
  | "Other (Custom)";

export type IrrigationSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "MANUALLY_STOPPED";

export interface IrrigationMethodOption {
  id: IrrigationMethod;
  name: string;
  description: string;
  efficiency: number;
  waterSavings: string;
  idealFor: string;
  icon: string;
}

export const IRRIGATION_METHODS: IrrigationMethodOption[] = [
  {
    id: "Drip Irrigation",
    name: "Drip Irrigation",
    description: "Targeted low-pressure emitters delivering water straight to the active crop root zone.",
    efficiency: 90,
    waterSavings: "Up to 50% vs flood",
    idealFor: "Row crops, vegetables (Tomato, Chilli), orchards",
    icon: "💧",
  },
  {
    id: "Sprinkler Irrigation",
    name: "Sprinkler Irrigation",
    description: "Overhead pressurized nozzles simulating uniform rainfall over broad coverage areas.",
    efficiency: 75,
    waterSavings: "Up to 30% vs flood",
    idealFor: "Dense cereals, groundnut, pulses, turf",
    icon: "🌧️",
  },
  {
    id: "Subsurface Drip",
    name: "Subsurface Drip",
    description: "Buried drip tubes applying moisture directly beneath the topsoil layer without surface evaporation.",
    efficiency: 95,
    waterSavings: "Up to 60% vs flood",
    idealFor: "Perennial orchards, sugarcane, high-value horticulture",
    icon: "🌱",
  },
  {
    id: "Micro-Sprinkler",
    name: "Micro-Sprinkler",
    description: "Low-trajectory, fine-droplet micro sprayers providing microclimate cooling and gentle ground infiltration.",
    efficiency: 82,
    waterSavings: "Up to 40% vs flood",
    idealFor: "Seedlings, nurseries, spice groves, floriculture",
    icon: "💦",
  },
  {
    id: "Furrow Irrigation",
    name: "Furrow Irrigation",
    description: "Water routed through parallel field trenches/channels between crop ridges.",
    efficiency: 65,
    waterSavings: "Up to 20% vs flood",
    idealFor: "Ridge crops (Maize, Cotton, Potato, Sugarcane)",
    icon: "〰️",
  },
  {
    id: "Flood / Basin Irrigation",
    name: "Flood / Basin Irrigation",
    description: "Traditional surface gravity flooding across bunded field beds or tree basins.",
    efficiency: 55,
    waterSavings: "Baseline (Traditional)",
    idealFor: "Paddy, wetland pastures, flood-tolerant cereals",
    icon: "🌊",
  },
  {
    id: "Rain Gun / Center Pivot",
    name: "Rain Gun / Center Pivot",
    description: "High-pressure 360-degree rotating cannon delivering high-volume precipitation across large plots.",
    efficiency: 80,
    waterSavings: "Up to 35% vs flood",
    idealFor: "Sugarcane, fodder, large open fields, undulating terrain",
    icon: "🎯",
  },
  {
    id: "Manual / Hose Pipe",
    name: "Manual / Hose Pipe",
    description: "Direct targeted flexible hose irrigation managed manually by farm labor.",
    efficiency: 60,
    waterSavings: "Up to 15% vs flood",
    idealFor: "Kitchen gardens, seedlings, small border patches",
    icon: "🚿",
  },
  {
    id: "Other (Custom)",
    name: "Other (Custom Method)",
    description: "Farmer-defined custom system (Pitcher/Matka, Bamboo Drip, Solar Bubble Drip, or custom pipe system).",
    efficiency: 80,
    waterSavings: "Custom efficiency",
    idealFor: "Indigenous, solar, or farm-specific irrigation installations",
    icon: "⚙️",
  },
];

export interface IrrigationFactor {
  name: string;
  value: string;
  detail: string;
}

export interface MethodComparisonItem {
  method_name: string;
  icon: string;
  efficiency_pct: number;
  flow_rate_lpm: number;
  duration_minutes: number;
  duration_formatted: string;
  gross_water_litres: number;
  water_savings_vs_flood: string;
  is_selected: boolean;
}

export interface IrrigationRecommendation {
  zone_id: string;
  zone_name: string;
  crop: string;
  soil_type: string;
  area_acres?: number;
  area_sqm?: number;
  season?: string;
  seasonal_et0_mm_day?: number;
  current_moisture_pct: number;
  target_moisture_pct: number;
  moisture_deficit_pct: number;
  net_irrigation_requirement_mm?: number;
  net_water_litres?: number;
  gross_water_litres?: number;
  irrigation_method: string;
  method_efficiency_pct: number;
  system_flow_rate_lpm?: number;
  recommended_duration_minutes: number;
  recommended_duration_formatted?: string;
  optimal_timing?: {
    recommended_window: string;
    avoid_window: string;
    explanation: string;
  };
  next_irrigation_days?: number;
  energy_estimate?: {
    power_draw_kw: number;
    energy_kwh: number;
    estimated_cost_inr: number;
  };
  secondary_method?: {
    method_name: string;
    icon: string;
    efficiency_pct: number;
    recommended_duration_minutes: number;
    gross_water_litres: number;
    dual_application_advice: string;
  } | null;
  methods_comparison?: MethodComparisonItem[];
  soil_condition: string;
  factors: IrrigationFactor[];
  explanation: string;
}

export interface MockIoTTelemetry {
  device_id: string;
  firmware_version: string;
  connection_status: string;
  hardware_mode: string;
  pump_status: "ON" | "OFF";
  pump_relay: string;
  valve_status: "OPEN" | "CLOSED";
  flow_rate_lpm: number;
  pressure_bar: number;
  power_draw_kw: number;
  voltage_v?: number;
  current_a?: number;
  active_valves?: Record<string, any>;
  message?: string;
}

export interface ActiveIrrigationSession {
  id?: string;
  zone_id: string;
  zone_name: string;
  crop: string;
  soil_type: string;
  irrigation_method: IrrigationMethod | string;
  recommended_duration_minutes: number;
  original_duration_minutes: number;
  current_duration_minutes: number;
  added_minutes: number;
  remaining_seconds: number;
  elapsed_seconds: number;
  state: IrrigationSessionState;
  soil_condition?: string;
  started_at?: string;
  completed_at?: string;
  mock_iot?: MockIoTTelemetry;
}

export interface IrrigationHistoryItem {
  id: string;
  zone_id: string;
  zone_name?: string;
  duration_minutes: number;
  original_duration_minutes?: number;
  added_minutes?: number;
  irrigation_method?: string;
  soil_condition?: string;
  state: string;
  confirmed?: boolean;
  created_at: string;
  completed_at?: string;
}

/**
 * Client-side calculation fallback guaranteeing instant response
 * if offline or during network latency.
 */
export function calculateClientRecommendation(
  zone: any,
  method: IrrigationMethod | string = "Drip Irrigation",
  options?: {
    secondary_method?: string;
    custom_method_name?: string;
    custom_efficiency_pct?: number;
    custom_flow_rate_lpm?: number;
    season?: string;
    soil_moisture_override?: number;
  }
): IrrigationRecommendation {
  const zoneId = zone?.id || "demo-z2";
  const zoneName = zone?.name || "Zone 2";
  const crop = (zone?.crop || "Chilli").trim();
  const soilType = (zone?.soil_type || "Sandy loam").trim();
  const area = parseFloat(zone?.area ?? 1.5) || 1.5;
  const currentMoisture = options?.soil_moisture_override !== undefined
    ? Number(options.soil_moisture_override)
    : parseFloat(zone?.last_moisture ?? 32.1);

  const cropLower = crop.toLowerCase();
  let kc = 1.0;
  let targetMoisture = 58.0;
  let rootDepthCm = 50;

  if (cropLower.includes("tomato")) {
    kc = 1.05;
    targetMoisture = 60.0;
    rootDepthCm = 60;
  } else if (cropLower.includes("chilli") || cropLower.includes("pepper")) {
    kc = 0.95;
    targetMoisture = 60.0;
    rootDepthCm = 50;
  } else if (cropLower.includes("ragi") || cropLower.includes("millet")) {
    kc = 0.8;
    targetMoisture = 52.0;
    rootDepthCm = 40;
  } else if (cropLower.includes("mango") || cropLower.includes("orchard")) {
    kc = 0.75;
    targetMoisture = 50.0;
    rootDepthCm = 120;
  } else if (cropLower.includes("onion") || cropLower.includes("garlic")) {
    kc = 1.0;
    targetMoisture = 55.0;
    rootDepthCm = 35;
  } else if (cropLower.includes("potato")) {
    kc = 1.1;
    targetMoisture = 62.0;
    rootDepthCm = 50;
  }

  const deficit = Math.max(2.0, targetMoisture - currentMoisture);

  const soilLower = soilType.toLowerCase();
  let soilFactor = 1.0;
  let soilRetention = "110 - 130 mm/m (Moderate)";
  let infiltrationDesc = "High infiltration rate; low pooling risk";

  if (soilLower.includes("sandy")) {
    soilFactor = 1.0;
    soilRetention = "110 - 130 mm/m (Moderate, free-draining)";
    infiltrationDesc = "High infiltration rate; low surface pooling risk";
  } else if (soilLower.includes("clay") || soilLower.includes("black")) {
    soilFactor = 1.2;
    soilRetention = "180 - 220 mm/m (High, slow draining)";
    infiltrationDesc = "Slow infiltration rate; requires pulsed cycle";
  } else if (soilLower.includes("alluvial") || soilLower.includes("loam")) {
    soilFactor = 1.05;
    soilRetention = "140 - 160 mm/m (Good moisture retention)";
    infiltrationDesc = "Balanced infiltration and permeability";
  }

  // Season
  const season = options?.season || "Summer (Zaid)";
  let et0 = 7.2;
  let timingWindow = "05:30 AM – 08:30 AM (Early Morning) or 05:30 PM – 07:30 PM (Evening)";
  let avoidWindow = "11:00 AM – 04:00 PM (High Solar Evaporative Loss)";
  let timingAdvice = "During hot summer weather, early morning watering reduces evaporative losses by 25-35%.";

  if (season.toLowerCase().includes("monsoon") || season.toLowerCase().includes("kharif")) {
    et0 = 4.2;
    timingWindow = "06:00 AM – 09:00 AM (Early Morning)";
    avoidWindow = "Prior to incoming rainfall";
    timingAdvice = "Humid weather lowers evaporation; irrigate early morning if rain is not forecast.";
  } else if (season.toLowerCase().includes("winter") || season.toLowerCase().includes("rabi")) {
    et0 = 3.2;
    timingWindow = "08:30 AM – 11:30 AM (Mid-Morning)";
    avoidWindow = "Late evening or dawn below 12°C";
    timingAdvice = "Mid-morning watering prevents cold thermal shock to root tips.";
  }

  // Method specs
  let effPct = 90;
  let deliveryRate = 1.77;
  let systemLpm = 22.4;
  let cleanMethod = method;

  if (method === "Sprinkler Irrigation") {
    effPct = 75;
    deliveryRate = 1.3;
    systemLpm = 38.5;
  } else if (method === "Subsurface Drip") {
    effPct = 95;
    deliveryRate = 2.1;
    systemLpm = 14.5;
  } else if (method === "Micro-Sprinkler") {
    effPct = 82;
    deliveryRate = 1.55;
    systemLpm = 18.0;
  } else if (method === "Furrow Irrigation") {
    effPct = 65;
    deliveryRate = 1.15;
    systemLpm = 55.0;
  } else if (method === "Flood / Basin Irrigation") {
    effPct = 55;
    deliveryRate = 0.95;
    systemLpm = 85.0;
  } else if (method === "Rain Gun / Center Pivot") {
    effPct = 80;
    deliveryRate = 1.45;
    systemLpm = 60.0;
  } else if (method === "Manual / Hose Pipe") {
    effPct = 60;
    deliveryRate = 1.05;
    systemLpm = 28.0;
  } else if (method.includes("Other") || method.includes("Custom")) {
    cleanMethod = options?.custom_method_name || "Custom Irrigation Method";
    effPct = options?.custom_efficiency_pct || 80;
    systemLpm = options?.custom_flow_rate_lpm || 30.0;
    deliveryRate = Number((1.0 + (effPct / 100) * 0.9).toFixed(2));
  }

  const areaFactor = Math.pow(area / 1.5, 0.35);
  const rawCalc = (deficit * soilFactor * kc * 1.0 * areaFactor) / deliveryRate;
  const recommendedMin = Math.max(5, Math.min(180, Math.round(rawCalc)));

  const areaSqm = Math.round(area * 4046.86);
  const nirMm = Math.max(3.0, Math.min(35.0, Number(((deficit / 100) * (rootDepthCm * 10) * 0.12 * soilFactor * kc).toFixed(1))));
  const netWaterLitres = Math.round(nirMm * areaSqm);
  const grossWaterLitres = Math.round(netWaterLitres / (effPct / 100));

  const soilCondition = `${soilType} with ${currentMoisture.toFixed(1)}% moisture (${soilRetention}). Target field capacity is ${targetMoisture.toFixed(0)}% across ${area} acres (${areaSqm.toLocaleString()} m²).`;

  const explanation = `Based on ${currentMoisture.toFixed(1)}% soil moisture in ${zoneName} (${area} acres of ${crop}), a moisture deficit of ${deficit.toFixed(1)}% requires replenishment. Under ${season} climate (ET₀ ${et0} mm/day, Kc ${kc.toFixed(2)}), running ${cleanMethod} (${effPct}% efficiency) for ${recommendedMin} minutes will deliver ${grossWaterLitres.toLocaleString()} Litres of water. Optimal timing is ${timingWindow}.`;

  const factors: IrrigationFactor[] = [
    {
      name: "Soil Moisture Deficit",
      value: `${deficit.toFixed(1)}%`,
      detail: `Current: ${currentMoisture.toFixed(1)}% • Field Capacity: ${targetMoisture.toFixed(0)}%`,
    },
    {
      name: "Crop Water Demand (Kc)",
      value: `${crop} (Kc ${kc.toFixed(2)})`,
      detail: `Root depth: ${rootDepthCm} cm • Transpiration requirement`,
    },
    {
      name: "Season & Climate (ET₀)",
      value: `${season} (ET₀ ${et0} mm/d)`,
      detail: timingAdvice,
    },
    {
      name: "Zone Field Area",
      value: `${area} acres (${areaSqm.toLocaleString()} m²)`,
      detail: `Gross water volume: ${grossWaterLitres.toLocaleString()} L`,
    },
    {
      name: "Irrigation Method Efficiency",
      value: `${effPct}% (${cleanMethod})`,
      detail: `Discharge rate: ${systemLpm} L/min`,
    },
    {
      name: "Optimal Timing Window",
      value: timingWindow,
      detail: `Avoid: ${avoidWindow}`,
    },
  ];

  return {
    zone_id: zoneId,
    zone_name: zoneName,
    crop,
    soil_type: soilType,
    area_acres: area,
    area_sqm: areaSqm,
    season,
    seasonal_et0_mm_day: et0,
    current_moisture_pct: Math.round(currentMoisture * 10) / 10,
    target_moisture_pct: targetMoisture,
    moisture_deficit_pct: Math.round(deficit * 10) / 10,
    net_irrigation_requirement_mm: nirMm,
    net_water_litres: netWaterLitres,
    gross_water_litres: grossWaterLitres,
    irrigation_method: cleanMethod,
    method_efficiency_pct: effPct,
    system_flow_rate_lpm: systemLpm,
    recommended_duration_minutes: recommendedMin,
    recommended_duration_formatted: recommendedMin >= 60 ? `${Math.floor(recommendedMin / 60)}h ${recommendedMin % 60}m` : `${recommendedMin} minutes`,
    optimal_timing: {
      recommended_window: timingWindow,
      avoid_window: avoidWindow,
      explanation: timingAdvice,
    },
    next_irrigation_days: Math.max(1, Math.min(10, Math.round(nirMm / Math.max(1.5, et0 * kc)))),
    energy_estimate: {
      power_draw_kw: 3.75,
      energy_kwh: Number(((3.75 * recommendedMin) / 60).toFixed(2)),
      estimated_cost_inr: Number((((3.75 * recommendedMin) / 60) * 3.5).toFixed(1)),
    },
    soil_condition: soilCondition,
    factors,
    explanation,
  };
}

/**
 * Irrigation Service interacting with the Backend API and Mock IoT Controller layer.
 */
export const irrigationService = {
  /**
   * Request an intelligent irrigation duration recommendation based on zone soil analysis.
   */
  async getRecommendation(
    zone: any,
    method: IrrigationMethod | string,
    farmId?: string,
    options?: {
      secondary_method?: string;
      custom_method_name?: string;
      custom_efficiency_pct?: number;
      custom_flow_rate_lpm?: number;
      season?: string;
      soil_moisture_override?: number;
    }
  ): Promise<IrrigationRecommendation> {
    try {
      const res = await api.post("/irrigation/recommend", {
        zone_id: zone.id,
        irrigation_method: method,
        secondary_irrigation_method: options?.secondary_method,
        custom_method_name: options?.custom_method_name,
        custom_efficiency_pct: options?.custom_efficiency_pct,
        custom_flow_rate_lpm: options?.custom_flow_rate_lpm,
        season: options?.season,
        soil_moisture_override: options?.soil_moisture_override,
        farm_id: farmId,
      });
      return res.data;
    } catch (err) {
      console.warn("API recommendation call failed, using client model calculation:", err);
      return calculateClientRecommendation(zone, method, options);
    }
  },

  /**
   * Start an active irrigation cycle. Turns mock IoT controller ON.
   */
  async startIrrigation(
    zoneId: string,
    method: IrrigationMethod | string,
    durationMinutes: number,
    soilCondition?: string,
    customMethodName?: string,
    secondaryMethod?: string
  ): Promise<{ status: string; event_id: string; mock_iot: MockIoTTelemetry; message: string }> {
    const res = await api.post("/irrigation/start", {
      zone_id: zoneId,
      duration_minutes: durationMinutes,
      irrigation_method: method,
      custom_method_name: customMethodName,
      secondary_irrigation_method: secondaryMethod,
      soil_condition: soilCondition,
      confirmed: true,
    });
    return res.data;
  },

  /**
   * Stop irrigation manually or upon automatic countdown expiry. Turns mock IoT controller OFF.
   */
  async stopIrrigation(
    zoneId?: string,
    eventId?: string,
    isManual: boolean = true
  ): Promise<{ status: string; stopped_count: number; session_state: string; mock_iot: MockIoTTelemetry; message: string }> {
    const res = await api.post("/irrigation/stop", {
      zone_id: zoneId,
      event_id: eventId,
      reason: isManual ? "manually_stopped" : "completed",
    });
    return res.data;
  },

  /**
   * Manually extend running irrigation duration.
   * Crucial: Adds the duration to the current remaining time.
   */
  async extendIrrigation(
    addedMinutes: number,
    eventId?: string,
    zoneId?: string
  ): Promise<{ status: string; added_minutes: number; total_added_minutes: number; new_duration_minutes: number; mock_iot: MockIoTTelemetry; message: string }> {
    const res = await api.post("/irrigation/extend", {
      added_minutes: addedMinutes,
      event_id: eventId,
      zone_id: zoneId,
    });
    return res.data;
  },

  /**
   * Query the live hardware/mock IoT telemetry and running irrigation state.
   */
  async getStatus(zoneId?: string): Promise<{ status: string; mock_iot: MockIoTTelemetry; active_sessions: any[]; is_running: boolean }> {
    const res = await api.get(`/irrigation/status${zoneId ? `?zone_id=${zoneId}` : ""}`);
    return res.data;
  },

  /**
   * Retrieve historical irrigation cycle records.
   */
  async getHistory(): Promise<IrrigationHistoryItem[]> {
    const res = await api.get("/irrigation/history");
    return res.data || [];
  },
};
