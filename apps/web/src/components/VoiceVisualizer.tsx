import type { AssistantState } from "../hooks/useVoiceAssistant";

export interface VoiceVisualizerProps {
  state: AssistantState;
  interimText?: string;
  error?: string | null;
  onInterrupt?: () => void;
  variant?: "compact" | "full";
}

export function VoiceVisualizer({
  state,
  interimText,
  error,
  onInterrupt,
  variant = "compact",
}: VoiceVisualizerProps) {
  const getStatusMessage = () => {
    if (error) return error;
    switch (state) {
      case "listening":
        return interimText ? `"${interimText}"` : "Listening to you...";
      case "processing":
        return "Thinking like a mentor...";
      case "speaking":
        return "GOAT is explaining...";
      case "error":
        return "Voice recognition issue. Please check microphone.";
      default:
        return "Ready when you are";
    }
  };

  if (variant === "compact" && state === "idle" && !error) {
    return null;
  }

  return (
    <div className={`voice-visualizer-container variant-${variant} state-${state}`}>
      <div className="visualizer-orb-wrapper">
        <div className={`visualizer-glow-orb ${state}`}>
          <div className="inner-pulse"></div>
        </div>
      </div>

      <div className="visualizer-content">
        <div className="visualizer-waves">
          <span className="wave-bar bar-1"></span>
          <span className="wave-bar bar-2"></span>
          <span className="wave-bar bar-3"></span>
          <span className="wave-bar bar-4"></span>
          <span className="wave-bar bar-5"></span>
        </div>

        <div className="visualizer-status-text">
          <span className="status-badge">{state.toUpperCase()}</span>
          <p className="status-description">{getStatusMessage()}</p>
        </div>
      </div>

      {state === "speaking" && onInterrupt && (
        <button
          type="button"
          className="interrupt-btn"
          onClick={onInterrupt}
          title="Interrupt GOAT and start speaking"
        >
          ⏹ Interrupt
        </button>
      )}
    </div>
  );
}
