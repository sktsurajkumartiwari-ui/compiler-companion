import { useState } from "react";
import type { FileVersion, LanguageId } from "@compiler-companion/shared";
import { DiffViewerModal } from "./DiffViewerModal";

interface VersionHistoryModalProps {
  isOpen: boolean;
  fileName: string;
  currentContent: string;
  language: LanguageId;
  versions: FileVersion[];
  onRestore: (version: FileVersion) => void;
  onClose: () => void;
}

export function VersionHistoryModal({
  isOpen,
  fileName,
  currentContent,
  language,
  versions,
  onRestore,
  onClose,
}: VersionHistoryModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<FileVersion | null>(null);
  const [comparingVersion, setComparingVersion] = useState<FileVersion | null>(null);

  if (!isOpen) return null;

  const fileVersions = versions.filter((v) => v.fileName === fileName);

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal-content history-modal-content"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <header className="modal-header">
            <div className="diff-modal-title">
              <span className="diff-icon">⏳</span>
              <div>
                <h3>Version History — {fileName}</h3>
                <small>Review past snapshots, compare diffs, and restore code</small>
              </div>
            </div>
            <button type="button" className="close-btn" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="history-body">
            <div className="history-list-pane">
              <h4>Revisions ({fileVersions.length})</h4>
              {fileVersions.length === 0 ? (
                <div className="history-empty">
                  <p>No previous snapshots recorded yet.</p>
                  <small>
                    Versions are created automatically whenever you save or apply AI fixes.
                  </small>
                </div>
              ) : (
                <div className="history-items-list">
                  {fileVersions.map((v, idx) => {
                    const isSelected = selectedVersion?.id === v.id;
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={v.id}
                        className={`history-item ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedVersion(v)}
                      >
                        <div className="history-item-top">
                          <span className="history-label">{v.label || "Manual Save"}</span>
                          {isLatest && <span className="history-badge latest">Current</span>}
                        </div>
                        <div className="history-item-meta">
                          <span>{formatDate(v.timestamp)}</span>
                          <span>{formatTime(v.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="history-preview-pane">
              {selectedVersion ? (
                <>
                  <div className="history-preview-header">
                    <div>
                      <strong>Snapshot from {formatTime(selectedVersion.timestamp)}</strong>
                      <small>{selectedVersion.label || "Saved code snapshot"}</small>
                    </div>
                    <div className="history-preview-actions">
                      <button
                        type="button"
                        className="ghost compare-btn"
                        onClick={() => setComparingVersion(selectedVersion)}
                        title="Compare this snapshot against current code in Diff Viewer"
                      >
                        ◫ Compare with Current
                      </button>
                      <button
                        type="button"
                        className="run restore-btn"
                        onClick={() => {
                          onRestore(selectedVersion);
                          onClose();
                        }}
                        title="Restore this version into editor"
                      >
                        ↩ Restore this Version
                      </button>
                    </div>
                  </div>
                  <pre className="history-code-preview">{selectedVersion.content}</pre>
                </>
              ) : (
                <div className="history-preview-empty">
                  <p>Select a revision from the left to preview its content or inspect changes.</p>
                </div>
              )}
            </div>
          </div>

          <footer className="modal-footer">
            <button type="button" className="ghost" onClick={onClose}>
              Close
            </button>
          </footer>
        </div>
      </div>

      {comparingVersion && (
        <DiffViewerModal
          isOpen={true}
          language={language}
          title={`Comparing Snapshot (${formatTime(comparingVersion.timestamp)}) with Current Code`}
          reason={comparingVersion.label || "Snapshot comparison"}
          original={comparingVersion.content}
          modified={currentContent}
          onApply={() => onRestore(comparingVersion)}
          onClose={() => setComparingVersion(null)}
        />
      )}
    </>
  );
}
