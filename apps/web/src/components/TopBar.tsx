import { useState, useRef, useEffect } from "react";
import type { Project, WorkspaceFile } from "@compiler-companion/shared";

interface TopBarProps {
  project: Project | null;
  file: WorkspaceFile | null;
  isLocalMode: boolean;
  localFolderName: string | null;
  isRunning: boolean;
  thinking: boolean;
  autoSaveEnabled: boolean;
  isAiOpen: boolean;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  userEmail: string;
  onOpenCommandPalette: () => void;
  onOpenLocalFolder: () => void;
  onOpenCreateProject: () => void;
  onToggleAutoSave: () => void;
  onOpenTemplates: () => void;
  onOpenComplexity: () => void;
  onOpenHistory: () => void;
  onDownloadFile: () => void;
  onSave: () => void;
  onAutoFix: () => void;
  onRun: () => void;
  onToggleAi: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onOpenTour: () => void;
  onSignOut: () => void;
}

export function TopBar({
  project,
  file,
  isLocalMode,
  localFolderName,
  isRunning,
  thinking,
  autoSaveEnabled,
  isAiOpen,
  isSidebarOpen,
  isTerminalOpen,
  userEmail,
  onOpenCommandPalette,
  onOpenLocalFolder,
  onOpenCreateProject,
  onToggleAutoSave,
  onOpenTemplates,
  onOpenComplexity,
  onOpenHistory,
  onDownloadFile,
  onSave,
  onAutoFix,
  onRun,
  onToggleAi,
  onToggleSidebar,
  onToggleTerminal,
  onOpenTour,
  onSignOut,
}: TopBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  const activeBranchOrFolder = isLocalMode
    ? localFolderName || "Local Folder"
    : project?.name || "main";

  return (
    <header className="top-nav-bar">
      {/* Left Section: Brand & Project Branch Pill */}
      <div className="top-left-section">
        <div className="top-brand">
          <span className="top-brand-icon">◈</span>
          <span>Compiler Companion</span>
        </div>

        <button
          type="button"
          className="top-branch-pill"
          onClick={isLocalMode ? onOpenLocalFolder : onOpenCreateProject}
          title={
            isLocalMode
              ? `PC Folder: ${localFolderName} (Click to switch folder)`
              : `Cloud Project: ${project?.name} (Click to manage projects)`
          }
        >
          <span className="branch-icon">{isLocalMode ? "📁" : "⑂"}</span>
          <span className="branch-name">{activeBranchOrFolder}</span>
          <span className="chevron-down">⌄</span>
        </button>
      </div>

      {/* Center Section: Command Search Bar (Ctrl + K) */}
      <div className="top-center-section">
        <button
          type="button"
          className="top-search-bar"
          onClick={onOpenCommandPalette}
          title="Search files, symbols, commands (Ctrl + K)"
        >
          <span className="search-icon">🔍</span>
          <span className="search-placeholder">Search files, symbols, commands...</span>
          <kbd className="search-shortcut">Ctrl K</kbd>
        </button>
      </div>

      {/* Right Section: Run, Auto Fix, Layout Toggles & Profile */}
      <div className="top-right-section">
        {/* Primary Run Button */}
        <button
          type="button"
          className="ide-action-btn run"
          onClick={onRun}
          disabled={!file || isRunning || thinking}
          title="Compile & Run in Docker Sandbox (Ctrl + Enter)"
        >
          {isRunning ? (
            <>
              <span className="button-spinner" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <span className="run-triangle">▶</span>
              <span>Run</span>
            </>
          )}
        </button>

        {/* Auto Fix / Debug Button */}
        <button
          type="button"
          className="ide-action-btn debug"
          onClick={onAutoFix}
          disabled={!file || thinking}
          title="Debug & Auto-Fix with GOAT AI (Ctrl + Shift + F)"
        >
          <span>✦ Auto Fix</span>
        </button>

        <div className="top-nav-separator" />

        {/* Quick Tools Icons */}
        <button
          type="button"
          className="icon-tool-btn"
          onClick={onOpenTemplates}
          title="DSA & CP Starter Templates"
        >
          📚
        </button>

        <button
          type="button"
          className="icon-tool-btn"
          onClick={onOpenComplexity}
          disabled={!file}
          title="Analyze Big-O Complexity"
        >
          ⚡
        </button>

        <button
          type="button"
          className="icon-tool-btn"
          onClick={onOpenHistory}
          disabled={!file}
          title="Version History Snapshots"
        >
          ⏳
        </button>

        <button
          type="button"
          className="icon-tool-btn"
          onClick={onDownloadFile}
          disabled={!file}
          title="Download Active File"
        >
          ⬇
        </button>

        <div className="top-nav-separator" />

        {/* Panel Toggles Group */}
        <div className="layout-toggles-group">
          <button
            type="button"
            className={`layout-toggle-btn ${isSidebarOpen ? "active" : ""}`}
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Hide Explorer Sidebar" : "Show Explorer Sidebar"}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <button
            type="button"
            className={`layout-toggle-btn ${isTerminalOpen ? "active" : ""}`}
            onClick={onToggleTerminal}
            title={isTerminalOpen ? "Hide Bottom Panel" : "Show Bottom Panel"}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
          </button>

          <button
            type="button"
            className={`layout-toggle-btn ${isAiOpen ? "active" : ""}`}
            onClick={onToggleAi}
            title={isAiOpen ? "Hide GOAT AI" : "Open GOAT AI"}
          >
            <span style={{ fontSize: "12px", color: isAiOpen ? "#38bdf8" : "#94a3b8" }}>✦</span>
          </button>
        </div>

        <div className="top-nav-separator" />

        {/* User Profile & Dropdown */}
        <div className="user-profile-wrapper" ref={profileMenuRef}>
          <button
            type="button"
            className="user-avatar-btn"
            onClick={() => setProfileOpen((prev) => !prev)}
            title={`Account: ${userEmail}`}
          >
            {(userEmail[0] || "U").toUpperCase()}
          </button>

          {profileOpen && (
            <div className="user-dropdown-menu">
              <div className="dropdown-header">
                <span className="dropdown-user-email">{userEmail}</span>
                <span className="dropdown-status-badge">
                  {isLocalMode ? "Local Disk Active" : "Cloud Workspace"}
                </span>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  onToggleAutoSave();
                }}
              >
                Auto-Save: <b>{autoSaveEnabled ? "ON ✓" : "OFF"}</b>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  onSave();
                }}
              >
                Save File (Ctrl + S)
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  onOpenTour();
                }}
              >
                🗺 Website Tour
              </button>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item sign-out"
                onClick={() => {
                  setProfileOpen(false);
                  onSignOut();
                }}
              >
                ↪ Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
