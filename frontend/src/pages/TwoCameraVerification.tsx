import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import FaceCapture from "../components/FaceCapture";
import TrafficLight from "../components/TrafficLight";
import {
  createAudioManager,
  VERIFICATION_MESSAGES,
} from "../utils/audioVerification";

interface PersonVerificationResult {
  face_detected: boolean;
  match_found: boolean;
  authorized: boolean;
  confidence?: number;
  id_number?: string;
  name?: string;
  role?: string;
  license_status?: string;
  license_expiry_days?: number;
  detected_at?: string;
  reason?: string;
}

interface TwoCameraVerificationResponse {
  request_id: string;
  timestamp: string;
  overall_authorized: boolean;
  person_left: PersonVerificationResult | null;
  person_right: PersonVerificationResult | null;
  driver: PersonVerificationResult | null;
  helper: PersonVerificationResult | null;
  validation_error: string | null;
  processing_time_ms: number;
}

const TwoCameraVerification: React.FC = () => {
  const [step, setStep] = useState<"driver" | "helper" | "verify">("driver");
  const [driverImage, setDriverImage] = useState<string | null>(null);
  const [helperImage, setHelperImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TwoCameraVerificationResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [bypassId, setBypassId] = useState("");
  const [bypassSubmitting, setBypassSubmitting] = useState(false);
  const [isBypassResult, setIsBypassResult] = useState(false);

  // Audio manager
  const audioManagerRef = useRef(createAudioManager());

  // Setup and cleanup audio on mount
  useEffect(() => {
    audioManagerRef.current.reset();
    return () => {
      audioManagerRef.current.cleanup();
    };
  }, []);

  // Handle driver capture
  const handleDriverCapture = (image: string) => {
    setDriverImage(image);
    audioManagerRef.current.speak("Driver face captured", "success");
  };

  // Handle helper capture
  const handleHelperCapture = (image: string) => {
    setHelperImage(image);
    audioManagerRef.current.speak("Helper face captured", "success");
  };

  // Move to helper step
  const proceedToHelper = () => {
    setStep("helper");
  };

  // Skip helper and verify with driver only
  const skipHelper = async () => {
    await submitVerification();
  };

  // Submit verification
  const submitVerification = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    audioManagerRef.current.speak(VERIFICATION_MESSAGES.verifying, "verifying");

    try {
      const response = await axios.post<TwoCameraVerificationResponse>(
        "http://localhost:8000/api/verify/two-camera",
        {
          camera_left_frame: driverImage,
          camera_right_frame: helperImage || null,
        },
      );

      setResult(response.data);
      setStep("verify");

      // Speak result
      audioManagerRef.current.reset();
      setTimeout(() => {
        if (response.data.overall_authorized) {
          audioManagerRef.current.speak(
            VERIFICATION_MESSAGES.success,
            "success",
            true,
          );
        } else {
          audioManagerRef.current.speak(
            VERIFICATION_MESSAGES.failed,
            "failed",
            true,
          );
        }
      }, 100);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || "Verification failed. Please try again.";
      setError(errorMsg);
      audioManagerRef.current.speak(VERIFICATION_MESSAGES.error, "error", true);
    } finally {
      setSubmitting(false);
    }
  };

  // Validate Aadhar ID: must be exactly 12 digits
  const validateAadhar = (
    value: string,
  ): { isValid: boolean; message: string } => {
    if (!value) {
      return { isValid: false, message: "" };
    }

    const clean = value.trim();

    if (clean.length > 12) {
      return { isValid: false, message: "Aadhar ID must be 12 digits" };
    }

    if (!/^\d*$/.test(clean)) {
      return { isValid: false, message: "Aadhar ID must contain only digits" };
    }

    if (clean.length === 12) {
      return { isValid: true, message: "✓ Valid Aadhar ID" };
    }

    return { isValid: false, message: `${clean.length}/12 digits` };
  };

  const bypassAadharValidation = validateAadhar(bypassId);

  const submitBypass = async () => {
    if (!bypassAadharValidation.isValid || bypassSubmitting) return;

    setBypassSubmitting(true);
    setError(null);

    try {
      const response = await axios.post(
        `http://localhost:8000/api/verify/bypass/${bypassId.trim()}`,
      );

      // Create a two-camera result structure with the bypass data
      const bypassResult: TwoCameraVerificationResponse = {
        request_id: response.data.request_id || "bypass-" + Date.now(),
        timestamp: new Date().toISOString(),
        overall_authorized: response.data.match || false,
        person_left: null,
        person_right: null,
        driver: response.data.match
          ? {
              face_detected: false,
              match_found: true,
              authorized: response.data.license_status?.status === "VALID",
              id_number: response.data.user_info?.id_number,
              name: response.data.user_info?.name,
              role: response.data.user_info?.role,
              license_status: response.data.license_status?.status,
              license_expiry_days: response.data.license_status?.days_remaining,
            }
          : null,
        helper: null,
        validation_error: response.data.match
          ? null
          : "Driver not found in system",
        processing_time_ms: 0,
      };

      setResult(bypassResult);
      setIsBypassResult(true);
      setStep("verify");
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail ||
        "Aadhar ID not found in system. Please check the ID and try again.";
      setError(errorMsg);
      console.error("Bypass verification error:", err);
    } finally {
      setBypassSubmitting(false);
    }
  };

  const reset = () => {
    setStep("driver");
    setDriverImage(null);
    setHelperImage(null);
    setResult(null);
    setError(null);
    setBypassId("");
    setIsBypassResult(false);
    audioManagerRef.current.reset();
  };

  const getLicenseStatusColor = (status?: string) => {
    switch (status) {
      case "VALID":
        return "#22c55e";
      case "EXPIRING_SOON":
        return "#f59e0b";
      case "EXPIRED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getActiveTrafficLight = (): "green" | "amber" | "red" | null => {
    if (!result) return null;
    if (!result.overall_authorized) return "red";

    const driverLicenseStatus = result.driver?.license_status;
    if (driverLicenseStatus === "VALID") return "green";
    if (driverLicenseStatus === "EXPIRING_SOON") return "amber";
    return "red";
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        padding: "40px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            margin: "0 0 8px 0",
            background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Two-Camera Face Verification
        </h2>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          Capture driver (left camera) and helper (right camera) faces
        </p>
      </div>

      {step === "driver" && !result ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 30,
            alignItems: "start",
          }}
        >
          {/* Left: Face Capture */}
          <div>
            <div
              style={{
                background: "#dbeafe",
                padding: 16,
                borderRadius: 12,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1e40af",
                }}
              >
                🚗 Step 1: Capture Driver Face
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#1d4ed8" }}>
                Position the driver in front of the camera
              </p>
            </div>

            <FaceCapture onCapture={handleDriverCapture} enableAudio={true} />

            {driverImage && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "white",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#22c55e",
                  }}
                >
                  ✓ Driver Face Captured
                </p>
                <img
                  src={driverImage}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: 12,
                    border: "3px solid #22c55e",
                    objectFit: "cover",
                    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div
            style={{
              background: "#F3F4F6",
              borderRadius: 16,
              padding: 30,
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 18,
                color: "#333",
              }}
            >
              Next Steps
            </h3>

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  background:
                    "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                  border: "2px solid #ef4444",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <div>
                  <h4
                    style={{
                      margin: "0 0 2px 0",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#991b1b",
                    }}
                  >
                    Verification Failed
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#dc2626",
                    }}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              {driverImage
                ? "Driver face captured! Choose next action:"
                : "Capture the driver's face to proceed"}
            </p>

            {driverImage && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <button
                  onClick={proceedToHelper}
                  style={{
                    padding: "14px 24px",
                    fontSize: 15,
                    fontWeight: 600,
                    background:
                      "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 4px 12px rgba(8, 145, 178, 0.3)",
                  }}
                >
                  Next: Capture Helper 👷
                </button>

                <button
                  onClick={skipHelper}
                  disabled={submitting}
                  style={{
                    padding: "14px 24px",
                    fontSize: 15,
                    fontWeight: 600,
                    background: submitting
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: submitting
                      ? "none"
                      : "0 4px 12px rgba(245, 158, 11, 0.3)",
                  }}
                >
                  {submitting ? "Verifying..." : "Skip Helper & Verify"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : step === "helper" && !result ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 30,
            alignItems: "start",
          }}
        >
          {/* Left: Face Capture */}
          <div>
            <div
              style={{
                background: "#fef3c7",
                padding: 16,
                borderRadius: 12,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                👷 Step 2: Capture Helper Face
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#78350f" }}>
                Position the helper in front of the camera
              </p>
            </div>

            {/* Show Driver Preview */}
            <div
              style={{
                background: "#f0f9ff",
                padding: 12,
                borderRadius: 12,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <img
                src={driverImage!}
                width={60}
                height={60}
                style={{
                  borderRadius: 8,
                  border: "2px solid #0891b2",
                  objectFit: "cover",
                }}
              />
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: "0 0 2px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0c4a6e",
                  }}
                >
                  ✓ Driver Face Captured
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                  Now capture helper face or skip
                </p>
              </div>
            </div>

            <FaceCapture onCapture={handleHelperCapture} enableAudio={false} />

            {helperImage && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "white",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#22c55e",
                  }}
                >
                  ✓ Helper Face Captured
                </p>
                <img
                  src={helperImage}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: 12,
                    border: "3px solid #22c55e",
                    objectFit: "cover",
                    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div
            style={{
              background: "#F3F4F6",
              borderRadius: 16,
              padding: 30,
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 18,
                color: "#333",
              }}
            >
              Verification
            </h3>

            {submitting && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 20,
                  background:
                    "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                  border: "2px solid #3b82f6",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px auto",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: "spin 2s linear infinite" }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <h4
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1e40af",
                  }}
                >
                  Processing Verification
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#1d4ed8",
                  }}
                >
                  Verifying identities...
                </p>
              </div>
            )}

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  background:
                    "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                  border: "2px solid #ef4444",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <div>
                  <h4
                    style={{
                      margin: "0 0 2px 0",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#991b1b",
                    }}
                  >
                    Verification Failed
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#dc2626",
                    }}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              {helperImage
                ? "Both faces captured! Ready to verify."
                : "You can skip helper or capture their face first."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {helperImage ? (
                <button
                  onClick={submitVerification}
                  disabled={submitting}
                  style={{
                    padding: "14px 24px",
                    fontSize: 15,
                    fontWeight: 600,
                    background: submitting
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: submitting
                      ? "none"
                      : "0 4px 12px rgba(34, 197, 94, 0.4)",
                  }}
                >
                  {submitting ? "Verifying..." : "✅ Verify Both"}
                </button>
              ) : (
                <>
                  <button
                    onClick={submitVerification}
                    disabled={submitting}
                    style={{
                      padding: "14px 24px",
                      fontSize: 15,
                      fontWeight: 600,
                      background: submitting
                        ? "#9ca3af"
                        : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: submitting ? "not-allowed" : "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: submitting
                        ? "none"
                        : "0 4px 12px rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    {submitting ? "Verifying..." : "Skip & Verify Driver Only"}
                  </button>

                  <button
                    onClick={() => setStep("driver")}
                    style={{
                      padding: "12px 24px",
                      fontSize: 14,
                      fontWeight: 600,
                      background: "#6b7280",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  >
                    ← Back to Driver
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : result ? (
        <div style={{ display: "flex", gap: 30 }}>
          {/* Left: Result Cards */}
          <div style={{ flex: 1 }}>
            {/* Overall Authorization Result */}
            <div
              style={{
                padding: 30,
                background: result.overall_authorized ? "#dcfce7" : "#fee2e2",
                border: `2px solid ${result.overall_authorized ? "#22c55e" : "#ef4444"}`,
                borderRadius: 16,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                  fontSize: 24,
                  fontWeight: 700,
                  color: result.overall_authorized ? "#16a34a" : "#dc2626",
                }}
              >
                {result.overall_authorized
                  ? isBypassResult
                    ? "✅ Access Authorized (ID Verified)"
                    : "✅ Access Authorized"
                  : isBypassResult
                    ? "❌ Driver ID Not Found"
                    : "❌ Access Denied"}
              </h3>
              {result.validation_error && (
                <p
                  style={{
                    margin: 0,
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {result.validation_error}
                </p>
              )}
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#666" }}>
                Processing Time: {result.processing_time_ms}ms
              </p>
            </div>

            {/* Driver Information */}
            {result.driver && (
              <div
                style={{
                  padding: 24,
                  background: "#f0f9ff",
                  border: "2px solid #0891b2",
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: 16,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0c4a6e",
                  }}
                >
                  🚗 Driver Information
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Name
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.driver.name}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Role
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.driver.role === "DRIVER"
                        ? "🚗 Driver"
                        : result.driver.role === "HELPER"
                          ? "👷 Helper"
                          : result.driver.role || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      ID Number
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.driver.id_number}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      License Status
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: getLicenseStatusColor(
                          result.driver.license_status,
                        ),
                      }}
                    >
                      {result.driver.license_status}
                      {result.driver.license_expiry_days !== undefined &&
                        ` (${result.driver.license_expiry_days}d)`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Helper Information */}
            {result.helper && (
              <div
                style={{
                  padding: 24,
                  background: "#fef3c7",
                  border: "2px solid #f59e0b",
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: 16,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#78350f",
                  }}
                >
                  👷 Helper Information
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Name
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.helper.name}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Role
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.helper.role === "DRIVER"
                        ? "🚗 Driver"
                        : result.helper.role === "HELPER"
                          ? "👷 Helper"
                          : result.helper.role || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      ID Number
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.helper.id_number}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      License Status
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: getLicenseStatusColor(
                          result.helper.license_status,
                        ),
                      }}
                    >
                      {result.helper.license_status}
                      {result.helper.license_expiry_days !== undefined &&
                        ` (${result.helper.license_expiry_days}d)`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bypass Verification - Show if driver not found */}
            {!result.overall_authorized &&
              !result.driver &&
              !isBypassResult && (
                <div
                  style={{
                    padding: 24,
                    background: "#fef3c7",
                    border: "2px solid #f59e0b",
                    borderRadius: 12,
                    marginBottom: 20,
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      marginBottom: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#92400e",
                    }}
                  >
                    Bypass Verification
                  </h4>
                  <p
                    style={{
                      margin: "0 0 16px 0",
                      color: "#78350f",
                      fontSize: 14,
                    }}
                  >
                    Driver face verification failed. Enter driver's Aadhar ID to
                    verify manually.
                  </p>

                  {error && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 10,
                        background: "#fee2e2",
                        border: "1px solid #ef4444",
                        borderRadius: 6,
                        color: "#dc2626",
                        fontSize: 13,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#78350f",
                          }}
                        >
                          Aadhar ID (12 digits)
                        </span>
                        {bypassId && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: bypassAadharValidation.isValid
                                ? "#22c55e"
                                : "#f59e0b",
                            }}
                          >
                            {bypassAadharValidation.message}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Enter 12-digit Aadhar ID"
                        value={bypassId}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 12);
                          setBypassId(val);
                        }}
                        maxLength={12}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          fontSize: 14,
                          border: `2px solid ${
                            bypassId
                              ? bypassAadharValidation.isValid
                                ? "#22c55e"
                                : "#f59e0b"
                              : "#d1d5db"
                          }`,
                          borderRadius: 8,
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      onClick={submitBypass}
                      disabled={
                        !bypassAadharValidation.isValid || bypassSubmitting
                      }
                      style={{
                        padding: "12px 24px",
                        fontSize: 14,
                        fontWeight: 600,
                        background:
                          bypassAadharValidation.isValid && !bypassSubmitting
                            ? "#f59e0b"
                            : "#d1d5db",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor:
                          bypassAadharValidation.isValid && !bypassSubmitting
                            ? "pointer"
                            : "not-allowed",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {bypassSubmitting ? "Verifying..." : "Verify by ID"}
                    </button>
                  </div>
                </div>
              )}

            {/* Camera Detection Details */}
            <div
              style={{
                padding: 20,
                background: "#f9fafb",
                border: "2px solid #e5e7eb",
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <h4
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                📹 Camera Detection Details
              </h4>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Camera 1 (Left/Driver):</strong>{" "}
                  {result.person_left?.face_detected
                    ? result.person_left.match_found
                      ? `✅ ${result.person_left.name} (${result.person_left.role})`
                      : "⚠️ Face detected but not matched"
                    : "❌ No face detected"}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Camera 2 (Right/Helper):</strong>{" "}
                  {result.person_right
                    ? result.person_right.face_detected
                      ? result.person_right.match_found
                        ? `✅ ${result.person_right.name} (${result.person_right.role})`
                        : "⚠️ Face detected but not matched"
                      : "❌ No face detected"
                    : "⚪ Not provided"}
                </p>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={reset}
              style={{
                width: "100%",
                padding: 16,
                fontSize: 16,
                fontWeight: 600,
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              🔄 Verify Another Entry
            </button>
          </div>

          {/* Right: Traffic Light */}
          <div
            style={{
              flexShrink: 0,
              position: "sticky",
              top: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px",
              background: "#f9fafb",
              borderRadius: 16,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <TrafficLight activeLight={getActiveTrafficLight()} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TwoCameraVerification;
