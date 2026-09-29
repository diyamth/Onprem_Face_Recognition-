import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import FaceCapture from "../components/FaceCapture";
import TrafficLight from "../components/TrafficLight";
import {
  createAudioManager,
  VERIFICATION_MESSAGES,
} from "../utils/audioVerification";

const Verification: React.FC = () => {
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Audio manager
  const audioManagerRef = useRef(createAudioManager());

  // Setup and cleanup audio on mount
  useEffect(() => {
    audioManagerRef.current.reset();

    return () => {
      audioManagerRef.current.cleanup();
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [bypassId, setBypassId] = useState("");
  const [bypassSubmitting, setBypassSubmitting] = useState(false);
  const [isBypassResult, setIsBypassResult] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  const hasVerifiedRef = useRef(false);

  // Auto-submit verification when face is captured
  useEffect(() => {
    if (faceImage && !submitting && !result && !hasVerifiedRef.current) {
      // Mark as verified to prevent duplicate calls
      hasVerifiedRef.current = true;

      // Auto-trigger verification
      const autoVerify = async () => {
        setSubmitting(true);
        setError(null);
        setResult(null);

        // Speak verifying message
        audioManagerRef.current.speak(
          VERIFICATION_MESSAGES.verifying,
          "verifying",
        );

        try {
          const response = await axios.post(
            "http://localhost:8000/api/verify",
            {
              face_image: faceImage,
            },
          );

          setRequestId(response.data.request_id);
          setStatusMessage(
            "Verification request submitted! Checking result...",
          );

          // Auto-check result after a short delay
          setTimeout(async () => {
            try {
              const resultResponse = await axios.get(
                `http://localhost:8000/api/verify/${response.data.request_id}`,
              );
              setResult(resultResponse.data);
              setStatusMessage(null);

              // Reset audio and speak result (force to ensure it plays)
              audioManagerRef.current.reset();
              console.log(
                "[Verification] Result received:",
                resultResponse.data.match ? "SUCCESS" : "FAILED",
              );
              setTimeout(() => {
                if (resultResponse.data.match) {
                  console.log("[Verification] Speaking success message");
                  audioManagerRef.current.speak(
                    VERIFICATION_MESSAGES.success,
                    "success",
                    true,
                  );
                } else {
                  console.log("[Verification] Speaking failed message");
                  audioManagerRef.current.speak(
                    VERIFICATION_MESSAGES.failed,
                    "failed",
                    true,
                  );
                }
              }, 100);
            } catch {
              setError("Failed to fetch verification result");
              audioManagerRef.current.speak(
                VERIFICATION_MESSAGES.error,
                "error",
                true,
              );
            }
          }, 1500);
        } catch (err: any) {
          const errorMsg =
            err.response?.data?.detail?.[0]?.msg ||
            "Verification failed. Please try again.";
          setError(errorMsg);
          audioManagerRef.current.speak(
            VERIFICATION_MESSAGES.error,
            "error",
            true,
          );
        } finally {
          setSubmitting(false);
        }
      };

      autoVerify();
    }
  }, [faceImage, submitting, result]);

  const checkResult = async (requestIdToCheck: string) => {
    setChecking(true);
    try {
      const response = await axios.get(
        `http://localhost:8000/api/verify/${requestIdToCheck}`,
      );
      setResult(response.data);
    } catch (err: any) {
      console.error("Error checking result:", err);
      setError("Failed to fetch verification result");
    } finally {
      setChecking(false);
    }
  };

  const reset = () => {
    setFaceImage(null);
    setRequestId(null);
    setResult(null);
    setError(null);
    setBypassId("");
    setIsBypassResult(false);
    hasVerifiedRef.current = false;
    audioManagerRef.current.reset();
  };

  const submitBypass = async () => {
    if (!bypassAadharValidation.isValid || bypassSubmitting) return;

    setBypassSubmitting(true);
    setError(null);

    try {
      const response = await axios.post(
        `http://localhost:8000/api/verify/bypass/${bypassId.trim()}`,
      );
      setResult(response.data);
      setRequestId(response.data.request_id);
      setIsBypassResult(true);
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

  const getLicenseStatusColor = (status: string) => {
    switch (status) {
      case "VALID":
        return "#22c55e"; // green
      case "EXPIRING_SOON":
        return "#f59e0b"; // amber
      case "EXPIRED":
        return "#ef4444"; // red
      case "NOT_AUTHORIZED":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  const getLicenseStatusIcon = (status: string) => {
    switch (status) {
      case "VALID":
        return "✓";
      case "EXPIRING_SOON":
        return "⚠";
      case "EXPIRED":
        return "✕";
      case "NOT_AUTHORIZED":
        return "✕";
      default:
        return "?";
    }
  };

  // Determine which traffic light should be active
  const getActiveTrafficLight = (): "green" | "amber" | "red" | null => {
    if (!result) return null;

    // Unauthorized user or no match
    if (!result.match) return "red";

    // Authorized user - check license status
    const licenseStatus = result.license_status?.status;
    if (licenseStatus === "VALID") return "green";
    if (licenseStatus === "EXPIRING_SOON") return "amber";
    if (licenseStatus === "EXPIRED" || licenseStatus === "NOT_AUTHORIZED")
      return "red";
    return "green";
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        padding: "40px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "left", marginLeft: 25, marginBottom: 30 }}>
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
          Face Verification
        </h2>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          Capture your face to verify your identity
        </p>
      </div>

      {!result ? (
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
            <FaceCapture onCapture={setFaceImage} enableAudio={true} />

            {faceImage && (
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
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
                  ✓ Face Captured Successfully
                </p>
                <img
                  src={faceImage}
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

          {/* Form Section */}
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

            {statusMessage && (
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
                  {statusMessage}
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
              {submitting
                ? "Verifying your identity, please wait..."
                : "Your face will be automatically verified after capture."}
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 30,
            alignItems: "flex-start",
          }}
        >
          {/* Left: Result Cards */}
          <div style={{ flex: 1 }}>
            {/* Main Result Card */}
            <div
              style={{
                padding: 30,
                background: result.match
                  ? "#dcfce7"
                  : result.status === "PENDING"
                    ? "#fef3c7"
                    : "#fee2e2",
                border: result.match
                  ? "2px solid #22c55e"
                  : result.status === "PENDING"
                    ? "2px solid #f59e0b"
                    : "2px solid #ef4444",
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
                  color: result.match
                    ? "#16a34a"
                    : result.status === "PENDING"
                      ? "#d97706"
                      : "#dc2626",
                }}
              >
                {result.match
                  ? isBypassResult
                    ? "✅ Aadhar ID Verified!"
                    : "✅ Face Matched!"
                  : result.status === "PENDING"
                    ? "⏳ Verification In Progress"
                    : isBypassResult
                      ? "❌ Aadhar ID Not Found"
                      : "❌ Face Not Matched"}
              </h3>

              {result.pipeline_message && (
                <p
                  style={{
                    margin: 0,
                    color: "#666",
                    fontSize: 14,
                    fontStyle: "italic",
                  }}
                >
                  {result.pipeline_message}
                </p>
              )}
            </div>

            {/* User Information Card - Only show if matched */}
            {result.match && result.user_info && (
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
                  👤 User Information
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
                      {result.user_info.name}
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
                      {result.user_info.role === "DRIVER"
                        ? "🚗 Driver"
                        : result.user_info.role === "HELPER"
                          ? "👷 Helper"
                          : result.user_info.role || "N/A"}
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
                      Vendor
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.user_info.vendor_name}
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
                      ID Type
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {result.user_info.id_type}
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
                      {result.user_info.id_number}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* License Status Card - Only show if matched */}
            {result.match && result.license_status && (
              <div
                style={{
                  padding: 24,
                  background:
                    result.license_status.status === "VALID"
                      ? "#f0fdf4"
                      : result.license_status.status === "EXPIRING_SOON"
                        ? "#fef3c7"
                        : "#fee2e2",
                  border: `2px solid ${getLicenseStatusColor(
                    result.license_status.status,
                  )}`,
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
                    color:
                      result.license_status.status === "VALID"
                        ? "#15803d"
                        : result.license_status.status === "EXPIRING_SOON"
                          ? "#b45309"
                          : "#7f1d1d",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20 }}>
                    {getLicenseStatusIcon(result.license_status.status)}
                  </span>
                  License Status
                </h4>

                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 16,
                    fontWeight: 700,
                    color: getLicenseStatusColor(result.license_status.status),
                  }}
                >
                  {result.license_status.status === "VALID"
                    ? "✓ License Valid"
                    : result.license_status.status === "EXPIRING_SOON"
                      ? "⚠ License Expiring Soon"
                      : "✕ License Expired"}
                </p>

                <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
                  {result.license_status.message}
                </p>

                {result.license_status.days_remaining !== null &&
                  result.license_status.days_remaining !== undefined && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: `1px solid ${getLicenseStatusColor(
                          result.license_status.status,
                        )}`,
                        fontSize: 14,
                        fontWeight: 600,
                        color:
                          result.license_status.status === "VALID"
                            ? "#15803d"
                            : result.license_status.status === "EXPIRING_SOON"
                              ? "#b45309"
                              : "#7f1d1d",
                      }}
                    >
                      Days Remaining: {result.license_status.days_remaining}
                    </div>
                  )}
              </div>
            )}

            {/* Not Authorized Card - Show if no match */}
            {!result.match &&
              result.license_status?.status === "NOT_AUTHORIZED" && (
                <div
                  style={{
                    padding: 24,
                    background: "#fee2e2",
                    border: "2px solid #ef4444",
                    borderRadius: 12,
                    marginBottom: 20,
                    textAlign: "center",
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      marginBottom: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#7f1d1d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>✕</span>
                    Not Authorized
                  </h4>

                  <p
                    style={{
                      margin: 0,
                      color: "#dc2626",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {result.license_status.message}
                  </p>
                </div>
              )}

            {/* Bypass Verification - Show if face match failed */}
            {!result.match && (
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
                  Face verification failed. Enter your Aadhar ID to verify
                  manually.
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
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
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

            {/* Status Check Button */}
            {result.status === "PENDING" && (
              <button
                onClick={() => checkResult(requestId!)}
                disabled={checking}
                style={{
                  marginBottom: 16,
                  width: "100%",
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: checking ? "not-allowed" : "pointer",
                  opacity: checking ? 0.7 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                {checking ? "Checking..." : "🔄 Check Status"}
              </button>
            )}

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
              🔄 Verify Another User
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
      )}
    </div>
  );
};

export default Verification;
