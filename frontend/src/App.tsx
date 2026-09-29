import { useState } from "react";
import VerificationHistory from "./components/VerificationHistory";
import Register from "./pages/Register";
import TwoCameraVerification from "./pages/TwoCameraVerification";
import Users from "./pages/Users";

function App() {
  const [page, setPage] = useState<
    "register" | "users" | "verification" | "two-camera" | "history"
  >("register");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#E5E7EB",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1800,
            margin: "0 auto",
            padding: "15px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/HawkVision.svg"
              alt="HawkVision Logo"
              style={{
                width: 40,
                height: 40,
                objectFit: "contain",
              }}
            />
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: "#1F2937", // Tailwind gray-700
              }}
            >
              Face Recognition System
            </h1>
          </div>

          <nav style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setPage("register")}
              style={{
                padding: "10px 24px",
                fontSize: 18,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: page === "register" ? "#0d9488" : "transparent",
                color: page === "register" ? "white" : "#1F2937",
                transition: "all 0.3s ease",
                boxShadow:
                  page === "register"
                    ? "0 4px 12px rgba(13, 148, 136, 0.4)"
                    : "none",
              }}
            >
              📝 Register
            </button>

            <button
              onClick={() => setPage("users")}
              style={{
                padding: "10px 24px",
                fontSize: 18,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: page === "users" ? "#0d9488" : "transparent",
                color: page === "users" ? "white" : "#1F2937",
                transition: "all 0.3s ease",
                boxShadow:
                  page === "users"
                    ? "0 4px 12px rgba(13, 148, 136, 0.4)"
                    : "none",
              }}
            >
              🪪 Users
            </button>

            <button
              onClick={() => setPage("two-camera")}
              style={{
                padding: "10px 24px",
                fontSize: 18,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: page === "two-camera" ? "#0d9488" : "transparent",
                color: page === "two-camera" ? "white" : "#1F2937",
                transition: "all 0.3s ease",
                boxShadow:
                  page === "two-camera"
                    ? "0 4px 12px rgba(13, 148, 136, 0.4)"
                    : "none",
              }}
            >
              📹 Two-Camera
            </button>

            <button
              onClick={() => setPage("history")}
              style={{
                padding: "10px 24px",
                fontSize: 18,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: page === "history" ? "#0d9488" : "transparent",
                color: page === "history" ? "white" : "#1F2937",
                transition: "all 0.3s ease",
                boxShadow:
                  page === "history"
                    ? "0 4px 12px rgba(13, 148, 136, 0.4)"
                    : "none",
              }}
            >
              📋 History
            </button>
          </nav>
        </div>
      </div>

      {/* Pipeline Controls */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 30px" }}>
        {/* <PipelineControls /> */}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1150, margin: "0 auto", padding: "0 30px 40px" }}>
        {page === "register" ? (
          <Register />
        ) : page === "two-camera" ? (
          <TwoCameraVerification />
        ) : page === "history" ? (
          <VerificationHistory />
        ) : (
          <Users />
        )}
      </div>
    </div>
  );
}

export default App;
