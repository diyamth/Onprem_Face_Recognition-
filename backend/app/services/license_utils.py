from datetime import datetime, timedelta

def get_license_status(license_expiry_date: str) -> dict:
    """
    Calculate license status based on expiry date
    Returns: {status: string, days_remaining: int, message: string}
    """
    if not license_expiry_date:
        return {
            "status": "UNKNOWN",
            "days_remaining": None,
            "message": "License expiry date not available"
        }
    
    try:
        expiry = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
        today = datetime.now().date()
        days_remaining = (expiry - today).days
        
        if days_remaining < 0:
            return {
                "status": "EXPIRED",
                "days_remaining": 0,
                "message": f"License expired {abs(days_remaining)} days ago"
            }
        elif days_remaining < 10:
            return {
                "status": "EXPIRING_SOON",
                "days_remaining": days_remaining,
                "message": f"License expires in {days_remaining} days"
            }
        else:
            return {
                "status": "VALID",
                "days_remaining": days_remaining,
                "message": f"License valid for {days_remaining} more days"
            }
    except Exception as e:
        return {
            "status": "ERROR",
            "days_remaining": None,
            "message": f"Error parsing license date: {str(e)}"
        }
