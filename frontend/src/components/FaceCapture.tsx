import { FaceDetection } from "@mediapipe/face_detection";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  createAudioManager,
  FACE_CAPTURE_MESSAGES,
} from "../utils/audioVerification";

const WebcamComponent = Webcam as unknown as React.FC<any>;

/* ---- Tunable UX thresholds ---- */
const MIN_FACE_WIDTH_RATIO = 0.3;
const MAX_FACE_WIDTH_RATIO = 0.65;
const CENTER_TOLERANCE = 0.15;
const EDGE_MARGIN = 0.05;

/* ---- Auto-capture settings ---- */
const STABILITY_FRAMES_REQUIRED = 5; // ~1.25 seconds at 250ms interval
const COOLDOWN_MS = 6000; // 6 second cooldown after capture

type Props = {
  onCapture: (img: string) => void;
  enableAudio?: boolean;
  showVerifyingMessage?: boolean;
};

const FaceCapture: React.FC<Props> = ({
  onCapture,
  enableAudio = false,
  showVerifyingMessage = true,
}) => {
  const webcamRef = useRef<any>(null);
  const detectorRef = useRef<FaceDetection | null>(null);
  const isProcessingRef = useRef(false);

  // Auto-capture stability tracking
  const stableFrameCountRef = useRef(0);
  const hasCapturedRef = useRef(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio manager
  const audioManagerRef = useRef(createAudioManager());

  // Store onCapture in a ref to avoid recreating the detector
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const [message, setMessage] = useState("Align your face inside the oval");
  const [canCapture, setCanCapture] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const [stabilityProgress, setStabilityProgress] = useState(0);

  // Update audio manager when enableAudio changes
  useEffect(() => {
    audioManagerRef.current.setEnabled(enableAudio);
  }, [enableAudio]);

  // Preload voices and setup audio on mount
  useEffect(() => {
    audioManagerRef.current.reset();

    return () => {
      audioManagerRef.current.cleanup();
    };
  }, []);

  /* -----------------------------
     Initialize MediaPipe detector
  ------------------------------*/
  useEffect(() => {
    const detector = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    detector.setOptions({
      model: "short",
      minDetectionConfidence: 0.7,
    });

    detector.onResults((results) => {
      isProcessingRef.current = false; // ✅ Mark as done processing

      const video = webcamRef.current?.video;
      if (!video) return;

      // If already captured and in cooldown, skip processing
      if (hasCapturedRef.current) {
        return;
      }

      const detections = results.detections;

      // Helper to reset stability and set message with audio
      const resetStability = (
        msg: string,
        audioKey: keyof typeof FACE_CAPTURE_MESSAGES,
      ) => {
        stableFrameCountRef.current = 0;
        setStabilityProgress(0);
        setCanCapture(false);
        setMessage(msg);
        audioManagerRef.current.speak(
          FACE_CAPTURE_MESSAGES[audioKey],
          audioKey,
        );
      };

      if (!detections || detections.length !== 1) {
        resetStability("Ensure exactly one face is visible", "one_face");
        return;
      }

      const rect = detections[0].boundingBox;
      if (!rect) {
        resetStability("Face not detected", "align");
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const boxWidth = rect.width * vw;
      const boxHeight = rect.height * vh;
      const centerX = rect.xCenter * vw;
      const centerY = rect.yCenter * vh;

      const xMin = centerX - boxWidth / 2;
      const yMin = centerY - boxHeight / 2;

      const faceWidthRatio = boxWidth / vw;

      if (faceWidthRatio < MIN_FACE_WIDTH_RATIO) {
        resetStability("Move closer to the camera", "move_closer");
        return;
      }

      if (faceWidthRatio > MAX_FACE_WIDTH_RATIO) {
        resetStability("Move slightly away from the camera", "move_away");
        return;
      }

      if (
        Math.abs(centerX - vw / 2) > vw * CENTER_TOLERANCE ||
        Math.abs(centerY - vh / 2) > vh * CENTER_TOLERANCE
      ) {
        resetStability("Center your face inside the oval", "center");
        return;
      }

      if (
        xMin < vw * EDGE_MARGIN ||
        yMin < vh * EDGE_MARGIN ||
        xMin + boxWidth > vw * (1 - EDGE_MARGIN) ||
        yMin + boxHeight > vh * (1 - EDGE_MARGIN)
      ) {
        resetStability("Keep your full face inside the frame", "full_face");
        return;
      }

      // All conditions passed - increment stability counter
      stableFrameCountRef.current += 1;
      const progress = Math.min(
        (stableFrameCountRef.current / STABILITY_FRAMES_REQUIRED) * 100,
        100,
      );
      setStabilityProgress(progress);
      setCanCapture(true);

      if (stableFrameCountRef.current < STABILITY_FRAMES_REQUIRED) {
        const remaining =
          STABILITY_FRAMES_REQUIRED - stableFrameCountRef.current;
        setMessage(`Hold still... ${remaining}`);
        if (stableFrameCountRef.current === 1) {
          audioManagerRef.current.speak(
            FACE_CAPTURE_MESSAGES.hold_still,
            "hold_still",
          );
        }
      } else if (stableFrameCountRef.current === STABILITY_FRAMES_REQUIRED) {
        // Auto-capture!
        setMessage("Capturing...");
        audioManagerRef.current.speak(
          FACE_CAPTURE_MESSAGES.capturing,
          "capturing",
        );

        // Perform the capture
        const captureVideo = webcamRef.current?.video;
        if (captureVideo) {
          const canvas = document.createElement("canvas");
          const size = 160;
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext("2d")!;

          // Fill background with black
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, size, size);

          // Create oval clipping path
          ctx.save();
          ctx.beginPath();
          const ovalWidth = size * 0.65;
          const ovalHeight = size * 0.95;
          ctx.ellipse(
            size / 2,
            size / 2,
            ovalWidth / 2,
            ovalHeight / 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.clip();

          // Draw the video inside the oval only (mirrored)
          ctx.scale(-1, 1);
          ctx.translate(-size, 0);
          ctx.drawImage(captureVideo, 0, 0, size, size);
          ctx.restore();

          const imageData = canvas.toDataURL("image/jpeg", 0.85);

          // Mark as captured and set cooldown
          hasCapturedRef.current = true;
          setMessage(
            showVerifyingMessage
              ? "Face captured! Verifying..."
              : "Face captured!",
          );
          audioManagerRef.current.speak(
            FACE_CAPTURE_MESSAGES.captured,
            "captured",
          );

          // Send to parent using the ref
          onCaptureRef.current(imageData);

          // Set cooldown to allow new capture after some time
          cooldownTimeoutRef.current = setTimeout(() => {
            hasCapturedRef.current = false;
            stableFrameCountRef.current = 0;
            setStabilityProgress(0);
            setMessage("Align your face inside the oval");
          }, COOLDOWN_MS);
        }
      }
    });

    detectorRef.current = detector;

    return () => {
      detectorRef.current?.close();
      detectorRef.current = null;
      // Clean up timeouts
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------
     Run detection continuously
  ------------------------------*/
  useEffect(() => {
    const interval = setInterval(async () => {
      // ✅ Skip if already processing
      if (isProcessingRef.current) {
        return;
      }

      const video = webcamRef.current?.video;
      const detector = detectorRef.current;

      if (!video || !detector) return;

      // ✅ Ensure video is ready
      if (video.readyState !== 4) return;

      try {
        isProcessingRef.current = true;
        await detector.send({ image: video });
      } catch (error) {
        console.error("Face detection error:", error);
        isProcessingRef.current = false;
      }
    }, 250); // ✅ Slightly faster but still safe

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: "#F3F4F6",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: 0,
            fontSize: 18,
            color: "#333",
          }}
        >
          📸 Face Capture
        </h3>

        {/* Webcam Toggle Switch */}
        <button
          onClick={() => setWebcamEnabled(!webcamEnabled)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            background: webcamEnabled ? "#22c55e" : "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: webcamEnabled
              ? "0 2px 8px rgba(34, 197, 94, 0.3)"
              : "none",
          }}
        >
          <span style={{ fontSize: 14 }}>{webcamEnabled ? "🎥" : "🚫"}</span>
          {webcamEnabled ? "Webcam ON" : "Webcam OFF"}
        </button>
      </div>

      {webcamEnabled ? (
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <WebcamComponent
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            width={480}
            videoConstraints={{ facingMode: "user" }}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              transform: "scaleX(-1)",
            }}
          />

          {/* Oval guide with progress indicator */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 220,
              height: 300,
              border: `3px solid ${
                stabilityProgress >= 100
                  ? "#22c55e"
                  : stabilityProgress > 0
                    ? "#f59e0b"
                    : "#008080"
              }`,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              transition: "all 0.3s ease",
              boxShadow:
                stabilityProgress > 0
                  ? `0 0 20px ${
                      stabilityProgress >= 100
                        ? "rgba(34, 197, 94, 0.5)"
                        : "rgba(245, 158, 11, 0.5)"
                    }`
                  : "none",
            }}
          />

          {/* Stability progress bar */}
          {stabilityProgress > 0 && stabilityProgress < 100 && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 200,
                height: 6,
                background: "rgba(255,255,255,0.3)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${stabilityProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #f59e0b, #22c55e)",
                  borderRadius: 3,
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              textAlign: "center",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              padding: "24px 12px 12px",
              transition: "all 0.3s ease",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
            }}
          >
            {stabilityProgress >= 100 ? "✓ " : canCapture ? "⏳ " : "⚠ "}
            {message}
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 320,
            color: "#666",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          🚫 Webcam is turned off
        </div>
      )}

      {/* Auto-capture status indicator */}
      <div
        style={{
          marginTop: 16,
          width: "100%",
          padding: 14,
          fontSize: 14,
          fontWeight: 600,
          background:
            stabilityProgress >= 100
              ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
              : stabilityProgress > 0
                ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                : "#e5e7eb",
          color: stabilityProgress > 0 ? "white" : "#666",
          border: "none",
          borderRadius: 10,
          textAlign: "center",
          transition: "all 0.3s ease",
          boxShadow:
            stabilityProgress >= 100
              ? "0 4px 12px rgba(34, 197, 94, 0.4)"
              : stabilityProgress > 0
                ? "0 4px 12px rgba(245, 158, 11, 0.4)"
                : "none",
        }}
      >
        {stabilityProgress >= 100
          ? "✅ Auto-captured! "
          : stabilityProgress > 0
            ? `⏳ Hold still... Auto-capturing in ${STABILITY_FRAMES_REQUIRED - Math.floor(stabilityProgress / 20)}...`
            : "🔍 Align your face for auto-capture"}
      </div>
    </div>
  );
};

export default FaceCapture;
