import { useState } from "react";
import type { Project, ProjectSummary, WorkspaceFile } from "@compiler-companion/shared";

interface FileExplorerProps {
  projects: ProjectSummary[];
  project: Project | null;
  file: WorkspaceFile | null;
  isLocalMode: boolean;
  localFolderName: string | null;
  localFiles: WorkspaceFile[];
  onOpenProject: (id: string) => void;
  onOpenCreate: () => void;
  onOpenLocalFolder: () => void;
  onCloseLocalFolder: () => void;
  onAddFile: () => void;
  onDeleteFile: (file: WorkspaceFile) => void;
  onRenameFile?: (file: WorkspaceFile) => void;
  onDeleteProject?: (projectId: string, projectName: string) => void;
  onRenameProject?: (projectId: string, currentName: string) => void;
  onSelectFile: (file: WorkspaceFile) => void;
}

export function FileExplorer({
  projects,
  project,
  file,
  isLocalMode,
  localFolderName,
  localFiles,
  onOpenProject,
  onOpenCreate,
  onOpenLocalFolder,
  onCloseLocalFolder,
  onAddFile,
  onDeleteFile,
  onRenameFile,
  onDeleteProject,
  onRenameProject,
  onSelectFile,
}: FileExplorerProps) {
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true);
  const [cloudSectionOpen, setCloudSectionOpen] = useState(true);

  const getFileIcon = (fileName: string, language?: string) => {
    if (fileName.endsWith(".py") || language === "python") return "🐍";
    if (fileName.endsWith(".cpp") || fileName.endsWith(".cc") || language === "cpp") return "⚙️";
    if (fileName.endsWith(".json")) return "{}";
    if (fileName.endsWith(".md")) return "📝";
    return "📄";
  };

  const filesToDisplay = isLocalMode ? localFiles : project?.files || [];

  return (
    <aside className="ide-file-explorer" aria-label="File Explorer">
      {/* Explorer Top Header */}
      <div className="explorer-header-title">
        <span>EXPLORER</span>
        <div className="header-action-icons">
          <button
            type="button"
            className="explorer-action-btn"
            onClick={onAddFile}
            title="New File (Ctrl + N)"
          >
            ＋
          </button>
          <button
            type="button"
            className="explorer-action-btn"
            onClick={onOpenLocalFolder}
            title="Open Folder on PC"
          >
            📁
          </button>
          <button
            type="button"
            className="explorer-action-btn"
            onClick={onOpenCreate}
            title="New Cloud Project"
          >
            ☁️
          </button>
        </div>
      </div>

      <div className="explorer-tree-scroll">
        {/* Section 1: Active Workspace Files */}
        <div className="tree-section">
          <div
            className="section-collapsible-heading"
            onClick={() => setWorkspaceSectionOpen((prev) => !prev)}
          >
            <span className={`chevron-icon ${workspaceSectionOpen ? "expanded" : ""}`}>
              {workspaceSectionOpen ? "⌄" : "›"}
            </span>
            <span>
              {isLocalMode
                ? `LOCAL FOLDER: ${localFolderName || "PC Disk"}`
                : `WORKSPACE: ${project?.name || "Project"}`}
            </span>
            {isLocalMode && (
              <button
                type="button"
                className="close-section-mini-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseLocalFolder();
                }}
                title="Close local folder"
              >
                ×
              </button>
            )}
          </div>

          {workspaceSectionOpen && (
            <div className="tree-children-block">
              {isLocalMode && localFiles.length === 0 ? (
                <div className="empty-files-hint">
                  <span>No files found in folder.</span>
                  <button type="button" className="mini-add-file-btn" onClick={onAddFile}>
                    ＋ Create first file
                  </button>
                </div>
              ) : !isLocalMode && !project ? (
                <div className="empty-files-hint">
                  <p>No project opened.</p>
                  <button type="button" className="mini-add-file-btn" onClick={onOpenCreate}>
                    ＋ Create Project
                  </button>
                </div>
              ) : (
                filesToDisplay.map((item) => {
                  const isActive = item.id === file?.id;
                  return (
                    <div
                      key={item.id}
                      className={`tree-row level-1 ${isActive ? "active-row" : ""}`}
                      onClick={() => onSelectFile(item)}
                      title={item.name}
                    >
                      <span className="file-type-icon">
                        {getFileIcon(item.name, item.language)}
                      </span>
                      <span className="file-name-text">{item.name}</span>

                      {/* Row Hover Actions: Rename, Delete */}
                      <div className="row-hover-actions">
                        {onRenameFile && (
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRenameFile(item);
                            }}
                            title={`Rename ${item.name}`}
                          >
                            ✎
                          </button>
                        )}
                        <button
                          type="button"
                          className="row-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(item);
                          }}
                          title={`Delete ${item.name}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 2: Cloud Projects List (if not in local mode or to switch projects) */}
        <div className="tree-section">
          <div
            className="section-collapsible-heading"
            onClick={() => setCloudSectionOpen((prev) => !prev)}
          >
            <span className={`chevron-icon ${cloudSectionOpen ? "expanded" : ""}`}>
              {cloudSectionOpen ? "⌄" : "›"}
            </span>
            <span>CLOUD PROJECTS ({projects.length})</span>
            <button
              type="button"
              className="add-proj-mini-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreate();
              }}
              title="Create new cloud project"
            >
              ＋
            </button>
          </div>

          {cloudSectionOpen && (
            <div className="tree-children-block">
              {projects.length === 0 ? (
                <div className="empty-files-hint">
                  <span>No cloud projects yet.</span>
                </div>
              ) : (
                projects.map((p) => {
                  const isCurrent = !isLocalMode && p.id === project?.id;
                  return (
                    <div
                      key={p.id}
                      className={`tree-row level-1 ${isCurrent ? "active-row" : ""}`}
                      onClick={() => onOpenProject(p.id)}
                    >
                      <span className="folder-icon">{isCurrent ? "📂" : "📁"}</span>
                      <span className="file-name-text">{p.name}</span>
                      {isCurrent && <span className="current-badge">active</span>}

                      <div className="row-hover-actions">
                        {onRenameProject && (
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRenameProject(p.id, p.name);
                            }}
                            title={`Rename ${p.name}`}
                          >
                            ✎
                          </button>
                        )}
                        {onDeleteProject && (
                          <button
                            type="button"
                            className="row-action-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(p.id, p.name);
                            }}
                            title={`Delete ${p.name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
