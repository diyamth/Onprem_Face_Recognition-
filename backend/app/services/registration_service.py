from app.db.mongo import users_collection
from app.models.user import user_doc
from app.services.zmq_client import send_registration
from datetime import datetime

def register_user(payload: dict):
    user = user_doc(payload)
    users_collection.insert_one(user)

    # Send to pipeline and update status based on response
    try:
        registration_payload = {
            "mode": "registration",
            "id_number": payload["id_number"],
            "face_image": payload["face_image"],
            "name": payload.get("name", ""),
            "license_expiry": payload.get("license_expiry", ""),
            "role": payload.get("role", "DRIVER"),
            "vendor_name": payload.get("vendor_name", ""),
        }
        print(registration_payload)
        response = send_registration(registration_payload)
        print(f"Pipeline response: {response}")

        # Update user status based on pipeline response
        if response.get("type") == "REGISTRATION_RESULT":
            users_collection.update_one(
                {"id_number": payload["id_number"]},
                {
                    "$set": {
                        "status": response.get("status"),
                        "updated_at": datetime.utcnow(),
                        "pipeline_message": response.get("message"),
                    }
                }
            )
            return {"message": response.get("message"), "status": response.get("status")}

    except Exception as e:
        print(f"Pipeline error: {e}")
        # Pipeline may not be up during demo
        pass
    

    return {"message": "Registration initiated", "status": "PENDING"}