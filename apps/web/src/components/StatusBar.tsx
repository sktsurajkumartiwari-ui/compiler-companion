import type { ExecutionResult, WorkspaceFile } from "@compiler-companion/shared";

interface StatusBarProps {
  file: WorkspaceFile | null;
  result: ExecutionResult | null;
  isLocalMode: boolean;
  localFolderName: string | null;
  projectName: string | null;
  autoSaveEnabled: boolean;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

export function StatusBar({
  file,
  result,
  isLocalMode,
  localFolderName,
  projectName,
  autoSaveEnabled,
  isFocusMode,
  onToggleFocusMode,
}: StatusBarProps) {
  const lineCount = file?.content ? file.content.split("\n").length : 1;
  const diagnostics = result?.diagnostics || [];
  const errorsCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningsCount = diagnostics.filter((d) => d.severity === "warning").length;

  const branchOrFolder = isLocalMode
    ? `📁 ${localFolderName || "Local"}`
    : `⑂ ${projectName || "main"}`;

  const langLabel = file ? (file.language === "cpp" ? "C++ 20" : "Python 3.12") : "Plain Text";

  return (
    <footer className="ide-status-bar">
      <div className="status-bar-left">
        <div className="status-item branch" title="Active Branch / Workspace Folder">
          <span>{branchOrFolder}</span>
        </div>

        <div
          className="status-item problems"
          title={`${errorsCount} errors, ${warningsCount} warnings`}
        >
          <span className="error-dot">⨂ {errorsCount}</span>
          <span className="warning-dot">⚠ {warningsCount}</span>
        </div>

        <div className="status-item autosave">
          <small>{autoSaveEnabled ? "Auto-Save ON" : "Auto-Save OFF"}</small>
        </div>
      </div>

      <div className="status-bar-right">
        <div className="status-item">
          <span>Ln {lineCount}, Col 1</span>
        </div>

        <div className="status-item">
          <span>Spaces: 4</span>
        </div>

        <div className="status-item">
          <span>UTF-8</span>
        </div>

        <div className="status-item language-badge">
          <span>{langLabel}</span>
        </div>

        <button
          type="button"
          className={`status-item focus-btn ${isFocusMode ? "active" : ""}`}
          onClick={onToggleFocusMode}
          title="Toggle Distraction-Free Focus Mode"
        >
          📖 {isFocusMode ? "Exit Focus" : "Focus"}
        </button>
      </div>
    </footer>
  );
}
