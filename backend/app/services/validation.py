def validate_aadhar(aadhar_id: str) -> tuple[bool, str]:
    """
    Validate Aadhar ID format
    - Must be exactly 12 digits
    - No spaces, special characters, or letters allowed
    
    Returns: (is_valid, error_message)
    """
    if not aadhar_id:
        return False, "Aadhar ID is required"
    
    aadhar_clean = aadhar_id.strip()
    
    if len(aadhar_clean) != 12:
        return False, "Aadhar ID must be exactly 12 digits"
    
    if not aadhar_clean.isdigit():
        return False, "Aadhar ID must contain only digits"
    
    return True, "Valid"
