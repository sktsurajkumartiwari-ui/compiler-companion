import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, ChatMessage, PatchProposal } from "@compiler-companion/shared";
import type { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { MarkdownMessage } from "./MarkdownMessage";

interface NovaPanelProps {
  thinking: boolean;
  analysis: AnalysisResult | null;
  messages?: ChatMessage[];
  prompt: string;
  voice: ReturnType<typeof useVoiceAssistant>;
  onClearChat?: () => void;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onApplyPatch: (patch?: PatchProposal) => void;
  onReviewDiff?: (original: string, replacement: string, reason?: string) => void;
  onClose?: () => void;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  mode?: "docked" | "popup" | "fullscreen";
  onToggleMode?: () => void;
  onToggleFullscreen?: () => void;
}

export function NovaPanel({
  thinking,
  analysis,
  messages = [],
  prompt,
  voice,
  onClearChat,
  onPromptChange,
  onSubmit,
  onApplyPatch,
  onReviewDiff,
  onClose,
  onHeaderMouseDown,
  mode = "docked",
  onToggleMode,
  onToggleFullscreen,
}: NovaPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "context" | "compose">("chat");
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const handleCopyCode = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, analysis, thinking]);

  useEffect(() => {
    if (mode !== "fullscreen" || !onToggleFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onToggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onToggleFullscreen]);

  return (
    <aside
      className={`ide-ai-panel ${mode === "docked" ? "docked-mode" : mode === "fullscreen" ? "fullscreen-mode" : "popup-mode"}`}
      aria-label="GOAT AI Assistant"
    >
      {/* Immersive Hands-Free GPT Voice Mode Overlay */}
      <VoiceModeOverlay
        voice={voice}
        onClose={voice.exitVoiceMode}
        lastQuery={prompt}
        lastResponse={analysis?.speechText || analysis?.summary}
      />

      {/* AI Assistant Header matching screenshot */}
      <div
        className="ai-panel-header"
        onMouseDown={mode === "popup" ? onHeaderMouseDown : undefined}
        style={{ cursor: mode === "popup" ? "move" : "default" }}
      >
        <div className="ai-header-title-group">
          <span className="ai-header-title">GOAT AI</span>
          <span className="ai-beta-badge">BETA</span>
        </div>

        <div className="ai-header-actions">
          {onClearChat && (messages.length > 0 || analysis) && (
            <button
              type="button"
              className="ai-action-icon-btn"
              onClick={onClearChat}
              title="Clear conversation"
            >
              🗑
            </button>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              className="ai-action-icon-btn fullscreen-btn"
              onClick={onToggleFullscreen}
              title={mode === "fullscreen" ? "Exit Fullscreen (Esc)" : "Full Screen AI"}
            >
              {mode === "fullscreen" ? "🗗" : "⛶"}
            </button>
          )}

          {mode !== "fullscreen" && onToggleMode && (
            <button
              type="button"
              className="ai-action-icon-btn"
              onClick={onToggleMode}
              title={mode === "docked" ? "Pop out to floating window" : "Dock to right sidebar"}
            >
              {mode === "docked" ? "↗" : "⇲"}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="ai-action-icon-btn"
              onClick={onClose}
              title="Close GOAT AI Assistant"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Mode Sub-Tabs: Chat, Context, Compose */}
      <div className="ai-mode-tabs">
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === "context" ? "active" : ""}`}
          onClick={() => setActiveTab("context")}
        >
          Context
        </button>
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === "compose" ? "active" : ""}`}
          onClick={() => setActiveTab("compose")}
        >
          Compose
        </button>
      </div>

      {/* AI Chat Body */}
      <div className="ai-chat-body" ref={conversationRef}>
        {/* GOAT AI Status & Greeting */}
        <div className="ai-identity-row">
          <div className="ai-identity-name">
            <span className="sparkle-icon">🐐</span>
            <span>GOAT AI</span>
          </div>
          <div className="ai-online-status">
            <span className="status-green-dot">●</span>
            <span>Online</span>
          </div>
        </div>

        {/* Dynamic Voice Visualizer if active */}
        <VoiceVisualizer
          state={voice.assistantState}
          interimText={voice.interimText}
          error={voice.error}
          onInterrupt={voice.interrupt}
        />

        {/* Welcome Card & Action Chips (When empty or starting) */}
        {messages.length === 0 && !analysis && (
          <>
            <div className="ai-welcome-card">
              <p className="welcome-greeting">
                Hey Suraj! I&apos;m GOAT, your AI coding assistant.
              </p>
              <p className="welcome-subtext">How can I help you today?</p>
            </div>

            {/* Quick Action Chips from screenshot */}
            <div className="ai-quick-actions-list">
              <button
                type="button"
                className="quick-action-chip"
                onClick={() => onPromptChange("Explain this code step-by-step with clear comments")}
              >
                <span className="chip-icon">📖</span>
                <span>Explain this code</span>
              </button>

              <button
                type="button"
                className="quick-action-chip"
                onClick={() => onPromptChange("Find all bugs, edge cases, and issues in this code")}
              >
                <span className="chip-icon">🪲</span>
                <span>Find bugs &amp; issues</span>
              </button>

              <button
                type="button"
                className="quick-action-chip"
                onClick={() =>
                  onPromptChange(
                    "Optimize this code and analyze its Big-O time and space complexity",
                  )
                }
              >
                <span className="chip-icon">⚡</span>
                <span>Optimize this code</span>
              </button>

              <button
                type="button"
                className="quick-action-chip"
                onClick={() =>
                  onPromptChange("Generate comprehensive unit test cases for this code")
                }
              >
                <span className="chip-icon">🧪</span>
                <span>Generate tests</span>
              </button>

              <button
                type="button"
                className="quick-action-chip"
                onClick={() =>
                  onPromptChange(
                    "Refactor this code to follow clean architecture and best practices",
                  )
                }
              >
                <span className="chip-icon">🛠</span>
                <span>Refactor selection</span>
              </button>
            </div>
          </>
        )}

        {/* Multi-turn Chat Conversation Stream */}
        {messages.length > 0 && (
          <div className="chat-messages-stream">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message-bubble ${msg.role}`}>
                <div className="bubble-header">
                  <span className="bubble-role">{msg.role === "user" ? "You" : "GOAT"}</span>
                  {msg.speechText && (
                    <button
                      type="button"
                      className="listen-bubble-btn"
                      onClick={() => {
                        if (voice.isSpeaking) {
                          voice.stopSpeaking();
                        } else {
                          voice.speak(msg.speechText || msg.content);
                        }
                      }}
                      title="Listen to this message"
                    >
                      {voice.isSpeaking ? "⏹ Stop" : "🔊 Listen"}
                    </button>
                  )}
                </div>
                <div className="bubble-body">
                  {msg.role === "user" ? (
                    <p className="user-message-text">{msg.content}</p>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}
                </div>

                {msg.patch && (
                  <div className="patch-container in-bubble">
                    <div className="patch-header">
                      <div className="patch-header-row">
                        <span>PROPOSED CODE ({msg.patch.file})</span>
                        <button
                          type="button"
                          className="copy-code-btn"
                          onClick={() => handleCopyCode(msg.patch?.replacement ?? "")}
                          title="Copy code to clipboard"
                        >
                          {copied ? "✓ Copied!" : "📋 Copy"}
                        </button>
                      </div>
                      {msg.patch.reason && <small>{msg.patch.reason}</small>}
                    </div>

                    <pre className="patch-code-preview">{msg.patch.replacement}</pre>

                    <div className="patch-actions-row">
                      {onReviewDiff && (
                        <button
                          type="button"
                          className="ghost review-diff-btn"
                          onClick={() =>
                            onReviewDiff(
                              msg.patch!.original,
                              msg.patch!.replacement,
                              msg.patch!.reason,
                            )
                          }
                          title="Inspect side-by-side in Monaco Diff Viewer"
                        >
                          ◫ Review Diff
                        </button>
                      )}
                      <button
                        type="button"
                        className="apply-patch-btn"
                        onClick={() => onApplyPatch(msg.patch)}
                      >
                        ✦ Apply to Editor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Single Analysis Result fallback */}
        {messages.length === 0 && analysis && (
          <article className="analysis">
            <div className="analysis-top-row">
              <b>{analysis.classification.toUpperCase()}</b>
              {analysis.summary && (
                <button
                  type="button"
                  className="listen-msg-btn"
                  onClick={() => {
                    if (voice.isSpeaking) {
                      voice.stopSpeaking();
                    } else {
                      voice.speak(analysis.speechText || analysis.summary);
                    }
                  }}
                  title={voice.isSpeaking ? "Stop speaking" : "Listen to this explanation"}
                >
                  {voice.isSpeaking ? "⏹ Stop" : "🔊 Listen"}
                </button>
              )}
            </div>
            <div className="analysis-summary">
              <MarkdownMessage content={analysis.summary} />
            </div>

            {analysis.patch && (
              <div className="patch-container">
                <div className="patch-header">
                  <div className="patch-header-row">
                    <span>PROPOSED CODE</span>
                    <button
                      type="button"
                      className="copy-code-btn"
                      onClick={() => handleCopyCode(analysis.patch?.replacement ?? "")}
                      title="Copy code to clipboard"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  {analysis.patch.reason && <small>{analysis.patch.reason}</small>}
                </div>

                <pre className="patch-code-preview">{analysis.patch.replacement}</pre>

                <div className="patch-actions-row">
                  {onReviewDiff && (
                    <button
                      type="button"
                      className="ghost review-diff-btn"
                      onClick={() =>
                        onReviewDiff(
                          analysis.patch!.original,
                          analysis.patch!.replacement,
                          analysis.patch!.reason,
                        )
                      }
                      title="Inspect side-by-side in Monaco Diff Viewer"
                    >
                      ◫ Review Diff
                    </button>
                  )}
                  <button
                    type="button"
                    className="apply-patch-btn"
                    onClick={() => onApplyPatch(analysis.patch)}
                  >
                    ✦ Apply to Editor
                  </button>
                </div>
              </div>
            )}
          </article>
        )}
      </div>

      {/* AI Input Area at Bottom matching screenshot */}
      <div className="ai-input-container">
        <textarea
          rows={2}
          className="ai-textarea-input"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!thinking && prompt.trim()) onSubmit();
            }
          }}
          placeholder={
            voice.isListening
              ? "Listening to your voice..."
              : thinking
                ? "GOAT is thinking..."
                : "Ask GOAT anything..."
          }
          disabled={thinking}
        />

        <div className="ai-input-controls-row">
          <div className="input-left-controls">
            <button
              type="button"
              className={`input-tool-btn mic ${voice.isListening ? "listening" : ""}`}
              onClick={voice.isSpeaking ? voice.interrupt : voice.toggleListening}
              title={voice.isListening ? "Stop listening" : "Click to speak with GOAT"}
            >
              🎙️
            </button>

            <button
              type="button"
              className="voice-mode-pill-btn"
              onClick={voice.enterVoiceMode}
              title="Open Hands-Free Voice Mode"
            >
              Hands-Free Voice
            </button>

            <div className="model-picker-wrapper">
              <span className="model-badge-tag">GPT-4o</span>
            </div>
          </div>

          <button
            type="button"
            className="ai-send-btn"
            onClick={onSubmit}
            disabled={thinking || !prompt.trim()}
            title="Send to GOAT (Enter)"
          >
            {thinking ? "…" : "➤"}
          </button>
        </div>
      </div>
    </aside>
  );
}
