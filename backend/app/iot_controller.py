"""
AGRiNEX IoT Controller Interface & Simulation Layer
---------------------------------------------------
Decoupled hardware control abstraction for AGRiNEX Smart Irrigation.
Supports realistic demonstration with simulated solenoid valves, relay modules,
and flow sensors, while providing a plug-and-play architecture for real
ESP32 / Arduino / MQTT / Modbus / LoRaWAN field controllers.

Future Integration Note:
To connect physical hardware, implement BaseIoTController (e.g. ESP32MqttController)
and set iot_controller = ESP32MqttController() without altering any UI or database code.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone

class BaseIoTController:
    """Abstract interface defining required IoT operations for Smart Irrigation."""

    def start_irrigation(self, zone_id: str, method: str, duration_minutes: int) -> Dict[str, Any]:
        """Activate pump relay and open the target zone's solenoid valve."""
        raise NotImplementedError

    def stop_irrigation(self, zone_id: Optional[str] = None, event_id: Optional[str] = None, reason: str = "manually_stopped") -> Dict[str, Any]:
        """Deactivate pump relay and close solenoid valve(s)."""
        raise NotImplementedError

    def extend_irrigation(self, event_id: Optional[str], zone_id: Optional[str], added_minutes: int) -> Dict[str, Any]:
        """Extend the active hardware timer for the running valve cycle."""
        raise NotImplementedError

    def get_status(self, zone_id: Optional[str] = None) -> Dict[str, Any]:
        """Query real-time hardware status, relay states, and telemetry."""
        raise NotImplementedError


class MockIoTController(BaseIoTController):
    """
    High-fidelity simulation controller mimicking an ESP32 micro-controller board
    with multi-channel relay modules (pump relay + solenoid valve relays),
    water flow meter sensor, and inline pressure sensor.
    """

    def __init__(self):
        self.pump_status = "OFF"  # "ON" | "OFF"
        self.active_valves: Dict[str, Dict[str, Any]] = {}  # zone_id -> {valve_id, method, started_at, duration_minutes, flow_rate_lpm}
        self.device_id = "ESP32-AGRI-GATEWAY-01"
        self.firmware_version = "v2.4.1-sim"
        self.hardware_mode = "SIMULATED"  # "SIMULATED" | "PRODUCTION_READY"

    def _get_flow_rate_for_method(self, method: str, custom_flow_lpm: Optional[float] = None) -> float:
        """Return realistic water flow rate in Litres Per Minute depending on irrigation method."""
        if custom_flow_lpm is not None and custom_flow_lpm > 0:
            return round(float(custom_flow_lpm), 1)
        clean = (method or "Drip Irrigation").lower()
        if "flood" in clean or "basin" in clean:
            return 85.0  # High-volume open basin flooding
        elif "furrow" in clean:
            return 55.0  # Channelized ridge and furrow flow
        elif "rain gun" in clean or "center pivot" in clean or "pivot" in clean:
            return 60.0  # High pressure rotary rain gun nozzle
        elif "manual" in clean or "hose" in clean:
            return 28.0  # Flexible farm hose delivery
        elif "sprinkler" in clean and "micro" not in clean:
            return 38.5  # High delivery overhead sprayers
        elif "micro" in clean:
            return 18.0  # Micro-sprinklers
        elif "subsurface" in clean:
            return 14.5  # Subsurface precision drip
        elif "custom" in clean or "other" in clean:
            return 30.0  # Custom agricultural delivery default
        return 22.4      # Standard surface drip emitter grid

    def start_irrigation(self, zone_id: str, method: str, duration_minutes: int) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        valve_relay_id = f"VALVE-SOLENOID-{zone_id.upper()}"
        flow_rate = self._get_flow_rate_for_method(method)

        self.pump_status = "ON"
        self.active_valves[zone_id] = {
            "valve_id": valve_relay_id,
            "method": method,
            "started_at": now_utc.isoformat(),
            "duration_minutes": duration_minutes,
            "flow_rate_lpm": flow_rate,
            "pressure_bar": 1.85,
            "state": "OPEN"
        }

        return {
            "status": "success",
            "device_id": self.device_id,
            "pump_status": self.pump_status,
            "pump_relay": "RELAY-PUMP-MAIN (ENERGIZED)",
            "valve_status": "OPEN",
            "valve_id": valve_relay_id,
            "flow_rate_lpm": flow_rate,
            "pressure_bar": 1.85,
            "power_draw_kw": 1.25,
            "hardware_mode": self.hardware_mode,
            "message": f"Pump relay ENERGIZED and Solenoid {valve_relay_id} OPENED for {duration_minutes} minutes."
        }

    def stop_irrigation(self, zone_id: Optional[str] = None, event_id: Optional[str] = None, reason: str = "manually_stopped") -> Dict[str, Any]:
        if zone_id and zone_id in self.active_valves:
            del self.active_valves[zone_id]
        elif not zone_id:
            self.active_valves.clear()

        # If no other valves active, turn main pump off
        if len(self.active_valves) == 0:
            self.pump_status = "OFF"

        return {
            "status": "success",
            "device_id": self.device_id,
            "pump_status": self.pump_status,
            "pump_relay": "RELAY-PUMP-MAIN (DE-ENERGIZED)" if self.pump_status == "OFF" else "RELAY-PUMP-MAIN (ENERGIZED)",
            "valve_status": "CLOSED",
            "active_valves_count": len(self.active_valves),
            "reason": reason,
            "flow_rate_lpm": 0.0 if self.pump_status == "OFF" else 15.0,
            "pressure_bar": 0.0 if self.pump_status == "OFF" else 1.2,
            "hardware_mode": self.hardware_mode,
            "message": f"Irrigation stopped. Pump is {self.pump_status} and target solenoid valve is CLOSED."
        }

    def extend_irrigation(self, event_id: Optional[str], zone_id: Optional[str], added_minutes: int) -> Dict[str, Any]:
        if zone_id and zone_id in self.active_valves:
            self.active_valves[zone_id]["duration_minutes"] += added_minutes
            new_duration = self.active_valves[zone_id]["duration_minutes"]
        else:
            new_duration = added_minutes

        return {
            "status": "success",
            "device_id": self.device_id,
            "pump_status": self.pump_status,
            "added_minutes": added_minutes,
            "new_hardware_timeout_minutes": new_duration,
            "hardware_mode": self.hardware_mode,
            "message": f"Extended active hardware timer by +{added_minutes} minutes."
        }

    def get_status(self, zone_id: Optional[str] = None) -> Dict[str, Any]:
        is_zone_active = zone_id in self.active_valves if zone_id else (len(self.active_valves) > 0)
        valve_info = self.active_valves.get(zone_id) if zone_id else None

        flow = valve_info["flow_rate_lpm"] if valve_info else (22.4 if self.pump_status == "ON" else 0.0)
        pressure = valve_info["pressure_bar"] if valve_info else (1.85 if self.pump_status == "ON" else 0.0)

        return {
            "device_id": self.device_id,
            "firmware_version": self.firmware_version,
            "connection_status": "CONNECTED",
            "hardware_mode": self.hardware_mode,
            "pump_status": self.pump_status,
            "pump_relay": "RELAY-PUMP-MAIN (" + ("ENERGIZED" if self.pump_status == "ON" else "DE-ENERGIZED") + ")",
            "valve_status": "OPEN" if is_zone_active else "CLOSED",
            "active_valves": self.active_valves,
            "flow_rate_lpm": flow,
            "pressure_bar": pressure,
            "voltage_v": 230.2,
            "current_a": 5.4 if self.pump_status == "ON" else 0.1,
            "power_draw_kw": 1.25 if self.pump_status == "ON" else 0.02
        }


# Singleton service instance used across AGRiNEX API
iot_controller = MockIoTController()
