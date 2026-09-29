import axios from "axios";
import React, { useEffect, useState } from "react";

const PipelineControls: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/pipeline/status");
      setRunning(res.data.running);
    } catch (error) {
      console.error("Failed to fetch pipeline status", error);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const start = async () => {
    setLoading(true);
    try {
      await axios.post("http://localhost:8000/api/pipeline/start");
      setRunning(true);
    } catch (error) {
      alert("Failed to start pipeline");
    }
    setLoading(false);
  };

  const stop = async () => {
    setLoading(true);
    try {
      await axios.post("http://localhost:8000/api/pipeline/stop");
      setRunning(false);
    } catch (error) {
      alert("Failed to stop pipeline");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        padding: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Status Indicator */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: running
              ? "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)"
              : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            boxShadow: running
              ? "0 4px 12px rgba(13, 148, 136, 0.4)"
              : "0 4px 12px rgba(239, 68, 68, 0.4)",
          }}
        >
          {running ? "▶️" : "⏸️"}
        </div>

        <div>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: 18,
              fontWeight: 700,
              color: "#1f2937",
            }}
          >
            Pipeline Status
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: running ? "#0d9488" : "#ef4444",
                animation: running ? "pulse 2s infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: running ? "#0d9488" : "#ef4444",
              }}
            >
              {running ? "RUNNING" : "STOPPED"}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={start}
          disabled={running || loading}
          style={{
            padding: "12px 24px",
            fontSize: 15,
            fontWeight: 600,
            background:
              running || loading
                ? "#d1d5db"
                : "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
            color: "white",
            border: "none",
            borderRadius: 10,
            cursor: running || loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            boxShadow:
              running || loading ? "none" : "0 4px 12px rgba(13, 148, 136, 0.3)",
            opacity: running || loading ? 0.6 : 1,
          }}
        >
          {loading ? "⏳ Starting..." : "▶️ Start Pipeline"}
        </button>

        <button
          onClick={stop}
          disabled={!running || loading}
          style={{
            padding: "12px 24px",
            fontSize: 15,
            fontWeight: 600,
            background:
              !running || loading
                ? "#d1d5db"
                : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
            border: "none",
            borderRadius: 10,
            cursor: !running || loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            boxShadow:
              !running || loading
                ? "none"
                : "0 4px 12px rgba(239, 68, 68, 0.3)",
            opacity: !running || loading ? 0.6 : 1,
          }}
        >
          {loading ? "⏳ Stopping..." : "⏹️ Stop Pipeline"}
        </button>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default PipelineControls;
