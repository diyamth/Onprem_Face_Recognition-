from app.db.mongo import verification_collection
from typing import Optional


def get_verification_history(limit: int = 50, skip: int = 0, status: Optional[str] = None):
    """
    Fetch verification history for the table display.
    Returns: name, status, time, license_expiry (days remaining), aadhar_id
    """
    query = {}
    if status:
        query["status"] = status

    cursor = verification_collection.find(
        query,
        {
            "_id": 0,
            "request_id": 1,
            "status": 1,
            "created_at": 1,
            "user_info.name": 1,
            "user_info.role": 1,
            "user_info.vendor_name": 1,
            "license_status.days_remaining": 1,
            "license_status.status": 1,
            "aadhar_id": 1,
            "match": 1,
        }
    ).sort("created_at", -1).skip(skip).limit(limit)

    results = []
    for doc in cursor:
        user_info = doc.get("user_info") or {}
        license_status = doc.get("license_status") or {}

        results.append({
            "request_id": doc.get("request_id"),
            "name": user_info.get("name", "Unknown"),
            "role": user_info.get("role"),
            "vendor_name": user_info.get("vendor_name"),
            "status": doc.get("status"),
            "time": doc.get("created_at"),
            "license_expiry_days": license_status.get("days_remaining"),
            "license_status": license_status.get("status"),
            "aadhar_id": doc.get("aadhar_id"),
            "match": doc.get("match", False),
        })

    return results

def get_verification_history_count(status: Optional[str] = None) -> int:
    """Get total count of verification records for pagination"""
    query = {}
    if status:
        query["status"] = status
    return verification_collection.count_documents(query)
