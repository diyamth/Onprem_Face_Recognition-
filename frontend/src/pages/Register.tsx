import axios from "axios";
import React, { useState } from "react";
import FaceCapture from "../components/FaceCapture";

const Register: React.FC = () => {
  const [faceImage, setFaceImage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [aadharId, setAadharId] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [role, setRole] = useState<"DRIVER" | "HELPER">("DRIVER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const aadharValidation = validateAadhar(aadharId);

  const canSubmit =
    !!faceImage &&
    name.trim() &&
    aadharValidation.isValid &&
    vendorName.trim() &&
    licenseExpiry &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await axios.post("http://localhost:8000/api/register", {
        name,
        aadhar_id: aadharId.trim(),
        license_expiry: licenseExpiry,
        vendor_name: vendorName,
        role: role, // ✅ ADD ROLE
        id_type: "EMPLOYEE_ID",
        id_number: aadharId.trim(),
        face_image: faceImage,
      });

      // Check if the backend returned a FAILED status
      if (response.data.status === "FAILED") {
        setError(
          response.data.message || "Registration failed. Please try again.",
        );
        // Clear error after 3 seconds
        setTimeout(() => {
          setError(null);
        }, 3000);
        return;
      }

      setSuccess(true);

      // Reset form after a delay
      setTimeout(() => {
        setFaceImage(null);
        setName("");
        setAadharId("");
        setLicenseExpiry("");
        setVendorName("");
        setRole("DRIVER"); // Reset role to default
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail?.[0]?.msg ||
        err.response?.data?.message ||
        "Registration failed. Please try again.";
      setError(errorMsg);
      // Clear error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
      console.error("Registration error:", err);
    } finally {
      setSubmitting(false);
    }
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
      <div
        style={{
          textAlign: "center",
          marginBottom: 30,
        }}
      >
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            margin: "0 0 8px 0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Face Registration
        </h2>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          Capture your face and fill in your details to register
        </p>
      </div>

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
          <FaceCapture onCapture={setFaceImage} showVerifyingMessage={false} />

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
            Personal Information
          </h3>

          {success && (
            <div
              style={{
                marginBottom: 16,
                padding: 20,
                background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
                border: "2px solid #22c55e",
                borderRadius: 12,
                textAlign: "center",
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  background:
                    "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px auto",
                  boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h4
                style={{
                  margin: "0 0 6px 0",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#15803d",
                }}
              >
                Registration Successful!
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#166534",
                }}
              >
                User has been registered successfully
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: 16,
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
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
                  Registration Failed
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

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Full Name *
              </label>
              <input
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <label
                  style={{
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 14,
                  }}
                >
                  Aadhar ID *
                </label>
                {aadharId && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: aadharValidation.isValid ? "#22c55e" : "#f59e0b",
                    }}
                  >
                    {aadharValidation.message}
                  </span>
                )}
              </div>
              <input
                placeholder="Enter 12-digit Aadhar ID"
                value={aadharId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setAadharId(val);
                }}
                maxLength={12}
                style={{
                  ...inputStyle,
                  borderColor: aadharId
                    ? aadharValidation.isValid
                      ? "#22c55e"
                      : "#f59e0b"
                    : "#e5e7eb",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                License Expiry Date *
              </label>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Vendor Name *
              </label>
              <input
                placeholder="Enter vendor name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Role *
              </label>
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: "100%",
                }}
              >
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "DRIVER" | "HELPER")
                  }
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    paddingRight: 40,
                  }}
                >
                  <option value="DRIVER">Driver</option>
                  <option value="HELPER">Helper</option>
                </select>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 12,
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            disabled={!canSubmit}
            onClick={submit}
            style={{
              marginTop: 24,
              width: "100%",
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              background: canSubmit
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#9ca3af",
              color: "white",
              border: "none",
              borderRadius: 12,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.3s ease",
              boxShadow: canSubmit
                ? "0 4px 12px rgba(102, 126, 234, 0.4)"
                : "none",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "⏳ Registering..." : "✨ Register User"}
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  fontSize: 15,
  border: "2px solid #e5e7eb",
  borderRadius: 10,
  outline: "none",
  transition: "border-color 0.3s ease",
  fontFamily: "inherit",
};

export default Register;
