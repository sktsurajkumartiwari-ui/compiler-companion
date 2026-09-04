import { useState } from "react";

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTemplates?: () => void;
  onOpenLocalFolder?: () => void;
}

interface TourStep {
  badge: string;
  title: string;
  subtitle: string;
  content: string;
  highlights: Array<{ icon: string; title: string; desc: string }>;
  shortcuts?: Array<{ keys: string; desc: string }>;
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: "WELCOME",
    title: "Welcome to Compiler Companion ◈",
    subtitle: "Your AI-Powered Cloud & Local Coding Studio",
    content:
      "Compiler Companion combines isolated Linux Docker sandboxes, the Monaco editor (from VS Code), and GOAT AI — an intelligent coding mentor that writes clean, well-commented code in Hinglish and English.",
    highlights: [
      {
        icon: "🐳",
        title: "Docker Isolation",
        desc: "Execute Python 3.12 and C++20 in secure, resource-limited Linux containers.",
      },
      {
        icon: "📁",
        title: "Direct PC Disk Mode",
        desc: "Open a folder from your PC to edit and save files directly to disk without cloud upload.",
      },
      {
        icon: "☁️",
        title: "Cloud Multi-File Workspaces",
        desc: "Create full multi-file projects stored safely with automated snapshots and history.",
      },
    ],
  },
  {
    badge: "EDITOR & SHORTCUTS",
    title: "The Power of VS Code in Your Browser ⚡",
    subtitle: "High-Performance Monaco Editor with Pro Keyboard Shortcuts",
    content:
      "Enjoy syntax highlighting, bracket matching, error squiggles, and auto-save. Boost your coding speed with battle-tested keyboard shortcuts designed for competitive programmers and students.",
    highlights: [
      {
        icon: "⚡",
        title: "Debounced Auto-Save",
        desc: "Never lose your work. Toggle auto-save in the header or save manually anytime.",
      },
      {
        icon: "⏳",
        title: "Version Snapshots",
        desc: "Every save and AI patch automatically creates a version snapshot you can restore.",
      },
      {
        icon: "⬇",
        title: "Instant Export",
        desc: "Download your active source code directly to your computer with a single click.",
      },
    ],
    shortcuts: [
      { keys: "Ctrl + S", desc: "Save active file to disk / cloud" },
      { keys: "Ctrl + Enter", desc: "Compile & Run code in Docker" },
      { keys: "Ctrl + Shift + F", desc: "Ask GOAT AI to analyze & fix" },
      { keys: "Ctrl + Z", desc: "Instant Undo last AI fix" },
    ],
  },
  {
    badge: "TEST SUITE & SANDBOX",
    title: "Docker Sandbox & Test Suite 🧪",
    subtitle: "Interactive Terminal & Automated Competitive Testing",
    content:
      "Run your program interactively with live standard input (`stdin`), or run comprehensive test suites with sample, boundary, edge, scale, and stress test cases.",
    highlights: [
      {
        icon: "✨",
        title: "Auto-Generate with GOAT",
        desc: "Ask GOAT to inspect your code and auto-generate CP-grade test cases with explanations.",
      },
      {
        icon: "📊",
        title: "Side-by-Side Mismatch Diff",
        desc: "Failed test cases show exact green (Expected) vs red (Your Output) mismatches.",
      },
      {
        icon: "⚡",
        title: "1-Click Auto-Fix",
        desc: "GOAT diagnoses test failures and generates a 1-shot fix you can review and apply.",
      },
    ],
  },
  {
    badge: "AI MENTOR & VOICE",
    title: "Meet GOAT — Your 24/7 Coding Teacher 🧠",
    subtitle: "ChatGPT-Grade Explanations, Voice Mode, and Side-by-Side Diff Review",
    content:
      "GOAT doesn't just fix code — he teaches you like a senior staff software engineer. Code is formatted cleanly with beginner-friendly inline comments so you understand every single line.",
    highlights: [
      {
        icon: "🎙",
        title: "Voice Assistant",
        desc: "Click the microphone button to talk naturally to GOAT and listen to verbal walkthroughs.",
      },
      {
        icon: "◫",
        title: "Monaco Diff Viewer",
        desc: "Review proposed code changes side-by-side with color-coded diffs before applying.",
      },
      {
        icon: "⚡",
        title: "Big-O Complexity",
        desc: "Evaluate asymptotic Time and Space complexity, find bottlenecks, and get tips.",
      },
    ],
  },
  {
    badge: "STUDENT SUPERPOWERS",
    title: "Ready to Build Something Great? 🚀",
    subtitle: "DSA Starter Templates & Direct Local PC Folder Editing",
    content:
      "You're all set to code! Jumpstart your problem-solving with pre-built data structure templates, or connect your local assignments folder directly.",
    highlights: [
      {
        icon: "📚",
        title: "DSA Templates Library",
        desc: "Instant starters for Binary Search, Graphs (BFS/DFS), Trees, and Dynamic Programming.",
      },
      {
        icon: "📁",
        title: "Persistent Local Mode",
        desc: "Your opened PC folders stay saved in IndexedDB across browser reloads!",
      },
      {
        icon: "💡",
        title: "Re-Open Tour Anytime",
        desc: "Click '💡 Tour' in the top navbar whenever you want a quick feature refresher.",
      },
    ],
  },
];

export function TourModal({ isOpen, onClose, onOpenTemplates, onOpenLocalFolder }: TourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem("compiler-companion-tour-seen", "true");
    } catch {
      // Ignore
    }
    onClose();
  };

  return (
    <div className="tour-modal-backdrop" onClick={handleComplete}>
      <div className="tour-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header with Step Indicator & Close */}
        <div className="tour-header">
          <div className="tour-badge-row">
            <span className="tour-category-badge">{step.badge}</span>
            <span className="tour-step-counter">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            className="tour-close-btn"
            onClick={handleComplete}
            title="Close tour"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar Dots */}
        <div className="tour-progress-bar">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`tour-dot ${idx === currentStep ? "active" : ""} ${
                idx < currentStep ? "completed" : ""
              }`}
              onClick={() => setCurrentStep(idx)}
              title={`Go to Step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Slide Content */}
        <div className="tour-body">
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-subtitle">{step.subtitle}</p>
          <p className="tour-desc">{step.content}</p>

          {/* Feature Highlights Grid */}
          <div className="tour-highlights-grid">
            {step.highlights.map((h, i) => (
              <div key={i} className="tour-highlight-item">
                <span className="highlight-icon">{h.icon}</span>
                <div className="highlight-texts">
                  <h4>{h.title}</h4>
                  <p>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Keyboard Shortcuts Table (if present) */}
          {step.shortcuts && (
            <div className="tour-shortcuts-box">
              <div className="shortcuts-title">⚡ Essential Keyboard Shortcuts:</div>
              <div className="shortcuts-grid">
                {step.shortcuts.map((s, idx) => (
                  <div key={idx} className="shortcut-row">
                    <kbd className="shortcut-kbd">{s.keys}</kbd>
                    <span className="shortcut-desc">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Launch Buttons on Final Slide */}
          {isLastStep && (
            <div className="tour-final-quick-actions">
              {onOpenTemplates && (
                <button
                  type="button"
                  className="quick-action-btn templates"
                  onClick={() => {
                    handleComplete();
                    onOpenTemplates();
                  }}
                >
                  📚 Browse DSA Templates
                </button>
              )}
              {onOpenLocalFolder && (
                <button
                  type="button"
                  className="quick-action-btn local"
                  onClick={() => {
                    handleComplete();
                    onOpenLocalFolder();
                  }}
                >
                  📁 Open Local PC Folder
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="tour-footer">
          <button
            type="button"
            className="ghost tour-skip-btn"
            onClick={handleComplete}
            title="Skip website tour"
          >
            Skip Tour
          </button>

          <div className="tour-nav-buttons">
            {currentStep > 0 && (
              <button type="button" className="ghost tour-prev-btn" onClick={handlePrev}>
                ← Back
              </button>
            )}
            <button type="button" className="run tour-next-btn" onClick={handleNext}>
              {isLastStep ? "🚀 Start Coding!" : "Next Step →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
