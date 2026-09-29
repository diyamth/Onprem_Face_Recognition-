export type AudioMessageKey = string;

interface AudioConfig {
  rate?: number;
  pitch?: number;
  volume?: number;
  debounceMs?: number; // Time before allowing same message to repeat
}

const DEFAULT_CONFIG: Required<AudioConfig> = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  debounceMs: 3000,
};

class AudioVerificationManager {
  private lastMessage: string = "";
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private config: Required<AudioConfig>;
  private enabled: boolean = true;

  constructor(config: AudioConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.preloadVoices();
  }

  /**
   * Preload voices asynchronously
   */
  private preloadVoices(): void {
    if (!("speechSynthesis" in window)) {
      console.warn("[Audio] speechSynthesis not available");
      return;
    }

    // Try to get voices immediately
    const voices = window.speechSynthesis.getVoices();
    console.log("[Audio] Initial voices:", voices.length);

    // Also listen for when voices are loaded
    const handleVoicesChanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      console.log("[Audio] Voices loaded:", loadedVoices.length);
    };

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      handleVoicesChanged,
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  speak(text: string, messageKey?: string, force: boolean = false): void {
    if (!this.enabled) return;
    if (!text) return;

    const key = messageKey || text;

    // Don't repeat the same message within debounce period (unless forced)
    if (!force && this.lastMessage === key) {
      console.log("[Audio] Skipping repeated message:", key);
      return;
    }

    // Clear any pending debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.lastMessage = key;

    // Use Web Speech API
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferredVoice =
          voices.find((v) => v.name === "Samantha") ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }
      window.speechSynthesis.speak(utterance);
      console.log("[Audio] Speaking:", text);
    } else {
      console.warn("[Audio] speechSynthesis not available");
    }
    this.debounceTimeout = setTimeout(() => {
      this.lastMessage = "";
    }, this.config.debounceMs);
  }
  cancel(): void {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.lastMessage = "";
  }
  reset(): void {
    this.cancel();
  }
  cleanup(): void {
    this.cancel();
  }
}

/**
 * Create a new audio manager instance
 */
export const createAudioManager = (
  config?: AudioConfig,
): AudioVerificationManager => {
  return new AudioVerificationManager(config);
};

export const FACE_CAPTURE_MESSAGES = {
  align: "Please align your face inside the oval",
  one_face: "Ensure exactly one face is visible",
  move_closer: "Move closer to the camera",
  move_away: "Move slightly away from the camera",
  center: "Center your face inside the oval",
  full_face: "Keep your full face inside the frame",
  hold_still: "Hold still",
  capturing: "Capturing",
  captured: "Face captured successfully",
};

export const VERIFICATION_MESSAGES = {
  verifying: "Verifying your identity",
  success: "Verification successful. Welcome!",
  failed: "Verification failed. Please try again.",
  error: "An error occurred. Please try again.",
};

export default AudioVerificationManager;
