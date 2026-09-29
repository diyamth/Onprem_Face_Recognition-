from pydantic import BaseModel, field_validator
from typing import Optional

class RegisterUserRequest(BaseModel):
    name: str
    id_type: str  # EMPLOYEE_ID | DRIVING_LICENSE
    id_number: str
    license_expiry: Optional[str] = None
    vendor_name: str
    aadhar_id: str
    face_image: str  # base64
    role: Optional[str] = "DRIVER"  # DRIVER | HELPER
    vehicle_id: Optional[str] = None  # Associate with vehicle
    
    @field_validator('aadhar_id')
    @classmethod
    def validate_aadhar_format(cls, v: str) -> str:
        """Validate Aadhar ID format"""
        if not v:
            raise ValueError("Aadhar ID is required")
        
        aadhar_clean = v.strip()
        
        if len(aadhar_clean) != 12:
            raise ValueError("Aadhar ID must be exactly 12 digits")
        
        if not aadhar_clean.isdigit():
            raise ValueError("Aadhar ID must contain only digits")
        
        return aadhar_clean
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate role is either DRIVER or HELPER"""
        if v and v not in ["DRIVER", "HELPER"]:
            raise ValueError("Role must be either DRIVER or HELPER")
        return v or "DRIVER"
