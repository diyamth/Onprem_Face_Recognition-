import React from "react";

interface TrafficLightProps {
  activeLight: "green" | "amber" | "red" | null;
}

const TrafficLight: React.FC<TrafficLightProps> = ({ activeLight }) => {
  const lights = [
    { color: "red", activeColor: "#ef4444", glowColor: "rgba(239, 68, 68, 0.6)" },
    { color: "amber", activeColor: "#f59e0b", glowColor: "rgba(245, 158, 11, 0.6)" },
    { color: "green", activeColor: "#22c55e", glowColor: "rgba(34, 197, 94, 0.6)" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          background: "linear-gradient(145deg, #1f2937, #374151)",
          borderRadius: 20,
          padding: "20px 16px",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)",
          border: "3px solid #4b5563",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lights.map((light) => {
            const isActive = activeLight === light.color;
            return (
              <div
                key={light.color}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: isActive ? light.activeColor : "#374151",
                  boxShadow: isActive
                    ? `0 0 20px ${light.glowColor}, 0 0 40px ${light.glowColor}, inset 0 -4px 8px rgba(0,0,0,0.3)`
                    : "inset 0 2px 4px rgba(0,0,0,0.4)",
                  border: `2px solid ${isActive ? light.activeColor : "#4b5563"}`,
                  animation: isActive ? "blink 1s ease-in-out infinite" : "none",
                  transition: "all 0.3s ease",
                }}
              />
            );
          })}
        </div>
      </div>
      <style>
        {`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
      <p
        style={{
          margin: "8px 0 0 0",
          fontSize: 12,
          fontWeight: 600,
          color:
            activeLight === "green"
              ? "#22c55e"
              : activeLight === "amber"
              ? "#f59e0b"
              : "#ef4444",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {activeLight === "green"
          ? "Authorized"
          : activeLight === "amber"
          ? "Expiring Soon"
          : "Not Authorized"}
      </p>
    </div>
  );
};

export default TrafficLight;
