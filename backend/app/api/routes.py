from fastapi import APIRouter, Query
from typing import Optional
from app.schemas.user_schema import RegisterUserRequest
from app.schemas.verification_schema import (
    VerifyUserRequest, 
    VerificationHistoryResponse,
    TwoCameraVerificationRequest,
    TwoCameraVerificationResponse
)
from app.services.registration_service import register_user
from app.services.verification_service import verify_user, get_verification_result, verify_by_id_number
from app.services.verification_history_service import get_verification_history, get_verification_history_count
from app.services.two_camera_verification_service import verify_two_cameras
from app.db.mongo import users_collection, face_recognition_users_collection
from app.services.pipeline_control import start_pipeline, stop_pipeline
from app.services.pipeline_state import PIPELINE_STATE

router = APIRouter(prefix="/api")

@router.post("/register")
def register(payload: RegisterUserRequest):
    return register_user(payload.dict())

@router.get("/users")
def list_users():
    return list(users_collection.find({}, {"_id": 0}))

@router.delete("/users/{id_number}")
def delete_user(id_number: str):
    # Delete from users collection
    users_collection.delete_one({"id_number": id_number})
    # Delete face embedding from face_recognition database
    face_recognition_users_collection.delete_one({"id_number": id_number})
    return {"message": "User deleted"}

@router.post("/verify")
def verify(payload: VerifyUserRequest):
    return verify_user(payload.dict())

@router.get("/verify/{request_id}")
def get_verification(request_id: str):
    return get_verification_result(request_id)


@router.post("/verify/bypass/{id_number}")
def verify_bypass(id_number: str):
    """Bypass verification using Aadhar ID when face verification fails"""
    return verify_by_id_number(id_number)

@router.post("/verify/two-camera", response_model=TwoCameraVerificationResponse)
def verify_two_camera(payload: TwoCameraVerificationRequest):
    """
    Verify using two cameras (left and right side)
    Automatically identifies driver and helper based on face recognition
    """
    return verify_two_cameras(
        camera_left_frame=payload.camera_left_frame,
        camera_right_frame=payload.camera_right_frame
    )

@router.post("/pipeline/start")
def start():
    response = start_pipeline()
    return {
        "status": "ok",
        "pipeline_response": response
    }


@router.post("/pipeline/stop")
def stop():
    stop_pipeline()
    return {"running": False}

@router.get("/pipeline/status")
def status():
    return PIPELINE_STATE


@router.get("/verifications/history", response_model=VerificationHistoryResponse)
def verification_history(
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None)
):
    """
    Get verification history for table display.
    Returns: name, status, time, license_expiry_days, aadhar_id
    """
    data = get_verification_history(limit=limit, skip=skip, status=status)
    total = get_verification_history_count(status=status)
    return {
        "data": data,
        "total": total,
        "limit": limit,
        "skip": skip
    }
