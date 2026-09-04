import { useState, useEffect, useCallback, useMemo } from "react";
import type { Session } from "@compiler-companion/shared";
import {
  ActivityBar,
  type ActivityView,
  Auth,
  CommandPalette,
  type CommandItem,
  ComplexityModal,
  DiffViewerModal,
  EditorPane,
  FileExplorer,
  NovaPanel,
  OutputPanel,
  ProjectModal,
  StatusBar,
  TemplatesModal,
  TopBar,
  TourModal,
  VersionHistoryModal,
} from "./components";
import { useWorkspace } from "./hooks/useWorkspace";
import { useResizableLayout } from "./hooks/useResizableLayout";

export function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const stored =
        localStorage.getItem("compiler-companion-session") ??
        sessionStorage.getItem("compiler-companion-session");
      return stored ? (JSON.parse(stored) as Session) : null;
    } catch {
      return null;
    }
  });

  const handleSession = (newSession: Session, remember = true) => {
    try {
      if (remember) {
        localStorage.setItem("compiler-companion-session", JSON.stringify(newSession));
      } else {
        sessionStorage.setItem("compiler-companion-session", JSON.stringify(newSession));
      }
    } catch {
      /* ignore */
    }
    setSession(newSession);
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem("compiler-companion-session");
      sessionStorage.removeItem("compiler-companion-session");
    } catch {
      /* ignore */
    }
    setSession(null);
  };

  if (!session) return <Auth onSession={handleSession} onClearCachedSession={handleSignOut} />;

  return <Workspace session={session} signOut={handleSignOut} />;
}

function Workspace({ session, signOut }: { session: Session; signOut: () => void }) {
  const workspace = useWorkspace(session, signOut);
  const layout = useResizableLayout();
  const isRunning =
    workspace.terminal.status === "running" || workspace.terminal.status === "starting";

  const [activeActivityView, setActiveActivityView] = useState<ActivityView>("explorer");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return !localStorage.getItem("compiler-companion-tour-seen");
    } catch {
      return false;
    }
  });

  // Handle Activity Bar item clicks
  const handleToggleActivityView = useCallback(
    (view: ActivityView) => {
      if (view === "templates") {
        workspace.openTemplates();
      } else if (view === "history") {
        workspace.openHistory();
      } else if (view === "complexity") {
        void workspace.openComplexity();
      } else if (view === "explorer") {
        if (activeActivityView === "explorer" && isSidebarOpen) {
          setIsSidebarOpen(false);
        } else {
          setActiveActivityView("explorer");
          setIsSidebarOpen(true);
        }
      }
    },
    [activeActivityView, isSidebarOpen, workspace],
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl + Enter -> Run
      else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (workspace.file && !isRunning) {
          layout.openTerminal();
          void workspace.run();
        }
      }
      // Ctrl + S -> Save
      else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (workspace.file && !workspace.thinking) {
          void workspace.save();
        }
      }
      // Ctrl + Shift + F -> Auto Fix with Nova
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        layout.openAi();
        void workspace.analyze();
      }
      // Ctrl + B -> Toggle Sidebar
      else if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
      // Ctrl + ` -> Toggle Terminal
      else if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        layout.toggleTerminal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspace, layout]);

  // Command Palette items list
  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "run",
        category: "Run",
        title: "Run Code in Sandbox",
        shortcut: "Ctrl + Enter",
        action: () => {
          layout.openTerminal();
          void workspace.run();
        },
      },
      {
        id: "auto-fix",
        category: "AI",
        title: "Auto Fix & Debug with GOAT AI",
        shortcut: "Ctrl + Shift + F",
        action: () => {
          layout.openAi();
          void workspace.analyze();
        },
      },
      {
        id: "save",
        category: "File",
        title: "Save File to Disk / Cloud",
        shortcut: "Ctrl + S",
        action: () => void workspace.save(),
      },
      {
        id: "open-folder",
        category: "File",
        title: "Open Local PC Folder",
        action: () => void workspace.openLocalFolder(),
      },
      {
        id: "new-project",
        category: "Project",
        title: "Create New Cloud Project",
        action: workspace.openCreate,
      },
      {
        id: "templates",
        category: "Tools",
        title: "Insert DSA & CP Templates",
        action: workspace.openTemplates,
      },
      {
        id: "complexity",
        category: "Tools",
        title: "Analyze Big-O Time & Space Complexity",
        action: () => void workspace.openComplexity(),
      },
      {
        id: "history",
        category: "File",
        title: "Open File Version History Snapshots",
        action: workspace.openHistory,
      },
      {
        id: "export",
        category: "File",
        title: "Export / Download Active File",
        action: workspace.downloadFile,
      },
      {
        id: "toggle-ai",
        category: "View",
        title: "Toggle GOAT AI Assistant Panel",
        action: layout.toggleAi,
      },
      {
        id: "fullscreen-ai",
        category: "View",
        title:
          layout.aiDisplayMode === "fullscreen"
            ? "Exit Full Screen GOAT AI"
            : "Full Screen GOAT AI",
        action: layout.toggleAiFullscreen,
      },
      {
        id: "voice-mode",
        category: "AI",
        title: "Open Hands-Free Voice Assistant",
        action: workspace.voice.enterVoiceMode,
      },
      {
        id: "toggle-sidebar",
        category: "View",
        title: "Toggle Explorer Sidebar",
        shortcut: "Ctrl + B",
        action: () => setIsSidebarOpen((prev) => !prev),
      },
      {
        id: "toggle-terminal",
        category: "View",
        title: "Toggle Bottom Terminal",
        shortcut: "Ctrl + `",
        action: layout.toggleTerminal,
      },
      {
        id: "tour",
        category: "Help",
        title: "Launch Interactive Feature Tour",
        action: () => setTourOpen(true),
      },
      {
        id: "sign-out",
        category: "Account",
        title: "Sign Out",
        action: signOut,
      },
    ],
    [workspace, layout, signOut],
  );

  return (
    <div className={`app-root ${isFocusMode ? "focus-mode-active" : ""}`}>
      {/* 1. Top Navigation Bar */}
      <TopBar
        project={workspace.project}
        file={workspace.file}
        isLocalMode={workspace.isLocalMode}
        localFolderName={workspace.localFolderName}
        isRunning={isRunning}
        thinking={workspace.thinking}
        autoSaveEnabled={workspace.autoSaveEnabled}
        isAiOpen={layout.isAiOpen}
        isSidebarOpen={isSidebarOpen}
        isTerminalOpen={!layout.isTerminalCollapsed}
        userEmail={session.user.email}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenLocalFolder={() => void workspace.openLocalFolder()}
        onOpenCreateProject={workspace.openCreate}
        onToggleAutoSave={workspace.toggleAutoSave}
        onOpenTemplates={workspace.openTemplates}
        onOpenComplexity={() => void workspace.openComplexity()}
        onOpenHistory={workspace.openHistory}
        onDownloadFile={workspace.downloadFile}
        onSave={() => void workspace.save()}
        onAutoFix={() => {
          layout.openAi();
          void workspace.analyze();
        }}
        onRun={() => {
          layout.openTerminal();
          void workspace.run();
        }}
        onToggleAi={layout.toggleAi}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleTerminal={layout.toggleTerminal}
        onOpenTour={() => setTourOpen(true)}
        onSignOut={signOut}
      />

      {/* 2. Main Body: Activity Bar + Sidebar + Center (Editor + Terminal) + Docked AI */}
      <div className="workspace-body">
        {/* Activity Rail */}
        {!isFocusMode && (
          <ActivityBar
            activeView={activeActivityView}
            isSidebarOpen={isSidebarOpen}
            onToggleView={handleToggleActivityView}
            onOpenTour={() => setTourOpen(true)}
            onOpenSettings={() => setCommandPaletteOpen(true)}
            onSignOut={signOut}
            userEmail={session.user.email}
          />
        )}

        {/* Left Sidebar: File Explorer */}
        {!isFocusMode && isSidebarOpen && (
          <>
            <div className="sidebar-wrapper" style={{ width: `${layout.sidebarWidth}px` }}>
              <FileExplorer
                projects={workspace.projects}
                project={workspace.project}
                file={workspace.file}
                isLocalMode={workspace.isLocalMode}
                localFolderName={workspace.localFolderName}
                localFiles={workspace.localFiles}
                onOpenProject={(id) => void workspace.openProject(id)}
                onOpenCreate={workspace.openCreate}
                onOpenLocalFolder={() => void workspace.openLocalFolder()}
                onCloseLocalFolder={workspace.closeLocalFolder}
                onAddFile={() => void workspace.addFile()}
                onDeleteFile={(target) => void workspace.deleteFile(target)}
                onRenameFile={(target) => void workspace.renameFile(target)}
                onDeleteProject={(id, name) => void workspace.deleteProject(id, name)}
                onRenameProject={(id, name) => void workspace.renameProject(id, name)}
                onSelectFile={workspace.selectFile}
              />
            </div>

            {/* Sidebar Resizer Handle */}
            <div
              className={`resizer-handle-col ${layout.resizing === "sidebar" ? "active" : ""}`}
              onMouseDown={layout.startResizingSidebar}
              title="Drag to resize file explorer"
            />
          </>
        )}

        {/* Center: Editor + Bottom Panel Column */}
        <div className="center-column">
          <div className="editor-wrapper">
            <EditorPane
              file={workspace.file}
              saveStatus={workspace.saveStatus}
              isLocalMode={workspace.isLocalMode}
              onOpenCreate={workspace.openCreate}
              onCodeChange={workspace.updateCode}
            />
          </div>

          {/* Bottom Panel Resizer Handle */}
          {!isFocusMode && !layout.isTerminalCollapsed && (
            <div
              className={`resizer-handle-row ${layout.resizing === "terminal" ? "active" : ""}`}
              onMouseDown={layout.startResizingTerminal}
              onDoubleClick={layout.toggleTerminal}
              title="Drag to resize terminal / Double-click to collapse"
            >
              <div className="resizer-handle-grip" />
            </div>
          )}

          {/* Bottom Panel (Terminal, Problems, Output, Test Results) */}
          {!isFocusMode && !layout.isTerminalCollapsed && (
            <div className="terminal-wrapper" style={{ height: `${layout.terminalHeight}px` }}>
              <OutputPanel
                result={workspace.result}
                note={workspace.note}
                stdin={workspace.stdin}
                fileLanguage={workspace.file?.language ?? null}
                terminal={workspace.terminal}
                activeTab={workspace.activeTab}
                onTabChange={workspace.setActiveTab}
                onAskNova={() => {
                  layout.openAi();
                  void workspace.analyze();
                }}
                onStdinChange={workspace.setStdin}
                testCases={workspace.testCases}
                isRunningTests={workspace.isRunningTests}
                isGeneratingTests={workspace.isGeneratingTests}
                onAddTestCase={workspace.addTestCase}
                onDeleteTestCase={workspace.deleteTestCase}
                onUpdateTestCase={workspace.updateTestCase}
                onRunAllTests={() => void workspace.runTestCases()}
                onGenerateTestCases={() => void workspace.generateTestCases()}
                onDebugTestCaseFailure={(tc) => {
                  layout.openAi();
                  void workspace.debugTestCaseFailure(tc);
                }}
                isAutoFixingTests={workspace.isAutoFixingTests}
                testCasePatches={workspace.testCasePatches}
                onApplyPatch={workspace.applyPatchAndRunTests}
                onReviewDiff={workspace.openDiff}
                onAutoFixTestCase={(tc) => {
                  layout.openAi();
                  void workspace.autoFixTestCase(tc);
                }}
                onClose={layout.toggleTerminal}
              />
            </div>
          )}
        </div>

        {/* Fullscreen GOAT AI Window Overlay */}
        {layout.isAiOpen && layout.aiDisplayMode === "fullscreen" && (
          <div className="fullscreen-ai-overlay">
            <NovaPanel
              mode="fullscreen"
              thinking={workspace.thinking}
              analysis={workspace.analysis}
              messages={workspace.messages}
              prompt={workspace.prompt}
              voice={workspace.voice}
              onClearChat={workspace.clearChat}
              onPromptChange={workspace.setPrompt}
              onSubmit={() => void workspace.askNova()}
              onApplyPatch={workspace.applyPatch}
              onReviewDiff={workspace.openDiff}
              onClose={layout.closeAi}
              onToggleMode={layout.toggleAiDisplayMode}
              onToggleFullscreen={layout.toggleAiFullscreen}
            />
          </div>
        )}

        {/* Docked AI Panel on the right */}
        {!isFocusMode && layout.isAiOpen && layout.aiDisplayMode === "docked" && (
          <>
            <div
              className={`resizer-handle-col ${layout.resizing === "ai" ? "active" : ""}`}
              onMouseDown={layout.startResizingAi}
              title="Drag to resize AI assistant"
            />
            <div className="ai-docked-wrapper" style={{ width: `${layout.aiWidth}px` }}>
              <NovaPanel
                mode="docked"
                thinking={workspace.thinking}
                analysis={workspace.analysis}
                messages={workspace.messages}
                prompt={workspace.prompt}
                voice={workspace.voice}
                onClearChat={workspace.clearChat}
                onPromptChange={workspace.setPrompt}
                onSubmit={() => void workspace.askNova()}
                onApplyPatch={workspace.applyPatch}
                onReviewDiff={workspace.openDiff}
                onClose={layout.closeAi}
                onToggleMode={layout.toggleAiDisplayMode}
                onToggleFullscreen={layout.toggleAiFullscreen}
              />
            </div>
          </>
        )}

        {/* Floating Draggable Pop-up Window for GOAT AI */}
        {layout.isAiOpen && layout.aiDisplayMode === "popup" && (
          <div
            className="floating-ai-window"
            style={{
              left: `${layout.popupPos.x}px`,
              top: `${layout.popupPos.y}px`,
            }}
          >
            <NovaPanel
              mode="popup"
              thinking={workspace.thinking}
              analysis={workspace.analysis}
              messages={workspace.messages}
              prompt={workspace.prompt}
              voice={workspace.voice}
              onClearChat={workspace.clearChat}
              onPromptChange={workspace.setPrompt}
              onSubmit={() => void workspace.askNova()}
              onApplyPatch={workspace.applyPatch}
              onReviewDiff={workspace.openDiff}
              onClose={layout.closeAi}
              onHeaderMouseDown={layout.startDraggingPopup}
              onToggleMode={layout.toggleAiDisplayMode}
              onToggleFullscreen={layout.toggleAiFullscreen}
            />
          </div>
        )}

        {/* Easy Access Compact Round Floating Button with 'Ask GOAT' */}
        {!layout.isAiOpen && (
          <div
            className="floating-goat-container"
            style={{
              left: `${layout.btnPos.x}px`,
              top: `${layout.btnPos.y}px`,
            }}
            onMouseDown={layout.startDraggingBtn}
            onClick={layout.handleBtnClick}
            title="Click to Ask GOAT / Drag to reposition"
          >
            <span className="floating-goat-msg">Ask GOAT</span>
            <button type="button" className="floating-goat-btn" aria-label="Ask GOAT AI">
              <span className="goat-icon">🐐</span>
              <span className="goat-sparkle">✦</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar
        file={workspace.file}
        result={workspace.result}
        isLocalMode={workspace.isLocalMode}
        localFolderName={workspace.localFolderName}
        projectName={workspace.project?.name ?? null}
        autoSaveEnabled={workspace.autoSaveEnabled}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
      />

      {/* 4. Modals */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      {workspace.createOpen && (
        <ProjectModal
          projectName={workspace.projectName}
          projectLanguage={workspace.projectLanguage}
          thinking={workspace.thinking}
          onNameChange={workspace.setProjectName}
          onLanguageChange={workspace.setProjectLanguage}
          onSubmit={() => void workspace.createProject()}
          onClose={() => workspace.setCreateOpen(false)}
        />
      )}

      {workspace.diffOpen && workspace.diffData && workspace.file && (
        <DiffViewerModal
          isOpen={true}
          language={workspace.file.language}
          title={`Diff Preview — ${workspace.file.name}`}
          reason={workspace.diffData.reason}
          original={workspace.diffData.original}
          modified={workspace.diffData.replacement}
          onApply={() =>
            workspace.applyPatch({
              file: workspace.file?.name || "code",
              original: workspace.diffData!.original,
              replacement: workspace.diffData!.replacement,
              reason: workspace.diffData!.reason || "Manual diff apply",
              confidence: 1,
            })
          }
          onClose={workspace.closeDiff}
        />
      )}

      {workspace.historyOpen && workspace.file && (
        <VersionHistoryModal
          isOpen={true}
          fileName={workspace.file.name}
          currentContent={workspace.file.content}
          language={workspace.file.language}
          versions={workspace.versions}
          onRestore={(v) => void workspace.restoreVersion(v)}
          onClose={workspace.closeHistory}
        />
      )}

      <ComplexityModal
        isOpen={workspace.complexityOpen}
        language={workspace.file?.language ?? "python"}
        result={workspace.complexity}
        loading={workspace.isAnalyzingComplexity}
        onClose={workspace.closeComplexity}
        onAskNovaOptimize={(suggestion) => {
          layout.openAi();
          void workspace.askNova(
            `Please optimize this code to improve its algorithmic complexity. Focus on this optimization suggestion:\n${suggestion ?? "Optimize time and space complexity"}`,
          );
        }}
      />

      <TemplatesModal
        isOpen={workspace.templatesOpen}
        currentLanguage={workspace.file?.language ?? "cpp"}
        onSelectTemplate={workspace.insertTemplate}
        onClose={workspace.closeTemplates}
      />

      <TourModal
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onOpenTemplates={workspace.openTemplates}
        onOpenLocalFolder={() => {
          void workspace.openLocalFolder();
        }}
      />
    </div>
  );
}
