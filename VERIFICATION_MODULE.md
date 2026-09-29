# Verification Module - Implementation Guide

## Overview
The verification module allows users to verify their identity by capturing a face image via webcam. The system sends only the face image and a request_id to the pipeline for verification. Upon successful match, the system enriches the response with user information and license status details.

## Architecture

### Flow Diagram
```
Frontend (Verification.tsx)
    ↓
    → POST /api/verify (face image only)
    ↓
Backend (verification_service.py)
    → Generates request_id (UUID)
    → Creates verification record in MongoDB
    → Sends to ZMQ pipeline (port 5555): {request_id, face_image}
    ↓
Pipeline (External Service)
    → Receives {request_id, face_image}
    → Processes face verification
    → Sends result back via ZMQ (port 5556): {request_id, match, confidence, aadhar_id, face_id, ...}
    ↓
Backend ZMQ Listener
    → Receives VERIFICATION_RESULT with request_id, match status, confidence
    → If MATCH: Looks up user by aadhar_id, fetches user info, calculates license status
    → If NO MATCH: Sets as "NOT_AUTHORIZED"
    → Updates verification record in MongoDB
    ↓
Frontend
    → Polls GET /api/verify/{request_id}
    → Displays result with user info and license status (if matched)
```

## Backend Components

### 1. License Status Utility (`app/services/license_utils.py`)
- **`get_license_status(license_expiry_date)`**: Calculates license status
  - **VALID**: >10 days remaining (green)
  - **EXPIRING_SOON**: ≤10 days remaining (amber)
  - **EXPIRED**: Past expiry date (red)
  - Returns status, days_remaining, and descriptive message

### 2. Verification Service (`app/services/verification_service.py`)
- **`verify_user(payload)`**: Initiates verification request
  - Generates unique request_id (UUID)
  - Creates verification record with status "PENDING"
  - Sends {request_id, face_image} to pipeline via ZMQ
  - Returns request_id for status tracking
  
- **`get_verification_result(request_id)`**: Retrieves verification status
  - Returns full verification record with all enriched data
  
- **`update_verification_result(request_id, result_data)`**: Updates with pipeline response
  - Called by ZMQ listener when pipeline sends results
  - **If MATCH is TRUE**:
    - Fetches user from database by aadhar_id
    - Retrieves user info: name, vendor_name, id_type, id_number
    - Calculates license status: VALID/EXPIRING_SOON/EXPIRED
  - **If MATCH is FALSE**:
    - Sets license_status to "NOT_AUTHORIZED"
    - User info set to null

### 3. API Routes (`app/api/routes.py`)
```python
POST /api/verify
  Request: { face_image: base64 }
  Response: { request_id: UUID, status: "PENDING", message: string }

GET /api/verify/{request_id}
  Response: {
    request_id: UUID,
    status: "PENDING" | "COMPLETED" | "ERROR",
    match: boolean,
    confidence: number (0-1),
    aadhar_id: string,
    face_id: string,
    user_info: {
      name: string,
      vendor_name: string,
      id_type: string,
      id_number: string
    } | null,
    license_status: {
      status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NOT_AUTHORIZED",
      days_remaining: number,
      message: string
    },
    pipeline_message: string,
    created_at: datetime,
    updated_at: datetime
  }
```

### 4. Database (`app/db/mongo.py`)
- **Collection**: `verifications`
- **Document Schema**:
  ```javascript
  {
    request_id: UUID,
    face_image: base64,
    status: "PENDING" | "COMPLETED" | "ERROR",
    match: boolean,
    confidence: number,
    result: any,
    aadhar_id: string,
    face_id: string,
    user_info: {
      name: string,
      vendor_name: string,
      id_type: string,
      id_number: string
    } | null,
    license_status: {
      status: string,
      days_remaining: number,
      message: string
    },
    pipeline_message: string,
    created_at: datetime,
    updated_at: datetime
  }
  ```

### 5. ZMQ Communication

**Request Format** (to pipeline, port 5555):
```json
{
  "type": "VERIFICATION_REQUEST",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "face_image": "base64_string"
}
```

**Response Format** (from pipeline, port 5556):
```json
{
  "type": "VERIFICATION_RESULT",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "match": true,
  "confidence": 0.95,
  "aadhar_id": "123456789012",
  "face_id": "face_xyz_123",
  "result": "MATCHED",
  "message": "Face matched successfully"
}
```

## Frontend Components

### Verification Page (`frontend/src/pages/Verification.tsx`)
**Features**:
- Face capture using webcam (reuses FaceCapture component)
- Simple one-click verification (no ID number needed)
- Submission to backend API
- Auto-polling for verification results
- Result display with color-coded indicators:
  - **Match status**: ✅ Face Matched / ❌ Face Not Matched / ⏳ In Progress
  - **Confidence score**: Animated progress bar (0-100%)
  - **User Information** (if matched):
    - Name
    - Vendor Name
    - ID Type
    - ID Number
  - **License Status** (if matched):
    - ✓ **VALID** (green): >10 days remaining
    - ⚠ **EXPIRING_SOON** (amber): ≤10 days remaining
    - ✕ **EXPIRED** (red): Past expiry date
    - Days remaining counter
  - **Not Authorized** (if no match):
    - ✕ Face did not match message

**States**:
- Input phase: Capture face only
- Processing phase: Submitting verification request
- Result phase: Display match result, user info, and license status

## Usage Flow

### Step 1: User Navigates to Verification
- User clicks "✅ Verification" button in navigation

### Step 2: Capture Face
- Click "📷 Capture Face" button
- Allow webcam access
- Face detected automatically
- Click "✓ Capture" to confirm or retake

### Step 3: Submit for Verification
- Click "✅ Verify Identity"
- Frontend sends POST /api/verify with face image only
- Backend generates request_id and sends to pipeline

### Step 4: View Results
- Backend processes and sends to pipeline
- Pipeline processes verification and returns: match, confidence, aadhar_id, face_id
- Backend enriches response:
  - **If MATCH**: Fetches user info and calculates license status
  - **If NO MATCH**: Shows "Not Authorized"
- Frontend auto-polls for result after 1.5 seconds
- Display comprehensive result with:
  - Match status and confidence
  - User information (if matched)
  - License status with days remaining (if matched)
  - Authorization status (if no match)

### Step 5: Verify Another User
- Click "🔄 Verify Another User" to reset form

## Testing the Verification Module

### Prerequisites
1. MongoDB running on localhost:27017
2. At least one user registered in the system
3. Pipeline service running (or use pipeline_simulator.py)
4. Backend running on localhost:8000
5. Frontend running on localhost:5173

### Manual Testing Steps
```bash
# 1. Start backend
cd backend
python -m app.main

# 2. In another terminal, start pipeline simulator (or your actual pipeline)
cd ..
python pipeline_simulator.py

# 3. Register a user first
# Navigate to Register tab and complete registration with:
# - Name: John Doe
# - Aadhar ID: 123456789012
# - License Expiry: 2026-02-15 (for VALID status)
# - Vendor: Test Vendor

# 4. Test verification
# Navigate to Verification tab
# Capture the same face that was registered
# Click Verify Identity
# Check the results
```

### Expected Responses

**Successful Verification - License VALID**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "match": true,
  "confidence": 0.92,
  "aadhar_id": "123456789012",
  "face_id": "face_xyz_123",
  "result": "MATCHED",
  "pipeline_message": "Face matched successfully",
  "user_info": {
    "name": "John Doe",
    "vendor_name": "Test Vendor",
    "id_type": "EMPLOYEE_ID",
    "id_number": "123456789012"
  },
  "license_status": {
    "status": "VALID",
    "days_remaining": 31,
    "message": "License valid for 31 more days"
  },
  "created_at": "2026-01-17T10:30:00",
  "updated_at": "2026-01-17T10:30:05"
}
```

**Successful Verification - License EXPIRING_SOON**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "COMPLETED",
  "match": true,
  "confidence": 0.88,
  "aadhar_id": "123456789012",
  "face_id": "face_xyz_123",
  "user_info": {
    "name": "John Doe",
    "vendor_name": "Test Vendor",
    "id_type": "EMPLOYEE_ID",
    "id_number": "123456789012"
  },
  "license_status": {
    "status": "EXPIRING_SOON",
    "days_remaining": 5,
    "message": "License expires in 5 days"
  },
  "created_at": "2026-01-17T10:31:00",
  "updated_at": "2026-01-17T10:31:05"
}
```

**Successful Verification - License EXPIRED**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440002",
  "status": "COMPLETED",
  "match": true,
  "confidence": 0.85,
  "user_info": {
    "name": "John Doe",
    "vendor_name": "Test Vendor",
    "id_type": "EMPLOYEE_ID",
    "id_number": "123456789012"
  },
  "license_status": {
    "status": "EXPIRED",
    "days_remaining": -10,
    "message": "License expired 10 days ago"
  },
  "created_at": "2026-01-17T10:32:00",
  "updated_at": "2026-01-17T10:32:05"
}
```

**Failed Verification - Not Authorized**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "COMPLETED",
  "match": false,
  "confidence": 0.35,
  "aadhar_id": null,
  "face_id": null,
  "result": "NOT_MATCHED",
  "pipeline_message": "Face does not match registered user",
  "user_info": null,
  "license_status": {
    "status": "NOT_AUTHORIZED",
    "message": "Face did not match. Not authorized to proceed."
  },
  "created_at": "2026-01-17T10:33:00",
  "updated_at": "2026-01-17T10:33:05"
}
```

## Configuration

### Backend Settings
- **ZMQ Request Socket**: `tcp://127.0.0.1:5555` (to pipeline)
- **ZMQ Listener**: `tcp://0.0.0.0:5556` (from pipeline)
- **MongoDB**: `mongodb://localhost:27017/smg_face`
- **License Expiry Threshold**: 10 days

### Frontend Settings
- **API Base URL**: `http://localhost:8000`
- **Verification Polling Delay**: 1500ms after submission
- **License Status Colors**:
  - VALID: Green (#22c55e)
  - EXPIRING_SOON: Amber (#f59e0b)
  - EXPIRED: Red (#ef4444)
  - NOT_AUTHORIZED: Red (#ef4444)

## Error Handling

### Backend Errors
- **Pipeline Connection Failed**: Returns error in response, stores in DB
- **Missing Face Image**: Returns 400 with validation error
- **Verification Not Found**: Returns `{"error": "Verification not found", "status": "NOT_FOUND"}`
- **User Not Found in DB**: Sets license_status to "NOT_FOUND" while match is true (edge case)

### Frontend Errors
- **Network Error**: Shows error message "Verification failed. Please try again."
- **Result Fetch Error**: Shows "Failed to fetch verification result"
- **Disabled button**: When face not captured or already submitting

## Future Enhancements

1. **Confidence Threshold**: Set minimum confidence level for acceptance
2. **Liveness Detection**: Detect if face is a photo or real person
3. **Retry Logic**: Automatic retries for transient failures
4. **Result History**: Show past verification attempts
5. **Multi-Face Support**: Verify multiple faces in one image
6. **Timeout Handling**: Max wait time for pipeline response
7. **Batch Verification**: Verify multiple faces in batch
8. **License Renewal Alerts**: Notify when license is about to expire
9. **Audit Logging**: Complete audit trail of all verification attempts
10. **Analytics Dashboard**: Verification success rates and trends
