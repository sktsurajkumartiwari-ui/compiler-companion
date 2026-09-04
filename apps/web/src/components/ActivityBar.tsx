export type ActivityView = "explorer" | "templates" | "history" | "complexity";

interface ActivityBarProps {
  activeView: ActivityView;
  isSidebarOpen: boolean;
  onToggleView: (view: ActivityView) => void;
  onOpenTour: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  userEmail: string;
}

export function ActivityBar({
  activeView,
  isSidebarOpen,
  onToggleView,
  onOpenTour,
  onOpenSettings,
  userEmail,
}: ActivityBarProps) {
  const firstLetter = (userEmail[0] || "U").toUpperCase();

  return (
    <nav className="activity-bar" aria-label="Activity Bar">
      <div className="activity-top-group">
        <button
          type="button"
          className={`activity-icon-btn ${activeView === "explorer" && isSidebarOpen ? "active" : ""}`}
          onClick={() => onToggleView("explorer")}
          title="Explorer (Ctrl + Shift + E)"
        >
          {activeView === "explorer" && isSidebarOpen && <div className="active-pill-line" />}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </button>

        <button
          type="button"
          className={`activity-icon-btn ${activeView === "templates" ? "active" : ""}`}
          onClick={() => onToggleView("templates")}
          title="DSA & CP Starter Templates"
        >
          {activeView === "templates" && <div className="active-pill-line" />}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>

        <button
          type="button"
          className={`activity-icon-btn ${activeView === "history" ? "active" : ""}`}
          onClick={() => onToggleView("history")}
          title="File Version History & Snapshots"
        >
          {activeView === "history" && <div className="active-pill-line" />}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        <button
          type="button"
          className={`activity-icon-btn ${activeView === "complexity" ? "active" : ""}`}
          onClick={() => onToggleView("complexity")}
          title="Big-O Complexity Analyzer"
        >
          {activeView === "complexity" && <div className="active-pill-line" />}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </button>
      </div>

      <div className="activity-bottom-group">
        <button
          type="button"
          className="activity-icon-btn"
          onClick={onOpenTour}
          title="Launch Interactive Feature Tour"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>

        <button
          type="button"
          className="activity-icon-btn"
          onClick={onOpenSettings}
          title={`Account: ${userEmail}`}
        >
          <div className="activity-avatar-circle">{firstLetter}</div>
        </button>
      </div>
    </nav>
  );
}
