import { FaceDetection } from "@mediapipe/face_detection";

let detector: FaceDetection | null = null;

export function initFaceDetector(video: HTMLVideoElement) {
  detector = new FaceDetection({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });

  detector.setOptions({
    model: "short",
    minDetectionConfidence: 0.7,
  });

  detector.onResults(() => {});
}

export async function detectFace(video: HTMLVideoElement) {
  if (!detector) return null;
  await detector.send({ image: video });
}
