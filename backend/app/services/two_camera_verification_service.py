import zmq
import time
import json
from typing import Dict, Optional
from datetime import datetime
from app.services.license_utils import get_license_status


# Create a ZMQ context for publishing results (separate from pipeline requests)
zmq_pub_context = zmq.Context()
zmq_pub_socket = zmq_pub_context.socket(zmq.PUSH)
zmq_pub_socket.connect("tcp://192.168.1.15:5556")  # Different port for publishing results

def send_to_raspberry_pi(result: Dict) -> bool:
    """Send authorization result to Raspberry Pi"""
    try:
        # Create simplified message for Raspberry Pi
        message = {
            "overall_authorized": result["overall_authorized"],
            "timestamp": result["timestamp"].isoformat() if isinstance(result["timestamp"], datetime) else result["timestamp"],
            "validation_error": result["validation_error"],
            "driver": {
                "name": result["driver"]["name"] if result["driver"] else None,
                "id_number": result["driver"]["id_number"] if result["driver"] else None,
                "authorized": result["driver"]["authorized"] if result["driver"] else False,
                "license_status": result["driver"]["license_status"] if result["driver"] else None,
            } if result["driver"] else None,
            "helper": {
                "name": result["helper"]["name"] if result["helper"] else None,
                "id_number": result["helper"]["id_number"] if result["helper"] else None,
                "authorized": result["helper"]["authorized"] if result["helper"] else False,
            } if result["helper"] else None,
        }
        
        # Send as JSON
        zmq_pub_socket.send_json(message)
        print(f"[ZMQ PUB] Sent to Raspberry Pi: {message}")
        return True
        
    except Exception as e:
        print(f"[ZMQ PUB] Error sending to Raspberry Pi: {e}")
        return False

def identify_person_from_frame(frame_base64: str, camera_id: str, max_retries: int = 2) -> Optional[Dict]:
    """Send frame to pipeline with retry logic"""
    for attempt in range(max_retries + 1):
        try:
            context = zmq.Context()
            socket = context.socket(zmq.REQ)
            socket.connect("tcp://localhost:5555")
            socket.setsockopt(zmq.RCVTIMEO, 10000)
            
            request = {
                "mode": "identification",
                "video_frame": frame_base64,
                "request_id": f"{camera_id}_{int(time.time() * 1000)}"
            }
            
            socket.send_json(request)
            response = socket.recv_json()
            socket.close()
            context.term()
            
            return response
            
        except zmq.error.Again:
            if attempt < max_retries:
                time.sleep(0.5)  # Brief delay before retry
            continue
        except Exception as e:
            return None
    
    return None  # All retries failed


def process_pipeline_response(response: Optional[Dict], camera_id: str) -> Dict:
    """
    Process pipeline response and format it for two-camera verification
    """
    if not response:
        return {
            "face_detected": False,
            "match_found": False,
            "authorized": False,
            "detected_at": camera_id,
            "reason": "Failed to connect to pipeline"
        }
    
    # No face detected
    if response.get("status") == "no_face_detected":
        return {
            "face_detected": False,
            "match_found": False,
            "authorized": False,
            "detected_at": camera_id,
            "reason": response.get("message", "No face detected")
        }
    
    # Face detected but not matched
    if response.get("status") == "unauthorized" or not response.get("match"):
        return {
            "face_detected": True,
            "match_found": False,
            "authorized": False,
            "detected_at": camera_id,
            "reason": response.get("message", "Face not recognized")
        }
    
    # Face matched - get license status
    license_status_info = get_license_status(response.get("license_expiry", ""))
    
    return {
        "face_detected": True,
        "match_found": True,
        "authorized": response.get("authorized", False),
        "confidence": response.get("confidence"),
        "id_number": response.get("id_number"),
        "name": response.get("name"),
        "role": response.get("role", "UNKNOWN"),
        "vendor_name": response.get("vendor_name"),
        "license_status": license_status_info["status"],
        "license_expiry_days": license_status_info["days_remaining"],
        "detected_at": camera_id,
        "reason": None if response.get("authorized") else response.get("message")
    }


def verify_two_cameras(camera_left_frame: str, camera_right_frame: Optional[str] = None) -> Dict:
    """
    Process frames from two cameras and identify persons
    Returns verification results for both cameras
    """
    start_time = time.time()
    request_id = f"two_camera_{int(time.time() * 1000)}"
    
    response_left = identify_person_from_frame(camera_left_frame, "camera_left")
    person_left = process_pipeline_response(response_left, "camera_left")
    
    # Process right camera (if provided)
    person_right = None
    if camera_right_frame:
        response_right = identify_person_from_frame(camera_right_frame, "camera_right")
        person_right = process_pipeline_response(response_right, "camera_right")
    
    # Determine driver and helper based on roles
    driver = None
    helper = None
    validation_error = None
    overall_authorized = False
    
    # Strict camera position validation:
    # Camera 1 (left) = DRIVER ONLY
    # Camera 2 (right) = HELPER ONLY
    
    # Check Camera 1 (left/driver side) - MUST have DRIVER role
    if person_left and person_left.get("match_found"):
        role = person_left.get("role")
        if role == "UNKNOWN" or role is None:
            validation_error = "Person on Camera 1 (Driver Side) has no role assigned. Please ensure driver role is set in registration."
            person_left["authorized"] = False
            person_left["reason"] = validation_error
        elif role == "HELPER":
            validation_error = "Helper detected on Camera 1 (Driver Side). Please position driver on Camera 1 and helper on Camera 2."
            person_left["authorized"] = False
            person_left["reason"] = validation_error
        elif role == "DRIVER":
            # Check if driver is actually authorized (license valid, etc.)
            if person_left.get("authorized"):
                driver = person_left
            else:
                validation_error = f"Driver identified but not authorized: {person_left.get('reason', 'Unknown reason')}"
    
    # Check Camera 2 (right/helper side) - should ONLY have HELPER (or nobody)
    if person_right and person_right.get("match_found"):
        role = person_right.get("role")
        if role == "UNKNOWN" or role is None:
            # For Camera 2, UNKNOWN is acceptable but not ideal
            # Check authorization even for UNKNOWN role
            if person_right.get("authorized"):
                helper = person_right
            else:
                validation_error = f"Person on Camera 2 identified but not authorized: {person_right.get('reason', 'Unknown reason')}"
        elif role == "DRIVER":
            validation_error = "Driver detected on Camera 2 (Helper Side). Please position driver on Camera 1 (driver side) only."
            person_right["authorized"] = False
            person_right["reason"] = validation_error
        elif role == "HELPER":
            # Check if helper is actually authorized
            if person_right.get("authorized"):
                helper = person_right
            else:
                validation_error = f"Helper identified but not authorized: {person_right.get('reason', 'Unknown reason')}"
    
    # ============================================
    # OVERALL AUTHORIZATION DECISION LOGIC
    # ============================================

    # 1️⃣ If any validation error already exists → deny
    if validation_error:
        overall_authorized = False

    # 2️⃣ No authorized driver = always deny
    elif not driver:
        overall_authorized = False
        validation_error = "No authorized driver detected on Camera 1 (Driver Side)"

    # 3️⃣ Driver authorized AND helper camera has a detected face
    elif driver and person_right and person_right.get("face_detected"):

        # If helper is not authorized → deny
        if not helper:
            overall_authorized = False
            validation_error = "Helper detected but not authorized. Entry denied."

        # If helper exists but vendor mismatch → deny
        elif driver.get("vendor_name") != helper.get("vendor_name"):
            overall_authorized = False
            validation_error = (
                f"Driver and Helper must be from same vendor. "
                f"Driver: {driver.get('vendor_name')}, "
                f"Helper: {helper.get('vendor_name')}"
            )

        # Both authorized and valid
        else:
            overall_authorized = True

    # 4️⃣ Driver authorized AND no helper detected → allow
    elif driver and (not person_right or not person_right.get("face_detected")):
        overall_authorized = True

    # 5️⃣ Fallback
    else:
        overall_authorized = False
        validation_error = "Authorization requirements not met"

    
    processing_time = (time.time() - start_time) * 1000
    
    result = {
        "request_id": request_id,
        "timestamp": datetime.utcnow(),
        "overall_authorized": overall_authorized,  # ✅ ADD THIS
        "person_left": person_left,
        "person_right": person_right,
        "driver": driver,
        "helper": helper,
        "validation_error": validation_error,
        "processing_time_ms": round(processing_time, 2)
    }

    # 📤 Send result to Raspberry Pi
    send_to_raspberry_pi(result)
    
    return result
