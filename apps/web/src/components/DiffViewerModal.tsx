import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { LanguageId } from "@compiler-companion/shared";

interface DiffViewerModalProps {
  isOpen: boolean;
  original: string;
  modified: string;
  language: LanguageId;
  title?: string;
  reason?: string;
  onApply?: () => void;
  onClose: () => void;
}

export function DiffViewerModal({
  isOpen,
  original,
  modified,
  language,
  title = "Diff Viewer — Code Comparison",
  reason,
  onApply,
  onClose,
}: DiffViewerModalProps) {
  const [inlineView, setInlineView] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyModified = () => {
    void navigator.clipboard.writeText(modified);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop diff-modal-backdrop" onClick={onClose}>
      <div
        className="modal-content diff-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-header diff-modal-header">
          <div className="diff-modal-title">
            <span className="diff-icon">◈</span>
            <div>
              <h3>{title}</h3>
              {reason && <small>{reason}</small>}
            </div>
          </div>

          <div className="diff-modal-controls">
            <button
              type="button"
              className={`ghost diff-toggle-btn ${!inlineView ? "active" : ""}`}
              onClick={() => setInlineView(false)}
              title="Side-by-side comparison"
            >
              ◫ Split View
            </button>
            <button
              type="button"
              className={`ghost diff-toggle-btn ${inlineView ? "active" : ""}`}
              onClick={() => setInlineView(true)}
              title="Inline unified diff"
            >
              ☰ Inline
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handleCopyModified}
              title="Copy proposed replacement"
            >
              {copied ? "✓ Copied" : "📋 Copy Code"}
            </button>
            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              title="Close diff preview"
            >
              ×
            </button>
          </div>
        </header>

        <div className="diff-editor-container">
          <DiffEditor
            height="100%"
            theme="vs-dark"
            language={language === "cpp" ? "cpp" : "python"}
            original={original}
            modified={modified}
            options={{
              readOnly: true,
              renderSideBySide: !inlineView,
              automaticLayout: true,
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        <footer className="modal-footer diff-modal-footer">
          <div className="diff-legend">
            <span className="legend-remove">● Red: Removed / Original</span>
            <span className="legend-add">● Green: Added / Proposed</span>
          </div>

          <div className="diff-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            {onApply && (
              <button
                type="button"
                className="run apply-diff-btn"
                onClick={() => {
                  onApply();
                  onClose();
                }}
              >
                ✦ Apply Proposed Code
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
