from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    language: Optional[str] = "en"

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class ZoneBase(BaseModel):
    name: str
    crop: Optional[str] = None
    soil_type: Optional[str] = None
    area: Optional[float] = None
    area_unit: Optional[str] = "acre"

class ZoneCreate(ZoneBase):
    pass

class AnalysisResponse(BaseModel):
    id: str
    type: str
    result: str
    farm_id: Optional[str] = None
    user_id: Optional[str] = None
    zone_id: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ZoneResponse(ZoneBase):
    id: str
    farm_id: Optional[str] = "demo-farm"
    status: str
    last_moisture: Optional[float] = 45.0
    created_at: Optional[datetime] = None
    analyses: List[AnalysisResponse] = []
    class Config:
        from_attributes = True

class FarmBase(BaseModel):
    name: str
    location: Optional[str] = None
    area: Optional[float] = None
    area_unit: Optional[str] = "acre"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    water_availability: Optional[str] = None
    irrigation_method: Optional[str] = None
    farming_type: Optional[str] = None
    is_demo: Optional[bool] = False

class FarmCreate(FarmBase):
    pass

class FarmUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[float] = None
    area_unit: Optional[str] = "acre"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    water_availability: Optional[str] = None
    irrigation_method: Optional[str] = None
    farming_type: Optional[str] = None

class FarmResponse(FarmBase):
    id: str
    owner_id: str
    created_at: datetime
    zones: List[ZoneResponse] = []
    class Config:
        from_attributes = True

class ImageAnalysisRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    analysis_type: str # soil, plant, production
    zone_id: Optional[str] = None
    farm_id: Optional[str] = None
    language: Optional[str] = "en"

class CropRecommendRequest(BaseModel):
    farm_id: Optional[str] = None
    language: Optional[str] = "en"

class WhatIfRequest(BaseModel):
    farm_id: Optional[str] = None
    scenario: str
    language: Optional[str] = "en"

class WhatIfRecommendation(BaseModel):
    id: str
    category: str  # irrigation, weather, crop, water, soil
    icon: str
    title: str
    reason: str
    data_used: str
    scenario_type: str
    default_params: Dict[str, Any] = {}

class WhatIfParseRequest(BaseModel):
    message: str
    farm_id: Optional[str] = None
    zone_id: Optional[str] = None
    language: Optional[str] = "en"

class WhatIfParseResponse(BaseModel):
    intent: str
    parameter: str
    change_value: Optional[float] = None
    duration_days: Optional[int] = 3
    affected_area: Optional[str] = "whole_farm"
    scenario_type: str
    needs_clarification: bool = False
    prompt_question: Optional[str] = None
    options: Optional[List[str]] = None
    required_data: List[str] = []

class WhatIfSimulateRequest(BaseModel):
    farm_id: Optional[str] = None
    zone_id: Optional[str] = None
    scenario_type: str
    params: Dict[str, Any] = {}
    language: Optional[str] = "en"
    question_text: Optional[str] = None

class WhatIfSimulateResponse(BaseModel):
    scenario_title: str
    scenario_description: str
    status: str = "success"
    missing_data_message: Optional[str] = None
    baseline: Dict[str, Any]
    simulated: Dict[str, Any]
    difference: Dict[str, Any]
    narrative_explanation: str
    actionable_mitigation: List[str] = []
    data_status_labels: Dict[str, str] = {}
    timestamp: str

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    text: str

class AskRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    language: Optional[str] = "en"
    farm_id: Optional[str] = None
    voice_mode: Optional[bool] = False

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    language: Optional[str] = "en"
    api_key_override: Optional[str] = None

class VoiceInfo(BaseModel):
    id: str
    name: str
    description: str

class VoiceConfigResponse(BaseModel):
    elevenlabs_configured: bool
    gemini_configured: bool
    default_voice_id: str
    available_voices: List[VoiceInfo]

class IrrigationStartRequest(BaseModel):
    zone_id: str
    duration_minutes: int = 15
    confirmed: bool = True
    irrigation_method: Optional[str] = "Drip Irrigation"
    secondary_irrigation_method: Optional[str] = None
    custom_method_name: Optional[str] = None
    soil_condition: Optional[str] = None

class IrrigationStopRequest(BaseModel):
    zone_id: Optional[str] = None
    event_id: Optional[str] = None
    reason: Optional[str] = "manually_stopped"

class IrrigationRecommendRequest(BaseModel):
    zone_id: str
    irrigation_method: Optional[str] = "Drip Irrigation"
    secondary_irrigation_method: Optional[str] = None
    custom_method_name: Optional[str] = None
    custom_efficiency_pct: Optional[float] = None
    custom_flow_rate_lpm: Optional[float] = None
    season: Optional[str] = None
    soil_moisture_override: Optional[float] = None
    farm_id: Optional[str] = None

class IrrigationExtendRequest(BaseModel):
    event_id: Optional[str] = None
    zone_id: Optional[str] = None
    added_minutes: int

class ProductionCreateRequest(BaseModel):
    zone_id: Optional[str] = None
    crop: str
    quantity: float
    unit: str = "kg"
    quality: Optional[str] = None
    notes: Optional[str] = None

class DeviceCreateRequest(BaseModel):
    name: str
    device_type: str = "soil_moisture"

class BuyerEnquiryCreate(BaseModel):
    crop: str
    buyer_name: str
    buyer_type: Optional[str] = None
    offered_price: Optional[float] = None
    quantity_kg: Optional[float] = None
    grade: Optional[str] = "Grade A"
    dispatch_date: Optional[str] = None
    farmer_phone: Optional[str] = None
    notes: Optional[str] = None
    farm_id: Optional[str] = None

class BuyerEnquiryResponse(BaseModel):
    id: str
    crop: str
    buyer_name: str
    buyer_type: Optional[str] = None
    offered_price: Optional[float] = None
    quantity_kg: Optional[float] = None
    grade: Optional[str] = None
    dispatch_date: Optional[str] = None
    farmer_phone: Optional[str] = None
    notes: Optional[str] = None
    status: str
    tracking_code: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Production AI Assistant Schemas
class AIChatMessageInput(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    farm_id: Optional[str] = None
    language: Optional[str] = "en"
    page_context: Optional[Dict[str, Any]] = None
    attachment: Optional[Dict[str, Any]] = None
    history: Optional[List[AIChatMessageInput]] = []
    voice_mode: Optional[bool] = False

class AIChatResponse(BaseModel):
    conversation_id: str
    reply: str
    answer: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    citations: Optional[List[Dict[str, Any]]] = None
    confirmation_required: Optional[Dict[str, Any]] = None
    suggested_questions: Optional[List[str]] = None

class ActionConfirmRequest(BaseModel):
    action_token: str
    confirmed: bool

class ActionConfirmResponse(BaseModel):
    success: bool
    message: str
    result: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    tool_calls: Optional[Any] = None
    metadata_json: Optional[Any] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    title: str
    farm_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: Optional[List[ChatMessageResponse]] = []
    class Config:
        from_attributes = True

