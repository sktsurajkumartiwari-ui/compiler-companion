import type { AssistantState } from "../hooks/useVoiceAssistant";

export interface VoiceButtonProps {
  state: AssistantState;
  onClick: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
}

export function VoiceButton({ state, onClick, title, size = "md" }: VoiceButtonProps) {
  const getButtonContent = () => {
    switch (state) {
      case "listening":
        return (
          <span className="mic-listening-content">
            <span className="pulsing-red-dot"></span>
            <span className="mic-icon">🎙️</span>
          </span>
        );
      case "speaking":
        return (
          <span className="mic-speaking-content">
            <span className="mini-wave"></span>
            <span className="mini-wave"></span>
            <span className="mini-wave"></span>
          </span>
        );
      case "processing":
        return <span className="mic-processing-spinner">✦</span>;
      case "error":
        return <span className="mic-error-icon">⚠️</span>;
      default:
        return <span className="mic-icon">🎙️</span>;
    }
  };

  const getTooltip = () => {
    if (title) return title;
    switch (state) {
      case "listening":
        return "Listening to your voice (Click to stop)";
      case "speaking":
        return "GOAT is speaking (Click to interrupt & speak)";
      case "processing":
        return "GOAT is thinking...";
      case "error":
        return "Voice error (Click to retry)";
      default:
        return "Click to speak with GOAT";
    }
  };

  return (
    <button
      type="button"
      className={`gpt-voice-btn size-${size} state-${state}`}
      onClick={onClick}
      title={getTooltip()}
      aria-label={getTooltip()}
    >
      {getButtonContent()}
    </button>
  );
}
