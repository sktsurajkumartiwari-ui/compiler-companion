import {
  type useVoiceAssistant,
  isIndianVoice,
  isMaleVoice,
  isFemaleVoice,
} from "../hooks/useVoiceAssistant";

export interface VoiceModeOverlayProps {
  voice: ReturnType<typeof useVoiceAssistant>;
  onClose: () => void;
  lastQuery?: string;
  lastResponse?: string;
}

export function VoiceModeOverlay({
  voice,
  onClose,
  lastQuery,
  lastResponse,
}: VoiceModeOverlayProps) {
  if (!voice.isVoiceMode) return null;

  const getStatusHeadline = () => {
    switch (voice.assistantState) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      case "error":
        return "Voice Error";
      default:
        return "Tap to Speak";
    }
  };

  return (
    <div className="voice-mode-modal-backdrop" role="dialog" aria-modal="true">
      <div className="voice-mode-card">
        {/* Header */}
        <div className="voice-mode-header">
          <div className="voice-mode-brand">
            <span className="sparkle">✦</span>
            <div>
              <h3>GOAT Voice Mode</h3>
              <small>Hands-Free GPT Coding Companion</small>
            </div>
          </div>
          <button
            type="button"
            className="voice-mode-close-btn"
            onClick={onClose}
            title="Exit Voice Mode"
          >
            ✕ Exit
          </button>
        </div>

        {/* Central Orb Visualizer */}
        <div className="voice-mode-center">
          <div
            className={`voice-mode-huge-orb state-${voice.assistantState}`}
            onClick={() => {
              if (voice.assistantState === "speaking") {
                voice.interrupt();
              } else if (voice.assistantState === "listening") {
                voice.stopListening();
              } else {
                voice.startListening();
              }
            }}
            title="Click orb to speak or interrupt"
          >
            <div className="orb-layer-outer"></div>
            <div className="orb-layer-mid"></div>
            <div className="orb-layer-core"></div>
            <div className="orb-icon">
              {voice.assistantState === "listening"
                ? "🎙️"
                : voice.assistantState === "speaking"
                  ? "🔊"
                  : "✦"}
            </div>
          </div>

          <h2 className="voice-mode-status-title">{getStatusHeadline()}</h2>

          {/* Dynamic Waves */}
          <div className={`voice-mode-wave-bars state-${voice.assistantState}`}>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
            <span className="wave-line"></span>
          </div>
        </div>

        {/* Live Conversation Transcript Display */}
        <div className="voice-mode-dialogue-area">
          {(voice.interimText || voice.lastUserMessage || lastQuery) && (
            <div className="live-transcript-bubble user-bubble">
              <small>YOU</small>
              <p>&ldquo;{voice.interimText || voice.lastUserMessage || lastQuery}&rdquo;</p>
            </div>
          )}

          {voice.assistantState === "processing" && (
            <div className="live-transcript-bubble nova-bubble thinking-bubble">
              <small>GOAT</small>
              <p>✦ Thinking like a mentor...</p>
            </div>
          )}

          {(voice.lastAiMessage || voice.lastSpeechResponse || lastResponse) &&
            voice.assistantState !== "processing" && (
              <div className="live-transcript-bubble nova-bubble">
                <small>GOAT</small>
                <p>{voice.lastAiMessage || voice.lastSpeechResponse || lastResponse}</p>
              </div>
            )}

          {voice.error && <div className="voice-error-toast">⚠️ {voice.error}</div>}
        </div>

        {/* Footer Actions */}
        <div className="voice-mode-footer">
          <div className="voice-mode-toolbar-pills">
            <button
              type="button"
              className={`pill-btn ${voice.voiceGender === "male" ? "active" : ""}`}
              onClick={() => voice.setVoiceGender("male")}
              title="Male voice actor"
            >
              👨 Male
            </button>
            <button
              type="button"
              className={`pill-btn ${voice.voiceGender === "female" ? "active" : ""}`}
              onClick={() => voice.setVoiceGender("female")}
              title="Female voice actor"
            >
              👩 Female
            </button>
            <button
              type="button"
              className={`pill-btn ${voice.languageMode === "auto" ? "active" : ""}`}
              onClick={() => voice.setLanguageMode("auto")}
              title="Auto language match (Hinglish/English)"
            >
              🌐 Auto
            </button>
            <button
              type="button"
              className={`pill-btn ${voice.languageMode === "hindi" ? "active" : ""}`}
              onClick={() => voice.setLanguageMode("hindi")}
              title="Indian Hindi/Hinglish mode"
            >
              🇮🇳 Indian / Hindi
            </button>
            <button
              type="button"
              className={`pill-btn ${voice.languageMode === "english" ? "active" : ""}`}
              onClick={() => voice.setLanguageMode("english")}
              title="English mode"
            >
              🇺🇸 Eng
            </button>
          </div>

          {/* Voice Selector in Voice Mode */}
          {voice.voices.length > 0 && (
            <div className="voice-mode-voice-select-bar">
              <select
                value={voice.selectedVoiceURI}
                onChange={(e) => voice.changeVoice(e.target.value)}
                className="voice-mode-dropdown"
                title="Choose Indian or natural voice"
              >
                <option value="">
                  {voice.voiceGender === "male"
                    ? "✨ 🇮🇳 Indian / Natural Male (Auto)"
                    : "✨ 🇮🇳 Indian / Natural Female (Auto)"}
                </option>
                {voice.voices
                  .filter((v) =>
                    voice.voiceGender === "male" ? isMaleVoice(v.name) : isFemaleVoice(v.name),
                  )
                  .map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {isIndianVoice(v) ? "🇮🇳 " : ""}
                      {voice.voiceGender === "male" ? "👨 " : "👩 "}
                      {v.name.replace(/Microsoft |Online \(Natural\)|Google /g, "")} ({v.lang})
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="voice-mode-test-btn"
                onClick={voice.testVoice}
                title="Test how this Indian voice sounds"
              >
                ▶️ Test
              </button>
            </div>
          )}

          <div className="voice-mode-control-row">
            {voice.assistantState === "speaking" ? (
              <button
                type="button"
                className="voice-action-btn interrupt"
                onClick={voice.interrupt}
              >
                ✋ Tap to Interrupt & Speak
              </button>
            ) : voice.assistantState === "listening" ? (
              <button
                type="button"
                className="voice-action-btn listening"
                onClick={voice.stopListening}
              >
                ⏹ Stop Listening
              </button>
            ) : (
              <button
                type="button"
                className="voice-action-btn speak-now"
                onClick={voice.startListening}
              >
                🎙️ Tap to Speak
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
