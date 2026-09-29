from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VerifyUserRequest(BaseModel):
    face_image: str  # base64


class TwoCameraVerificationRequest(BaseModel):
    camera_left_frame: str
    camera_right_frame: Optional[str] = None


class PersonVerificationResult(BaseModel):
    face_detected: bool
    match_found: bool
    authorized: bool
    confidence: Optional[float] = None
    id_number: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    license_status: Optional[str] = None
    license_expiry_days: Optional[int] = None
    detected_at: Optional[str] = None 
    reason: Optional[str] = None


class TwoCameraVerificationResponse(BaseModel):
    request_id: str
    timestamp: datetime
    overall_authorized: bool  
    person_left: Optional[PersonVerificationResult]
    person_right: Optional[PersonVerificationResult]
    driver: Optional[PersonVerificationResult]
    helper: Optional[PersonVerificationResult]
    validation_error: Optional[str] = None 
    processing_time_ms: Optional[float] = None


class VerificationHistoryItem(BaseModel):
    request_id: str
    name: str
    status: str
    time: Optional[datetime]
    license_expiry_days: Optional[int]
    license_status: Optional[str]
    role: Optional[str]
    vendor_name: Optional[str]
    aadhar_id: Optional[str]
    match: bool


class VerificationHistoryResponse(BaseModel):
    data: List[VerificationHistoryItem]
    total: int
    limit: int
    skip: int