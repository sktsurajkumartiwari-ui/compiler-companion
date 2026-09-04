import { useEffect, useRef } from "react";
import type {
  ExecutionResult,
  LanguageId,
  PatchProposal,
  TestCase,
} from "@compiler-companion/shared";
import type { useTerminal } from "../hooks/useTerminal";
import { TestCasesPane } from "./TestCasesPane";

export type OutputPanelTab = "terminal" | "output" | "diagnostics" | "testcases";

interface OutputPanelProps {
  result: ExecutionResult | null;
  note: string;
  fileLanguage?: LanguageId | null;
  terminal: ReturnType<typeof useTerminal>;
  activeTab: OutputPanelTab;
  onTabChange: (tab: OutputPanelTab) => void;
  onAskNova?: () => void;
  stdin?: string;
  onStdinChange?: (value: string) => void;
  testCases?: TestCase[];
  isRunningTests?: boolean;
  isGeneratingTests?: boolean;
  onAddTestCase?: () => void;
  onDeleteTestCase?: (id: string) => void;
  onUpdateTestCase?: (
    id: string,
    updates: Partial<Pick<TestCase, "name" | "input" | "expectedOutput">>,
  ) => void;
  onRunAllTests?: () => void;
  onGenerateTestCases?: () => void;
  onDebugTestCaseFailure?: (testCase: TestCase) => void;
  onAutoFixTestCase?: (testCase: TestCase) => void;
  isAutoFixingTests?: boolean;
  testCasePatches?: Record<string, PatchProposal>;
  onApplyPatch?: (patch?: PatchProposal) => void;
  onReviewDiff?: (original: string, replacement: string, reason?: string) => void;
  onClose?: () => void;
}

export function OutputPanel({
  result,
  note,
  terminal,
  activeTab,
  onTabChange,
  onAskNova,
  testCases,
  isRunningTests,
  isGeneratingTests,
  isAutoFixingTests,
  testCasePatches,
  onAddTestCase,
  onDeleteTestCase,
  onUpdateTestCase,
  onRunAllTests,
  onGenerateTestCases,
  onDebugTestCaseFailure,
  onAutoFixTestCase,
  onApplyPatch,
  onReviewDiff,
  onClose,
}: OutputPanelProps) {
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll terminal log to bottom on new output
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminal.logs]);

  // Focus input when user switches to terminal tab or process starts
  useEffect(() => {
    if (
      activeTab === "terminal" &&
      (terminal.status === "running" || terminal.status === "starting")
    ) {
      inputRef.current?.focus();
    }
  }, [activeTab, terminal.status]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      terminal.sendInput(terminal.inputValue);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      terminal.navigateHistory("up");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      terminal.navigateHistory("down");
    } else if (event.ctrlKey && event.key === "c") {
      if (terminal.status === "running" || terminal.status === "starting") {
        event.preventDefault();
        terminal.kill();
      }
    }
  };

  const diagnosticsCount = result?.diagnostics?.length ?? 0;
  const isProcessActive = terminal.status === "running" || terminal.status === "starting";

  return (
    <section className="ide-terminal-panel">
      {/* Panel Header Tabs */}
      <div className="terminal-tab-bar">
        <div className="terminal-tabs-left">
          <button
            type="button"
            className={`terminal-tab-btn ${activeTab === "terminal" ? "active" : ""}`}
            onClick={() => onTabChange("terminal")}
          >
            TERMINAL
          </button>

          <button
            type="button"
            className={`terminal-tab-btn ${activeTab === "diagnostics" ? "active" : ""}`}
            onClick={() => onTabChange("diagnostics")}
          >
            PROBLEMS
            {diagnosticsCount > 0 && (
              <span className="tab-pill-badge danger">{diagnosticsCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`terminal-tab-btn ${activeTab === "output" ? "active" : ""}`}
            onClick={() => onTabChange("output")}
          >
            OUTPUT
          </button>

          <button
            type="button"
            className={`terminal-tab-btn ${activeTab === "testcases" ? "active" : ""}`}
            onClick={() => onTabChange("testcases")}
          >
            TEST RESULTS
            {testCases && testCases.length > 0 && (
              <span className="tab-pill-badge blue">
                {testCases.filter((t) => t.status === "passed").length}/{testCases.length}
              </span>
            )}
          </button>
        </div>

        <div className="terminal-tabs-right">
          <div className="shell-selector-pill">
            <span>zsh</span>
          </div>

          {isProcessActive && (
            <button
              type="button"
              className="term-icon-action kill"
              onClick={terminal.kill}
              title="Stop process (Ctrl + C)"
            >
              ⏹ Stop
            </button>
          )}

          <button
            type="button"
            className="term-icon-action"
            onClick={terminal.clear}
            title="Clear terminal"
          >
            ⌫ Clear
          </button>

          {onClose && (
            <button
              type="button"
              className="term-icon-action"
              onClick={onClose}
              title="Close panel"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Panel Tab Contents */}
      <div className="terminal-content-area">
        {activeTab === "terminal" && (
          <div className="terminal-screen-wrapper">
            <div className="terminal-screen-stream" ref={terminalScrollRef}>
              <div className="terminal-welcome-prompt">
                <span className="prompt-repo">compiler-companion</span> on{" "}
                <span className="prompt-branch">⑂ main</span> via{" "}
                <span className="prompt-env">🐍 v3.12.2</span>
              </div>

              {terminal.logs.length === 0 ? (
                <div className="terminal-idle-msg">
                  <span className="prompt-sign">$ </span>
                  <span className="terminal-blinking-cursor" />
                  <small style={{ marginLeft: "12px", color: "#64748b" }}>
                    Click <b>▶ Run</b> to execute your program in the Docker sandbox.
                  </small>
                </div>
              ) : (
                terminal.logs.map((log) => (
                  <div key={log.id} className={`terminal-log-row ${log.type}`}>
                    <span className="log-prefix">{log.type === "stdin" ? "$ " : ""}</span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Terminal Input Bar */}
            <div className="terminal-stdin-bar">
              <span className="stdin-chevron">$</span>
              <input
                ref={inputRef}
                type="text"
                className="stdin-input"
                value={terminal.inputValue}
                onChange={(e) => terminal.setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isProcessActive
                    ? "Interactive process running... type input and press Enter"
                    : "Type input and press Enter (or click ▶ Run to start)"
                }
              />
              {isProcessActive && (
                <button
                  type="button"
                  className="stdin-send-btn"
                  onClick={() => terminal.sendInput(terminal.inputValue)}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <div className="diagnostics-container">
            {result?.diagnostics && result.diagnostics.length > 0 ? (
              <div className="diagnostics-list">
                {result.diagnostics.map((diag, index) => (
                  <div key={index} className={`diagnostic-card ${diag.severity}`}>
                    <div className="diagnostic-header">
                      <span className={`diagnostic-badge ${diag.severity}`}>
                        {diag.severity.toUpperCase()}
                      </span>
                      {diag.line && (
                        <span className="diagnostic-location">
                          Line {diag.line}
                          {diag.column ? `:${diag.column}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="diagnostic-message">{diag.message}</p>
                  </div>
                ))}
                {onAskNova && (
                  <button type="button" className="diagnostics-nova-btn" onClick={onAskNova}>
                    ✦ Ask GOAT to Analyze & Fix Diagnostics
                  </button>
                )}
              </div>
            ) : (
              <div className="diagnostics-empty">
                <span>✓</span>
                <p>No problems have been detected in the workspace.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "output" && (
          <div className="output-container">
            {result ? (
              <div className="output-content">
                {result.stdout && (
                  <div className="output-section">
                    <div className="output-section-header">STDOUT</div>
                    <pre className="terminal-success">{result.stdout}</pre>
                  </div>
                )}
                {result.stderr && (
                  <div className="output-section">
                    <div className="output-section-header error">STDERR</div>
                    <pre className="terminal-error">{result.stderr}</pre>
                  </div>
                )}
                {!result.stdout && !result.stderr && (
                  <pre className="terminal-note">{result.status}</pre>
                )}
              </div>
            ) : (
              <pre className="terminal-note">
                {note || "No execution output yet. Run your code to see results."}
              </pre>
            )}
          </div>
        )}

        {activeTab === "testcases" && (
          <TestCasesPane
            testCases={testCases ?? []}
            isRunning={isRunningTests ?? false}
            isGenerating={isGeneratingTests ?? false}
            onAddCase={onAddTestCase ?? (() => {})}
            onDeleteCase={onDeleteTestCase ?? (() => {})}
            onUpdateCase={onUpdateTestCase ?? (() => {})}
            onRunAll={onRunAllTests ?? (() => {})}
            onGenerateCases={onGenerateTestCases ?? (() => {})}
            onDebugFailure={onDebugTestCaseFailure}
            onAutoFixCase={onAutoFixTestCase}
            isAutoFixing={isAutoFixingTests}
            testCasePatches={testCasePatches}
            onApplyPatch={onApplyPatch}
            onReviewDiff={onReviewDiff}
          />
        )}
      </div>
    </section>
  );
}
