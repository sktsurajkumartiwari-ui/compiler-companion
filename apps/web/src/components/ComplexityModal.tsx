import type { ComplexityResult } from "@compiler-companion/shared";

interface ComplexityModalProps {
  isOpen: boolean;
  language: string;
  result: ComplexityResult | null;
  loading: boolean;
  onClose: () => void;
  onAskNovaOptimize?: (suggestion?: string) => void;
}

export function ComplexityModal({
  isOpen,
  language,
  result,
  loading,
  onClose,
  onAskNovaOptimize,
}: ComplexityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="complexity-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="complexity-modal-header">
          <div className="complexity-title">
            <span className="complexity-icon">⚡</span>
            <div>
              <h3>Big-O Complexity Analysis</h3>
              <small>Algorithmic efficiency report for {language.toUpperCase()}</small>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="complexity-modal-body">
          {loading ? (
            <div className="complexity-loading-state">
              <div className="complexity-spinner" />
              <p>Analyzing loops, recursion trees, and memory allocation…</p>
            </div>
          ) : result ? (
            <div className="complexity-cards-container">
              {/* Badges Row */}
              <div className="complexity-badges-grid">
                <div className="big-o-card time-card">
                  <span className="card-label">TIME COMPLEXITY</span>
                  <div className="big-o-value">{result.timeComplexity}</div>
                  <small>Worst-case algorithmic runtime</small>
                </div>

                <div className="big-o-card space-card">
                  <span className="card-label">SPACE COMPLEXITY</span>
                  <div className="big-o-value">{result.spaceComplexity}</div>
                  <small>Auxiliary memory / stack space</small>
                </div>
              </div>

              {/* Summary Description */}
              <div className="complexity-section">
                <h4>Analysis Breakdown</h4>
                <p className="complexity-summary-text">{result.summary}</p>
              </div>

              {/* Bottleneck Callout */}
              {result.bottleneck && result.bottleneck.toLowerCase() !== "none" && (
                <div className="complexity-section bottleneck-box">
                  <h4>⚠️ Primary Bottleneck</h4>
                  <p>{result.bottleneck}</p>
                </div>
              )}

              {/* Optimization Suggestion */}
              {result.suggestion && (
                <div className="complexity-section suggestion-box">
                  <div className="suggestion-header">
                    <h4>💡 Optimization Strategy</h4>
                    {onAskNovaOptimize && (
                      <button
                        type="button"
                        className="optimize-with-nova-btn"
                        onClick={() => {
                          onAskNovaOptimize(result.suggestion);
                          onClose();
                        }}
                      >
                        ✦ Ask GOAT to Optimize
                      </button>
                    )}
                  </div>
                  <p>{result.suggestion}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="complexity-empty-state">
              <p>No complexity analysis available yet.</p>
            </div>
          )}
        </div>

        <div className="complexity-modal-footer">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
