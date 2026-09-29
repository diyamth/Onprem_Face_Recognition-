from datetime import datetime

def user_doc(payload: dict):
    return {
        "name": payload["name"],
        "id_type": payload["id_type"],
        "id_number": payload["id_number"],
        "role": payload.get("role", "DRIVER"),
        "vehicle_id": payload.get("vehicle_id"),
        "license_expiry": payload.get("license_expiry"),
        "vendor_name": payload["vendor_name"],
        "face_image": payload["face_image"],
        "status": "PENDING",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
