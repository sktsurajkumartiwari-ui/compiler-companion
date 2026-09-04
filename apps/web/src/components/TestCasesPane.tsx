import { useState } from "react";
import type { PatchProposal, TestCase } from "@compiler-companion/shared";

interface TestCasesPaneProps {
  testCases: TestCase[];
  isRunning: boolean;
  isGenerating: boolean;
  isAutoFixing?: boolean;
  testCasePatches?: Record<string, PatchProposal>;
  onAddCase: () => void;
  onDeleteCase: (id: string) => void;
  onUpdateCase: (
    id: string,
    updates: Partial<Pick<TestCase, "name" | "input" | "expectedOutput">>,
  ) => void;
  onRunAll: () => void;
  onGenerateCases: () => void;
  onDebugFailure?: (testCase: TestCase) => void;
  onAutoFixCase?: (testCase: TestCase) => void;
  onApplyPatch?: (patch?: PatchProposal) => void;
  onReviewDiff?: (original: string, replacement: string, reason?: string) => void;
}

export function TestCasesPane({
  testCases,
  isRunning,
  isGenerating,
  isAutoFixing,
  testCasePatches,
  onAddCase,
  onDeleteCase,
  onUpdateCase,
  onRunAll,
  onGenerateCases,
  onDebugFailure,
  onAutoFixCase,
  onApplyPatch,
  onReviewDiff,
}: TestCasesPaneProps) {
  const [activeCaseId, setActiveCaseId] = useState<string>(() => testCases[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const activeCase = testCases.find((tc) => tc.id === activeCaseId) ?? testCases[0];
  const currentPatch = activeCase ? testCasePatches?.[activeCase.id] : undefined;

  const passedCount = testCases.filter((tc) => tc.status === "passed").length;
  const failedCount = testCases.filter(
    (tc) => tc.status === "failed" || tc.status === "error",
  ).length;
  const totalCount = testCases.length;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="test-cases-pane">
      {/* Top Action Toolbar */}
      <div className="test-cases-toolbar">
        <div className="test-cases-summary">
          <span className="summary-title">Test Suite</span>
          {totalCount > 0 && (
            <span
              className={`test-count-pill ${
                passedCount === totalCount && totalCount > 0
                  ? "all-passed"
                  : failedCount > 0
                    ? "has-failed"
                    : ""
              }`}
            >
              {passedCount}/{totalCount} Passed
            </span>
          )}
        </div>

        <div className="test-cases-actions">
          {failedCount > 0 && onAutoFixCase && (
            <button
              type="button"
              className="fix-all-tc-btn"
              onClick={() => {
                const target =
                  activeCase && (activeCase.status === "failed" || activeCase.status === "error")
                    ? activeCase
                    : testCases.find((tc) => tc.status === "failed" || tc.status === "error");
                if (target) onAutoFixCase(target);
              }}
              disabled={isAutoFixing || isRunning}
              title="Ask GOAT to analyze the failed test case, engineer a 1-shot fix, and show the review card"
            >
              {isAutoFixing ? "⚡ Fixing with GOAT…" : `⚡ Auto-Fix Failed (${failedCount})`}
            </button>
          )}

          <button
            type="button"
            className="ghost generate-tc-btn"
            onClick={onGenerateCases}
            disabled={isGenerating || isRunning || isAutoFixing}
            title="Ask GOAT to analyze code and generate standard & edge test cases"
          >
            {isGenerating ? "✨ Generating…" : "✨ Auto-Generate with GOAT"}
          </button>

          <button
            type="button"
            className="run-tc-btn"
            onClick={onRunAll}
            disabled={isRunning || isAutoFixing || testCases.length === 0}
            title="Execute all test cases in secure Docker sandbox"
          >
            {isRunning ? "Running tests…" : "▶ Run All Tests"}
          </button>
        </div>
      </div>

      {/* Test Cases Tab Selector */}
      <div className="test-cases-tab-bar">
        {testCases.map((tc, index) => {
          const isActive = tc.id === (activeCase?.id ?? "");
          return (
            <button
              key={tc.id}
              type="button"
              className={`test-tab ${isActive ? "active" : ""} status-${tc.status}`}
              onClick={() => setActiveCaseId(tc.id)}
            >
              <span className="tab-status-icon">
                {tc.status === "passed" && "✓"}
                {tc.status === "failed" && "✕"}
                {tc.status === "error" && "⚠"}
                {tc.status === "timeout" && "⏱"}
                {tc.status === "running" && "⋯"}
                {tc.status === "idle" && "•"}
              </span>
              <span className="tab-name">{tc.name || `Case ${index + 1}`}</span>
              {tc.category && <span className="tab-cat-mini">{tc.category}</span>}
              {testCasePatches?.[tc.id] && (
                <span className="tab-fix-dot" title="Fix ready to review">
                  ✦
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          className="add-case-tab-btn"
          onClick={onAddCase}
          title="Add a new test case"
        >
          ＋ Add Case
        </button>
      </div>

      {/* Active Case Editor & Results */}
      {activeCase ? (
        <div className="active-case-body">
          <div className="case-header-row">
            <div className="case-title-group">
              <input
                className="case-name-input"
                value={activeCase.name}
                onChange={(e) => onUpdateCase(activeCase.id, { name: e.target.value })}
                placeholder="Test case name (e.g. Standard Case, Empty Array)"
              />
              {activeCase.category && (
                <span
                  className={`case-category-badge cat-${activeCase.category
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {activeCase.category}
                </span>
              )}
            </div>

            <div className="case-header-right">
              {activeCase.durationMs != null && (
                <span className="case-duration">⏱ {activeCase.durationMs}ms</span>
              )}
              {testCases.length > 1 && (
                <button
                  type="button"
                  className="delete-case-btn"
                  onClick={() => onDeleteCase(activeCase.id)}
                  title="Delete this test case"
                >
                  🗑 Delete Case
                </button>
              )}
            </div>
          </div>

          {/* Explanation Callout */}
          {activeCase.explanation && (
            <div className="case-explanation-callout">
              <span className="expl-icon">💡</span>
              <span className="expl-text">{activeCase.explanation}</span>
            </div>
          )}

          <div className="case-io-grid">
            {/* Input (stdin) */}
            <div className="case-column">
              <div className="column-label">
                <span>Input (`stdin`)</span>
                <small>Passed to `input()` / `cin`</small>
              </div>
              <textarea
                className="case-textarea input-textarea"
                value={activeCase.input}
                onChange={(e) => onUpdateCase(activeCase.id, { input: e.target.value })}
                placeholder="Enter input here (e.g. 5\n10 20 30)"
                rows={4}
              />
            </div>

            {/* Expected Output */}
            <div className="case-column">
              <div className="column-label">
                <span>Expected Output</span>
                <small>Target output to match</small>
              </div>
              <textarea
                className="case-textarea expected-textarea"
                value={activeCase.expectedOutput ?? ""}
                onChange={(e) => onUpdateCase(activeCase.id, { expectedOutput: e.target.value })}
                placeholder="Expected stdout (optional)"
                rows={4}
              />
            </div>
          </div>

          {/* Actual Output & Result Status */}
          {activeCase.status !== "idle" && (
            <div className={`case-result-box status-${activeCase.status}`}>
              <div className="result-header">
                <div className="result-badge">
                  {activeCase.status === "passed" && <span className="badge-passed">✓ PASSED</span>}
                  {activeCase.status === "failed" && (
                    <span className="badge-failed">✕ FAILED (Wrong Answer)</span>
                  )}
                  {activeCase.status === "error" && (
                    <span className="badge-error">⚠ RUNTIME / COMPILE ERROR</span>
                  )}
                  {activeCase.status === "timeout" && (
                    <span className="badge-timeout">⏱ TIME LIMIT EXCEEDED</span>
                  )}
                  {activeCase.status === "running" && (
                    <span className="badge-running">⋯ RUNNING</span>
                  )}
                </div>

                {(activeCase.status === "failed" || activeCase.status === "error") && (
                  <div className="case-failure-actions">
                    {onDebugFailure && (
                      <button
                        type="button"
                        className="explain-failure-btn"
                        onClick={() => onDebugFailure(activeCase)}
                        title="Get detailed explanation of the bug and dry run from GOAT"
                      >
                        💡 Explain Bug
                      </button>
                    )}
                    {onAutoFixCase && (
                      <button
                        type="button"
                        className="autofix-failure-btn"
                        onClick={() => onAutoFixCase(activeCase)}
                        disabled={isAutoFixing || isRunning}
                        title="Ask GOAT to analyze the failed test case and generate code to apply"
                      >
                        {isAutoFixing ? "⚡ Generating Fix…" : "⚡ Auto-Fix with GOAT"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {activeCase.error && <pre className="case-error-text">{activeCase.error}</pre>}

              {/* Mismatch comparison for failed cases */}
              {activeCase.status === "failed" && activeCase.expectedOutput && (
                <div className="mismatch-comparison-grid">
                  <div className="mismatch-pane expected-pane">
                    <div className="mismatch-title">Expected Output:</div>
                    <pre className="mismatch-pre">{activeCase.expectedOutput}</pre>
                  </div>
                  <div className="mismatch-pane actual-pane">
                    <div className="mismatch-title">Your Output:</div>
                    <pre className="mismatch-pre">{activeCase.actualOutput || "(No stdout)"}</pre>
                  </div>
                </div>
              )}

              {/* Proposed Code to Apply (Interactive Nova-style Patch Card) */}
              {currentPatch && (
                <div className="patch-container in-testcase">
                  <div className="patch-header">
                    <div className="patch-header-row">
                      <span>PROPOSED FIX ({currentPatch.file})</span>
                      <button
                        type="button"
                        className="copy-code-btn"
                        onClick={() => void handleCopy(currentPatch.replacement)}
                        title="Copy code to clipboard"
                      >
                        {copied ? "✓ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                    {currentPatch.reason && <small>{currentPatch.reason}</small>}
                  </div>

                  <pre className="patch-code-preview">{currentPatch.replacement}</pre>

                  <div className="patch-actions-row">
                    {onReviewDiff && (
                      <button
                        type="button"
                        className="ghost review-diff-btn"
                        onClick={() =>
                          onReviewDiff(
                            currentPatch.original,
                            currentPatch.replacement,
                            currentPatch.reason,
                          )
                        }
                        title="Inspect side-by-side in Monaco Diff Viewer"
                      >
                        ◫ Review Diff
                      </button>
                    )}
                    {onApplyPatch && (
                      <button
                        type="button"
                        className="apply-patch-btn"
                        onClick={() => onApplyPatch(currentPatch)}
                        title="Apply this proposed code to your editor and re-run tests"
                      >
                        ✦ Apply to Editor & Re-run Tests
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Standard output view for passed cases */}
              {activeCase.status === "passed" && activeCase.actualOutput !== undefined && (
                <div className="actual-output-section">
                  <div className="actual-label">Output:</div>
                  <pre className="case-output-pre">
                    {activeCase.actualOutput.trim() ? (
                      activeCase.actualOutput
                    ) : (
                      <em>(Program exited cleanly with no output)</em>
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="no-cases-empty">
          <p>No test cases yet.</p>
          <button type="button" className="ghost" onClick={onAddCase}>
            + Add First Test Case
          </button>
        </div>
      )}
    </div>
  );
}
