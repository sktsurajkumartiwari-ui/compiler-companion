import Editor from "@monaco-editor/react";
import type { WorkspaceFile } from "@compiler-companion/shared";
import type { SaveStatus } from "../hooks/useWorkspace";

interface EditorPaneProps {
  file: WorkspaceFile | null;
  saveStatus?: SaveStatus;
  isLocalMode?: boolean;
  onOpenCreate: () => void;
  onCodeChange: (content: string) => void;
}

export function EditorPane({
  file,
  saveStatus = "saved",
  isLocalMode = false,
  onOpenCreate,
  onCodeChange,
}: EditorPaneProps) {
  const getSaveIndicator = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="tab-dirty-dot saving" title="Saving...">
            ◌
          </span>
        );
      case "unsaved":
        return (
          <span className="tab-dirty-dot" title="Unsaved changes">
            ●
          </span>
        );
      default:
        return null;
    }
  };

  const lineCount = file?.content ? file.content.split("\n").length : 0;
  const langIcon = file?.language === "cpp" ? "⚙️" : file?.language === "python" ? "🐍" : "📄";

  return (
    <section className="editor-pane-container">
      {file ? (
        <>
          {/* Tab Strip */}
          <div className="editor-tab-strip">
            <div className="tab-items-scroll">
              <div className="editor-tab-item active">
                <span className="file-type-icon">{langIcon}</span>
                <span className="tab-title-text">{file.name}</span>
                {getSaveIndicator()}
              </div>
            </div>

            <div className="editor-tab-actions">
              <span className="tab-lines-meta">{lineCount} lines</span>
              <button type="button" className="tab-action-btn" title="Split Editor Right">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
            </div>
          </div>

          {/* Breadcrumbs Bar */}
          <div className="editor-breadcrumbs-bar">
            <span className="breadcrumb-entry">
              <span className="breadcrumb-text">{isLocalMode ? "local-disk" : "workspace"}</span>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-text current">{file.name}</span>
            </span>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="monaco-wrapper-frame">
            <Editor
              height="100%"
              theme="vs-dark"
              language={file.language === "cpp" ? "cpp" : "python"}
              value={file.content}
              onChange={(content) => onCodeChange(content ?? "")}
              options={{
                automaticLayout: true,
                minimap: { enabled: true, maxColumn: 80, renderCharacters: false },
                padding: { top: 12, bottom: 20 },
                scrollBeyondLastLine: false,
                fontSize: 14,
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace",
                fontLigatures: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                renderLineHighlight: "all",
                roundedSelection: true,
                lineHeight: 22,
                tabSize: 4,
              }}
            />
          </div>
        </>
      ) : (
        <div className="empty-editor">
          <div className="empty-editor-icon">◈</div>
          <h2>Compiler Companion</h2>
          <p>Open a folder on your PC or create a cloud project to start coding.</p>
          <div className="empty-editor-actions">
            <button type="button" className="ide-action-btn run" onClick={onOpenCreate}>
              ＋ Create Project
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
