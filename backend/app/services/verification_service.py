from app.db.mongo import users_collection, verification_collection
from app.services.zmq_client import send_verification
from app.services.license_utils import get_license_status
from datetime import datetime
import uuid

def verify_user(payload: dict):
    """
    Handle user verification by:
    1. Creating a verification record with request_id
    2. Sending to pipeline via ZMQ with request_id and face image
    3. Returning request_id for status tracking
    """
    request_id = str(uuid.uuid4())
    
    verification_record = {
        "request_id": request_id,
        "face_image": payload["face_image"],
        "status": "PENDING",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "result": None,
        "confidence": None,
        "match": False,
        "pipeline_message": None,
        "user_info": None,
        "license_status": None,
        "aadhar_id": None,
        "face_id": None
    }
    
    # Store verification record
    verification_collection.insert_one(verification_record)
    
    # Send to pipeline for verification and get response
    try:
        response = send_verification({
            "mode": "identification",
            "request_id": request_id,
            "face_image": payload["face_image"],
            "type": "VERIFICATION_REQUEST"
        })
        print(f"Pipeline response: {response}")

        # Update verification record with pipeline response
        if response.get("type") == "VERIFICATION_RESULT":
            updated_req = update_verification_result(request_id, response)
            return {
                "message": response.get("message"),
                "status": response.get("status"),
                "request_id": request_id,
                "match": response.get("match", False),
                "authorized": response.get("authorized", False),
                "name": response.get("name"),
                "confidence": response.get("confidence")
            }

    except Exception as e:
        print(f"Pipeline error: {e}")
        # Pipeline may not be up, update status
        verification_collection.update_one(
            {"request_id": request_id},
            {"$set": {"status": "ERROR", "pipeline_message": str(e)}}
        )
        return {"message": "Verification request failed", "status": "ERROR", "error": str(e)}

    return {
        "message": "Verification initiated",
        "status": "PENDING",
        "request_id": request_id
    }

def get_verification_result(request_id: str):
    """Get the result of a verification request"""
    result = verification_collection.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not result:
        return {"error": "Verification not found", "status": "NOT_FOUND"}
    
    return result

def update_verification_result(request_id: str, result_data: dict):
    """
    Update verification result from pipeline callback
    Pipeline sends: {request_id, match, confidence, aadhar_id, face_id, ...}
    """
    update_dict = {
        "status": result_data.get("status"),
        "updated_at": datetime.utcnow(),
        "result": result_data.get("result"),
        "confidence": result_data.get("confidence"),
        "match": result_data.get("match", False),
        "pipeline_message": result_data.get("message"),
        "aadhar_id": result_data.get("id_number"),
        "face_id": result_data.get("face_id")
    }
    
    # If match is True, fetch user info and calculate license status
    if result_data.get("match"):
        id_number = result_data.get("id_number")
        user = users_collection.find_one({"id_number": id_number}, {"_id": 0})
        
        if user:
            license_status = get_license_status(user.get("license_expiry"))
            
            update_dict["user_info"] = {
                "name": user.get("name"),
                "vendor_name": user.get("vendor_name"),
                "id_number": user.get("id_number"),
                "id_type": user.get("id_type"),
                "role": user.get("role")
            }
            update_dict["license_status"] = license_status
        else:
            update_dict["user_info"] = None
            update_dict["license_status"] = {
                "status": "NOT_FOUND",
                "message": "User not found in database"
            }
    else:
        # No match - set as not authorized
        update_dict["user_info"] = None
        update_dict["license_status"] = {
            "status": "NOT_AUTHORIZED",
            "message": "Face did not match. Not authorized to proceed."
        }
    
    verification_collection.update_one(
        {"request_id": request_id},
        {"$set": update_dict}
    )


def verify_by_id_number(id_number: str):
    """
    Bypass verification using Aadhar ID when face verification fails.
    Looks up user by id_number and returns user info with license status.
    """
    request_id = str(uuid.uuid4())

    # Find user by id_number
    user = users_collection.find_one({"id_number": id_number}, {"_id": 0})

    if not user:
        # Create verification record for failed bypass
        verification_record = {
            "request_id": request_id,
            "face_image": None,
            "status": "bypass_failed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "result": None,
            "confidence": None,
            "match": False,
            "pipeline_message": "Bypass verification failed - ID not found",
            "user_info": None,
            "license_status": {
                "status": "NOT_FOUND",
                "message": "User with this ID not found in database"
            },
            "aadhar_id": id_number,
            "face_id": None
        }
        verification_collection.insert_one(verification_record)

        return {
            "message": "User not found",
            "status": "bypass_failed",
            "request_id": request_id,
            "match": False,
            "user_info": None,
            "license_status": {
                "status": "NOT_FOUND",
                "message": "User with this ID not found in database"
            }
        }

    # User found - get license status
    license_status = get_license_status(user.get("license_expiry"))

    user_info = {
        "name": user.get("name"),
        "vendor_name": user.get("vendor_name"),
        "id_number": user.get("id_number"),
        "id_type": user.get("id_type"),
        "role": user.get("role")
    }

    # Create verification record for successful bypass
    verification_record = {
        "request_id": request_id,
        "face_image": None,
        "status": "bypass_verified",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "result": None,
        "confidence": None,
        "match": True,
        "pipeline_message": "Verified via ID bypass",
        "user_info": user_info,
        "license_status": license_status,
        "aadhar_id": id_number,
        "face_id": None
    }
    verification_collection.insert_one(verification_record)

    return {
        "message": "Verified via ID bypass",
        "status": "bypass_verified",
        "request_id": request_id,
        "match": True,
        "user_info": user_info,
        "license_status": license_status
    }
