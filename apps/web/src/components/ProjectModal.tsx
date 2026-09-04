import type { LanguageId } from "@compiler-companion/shared";

interface ProjectModalProps {
  projectName: string;
  projectLanguage: LanguageId;
  thinking: boolean;
  onNameChange: (value: string) => void;
  onLanguageChange: (value: LanguageId) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ProjectModal({
  projectName,
  projectLanguage,
  thinking,
  onNameChange,
  onLanguageChange,
  onSubmit,
  onClose,
}: ProjectModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="project-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="modal-icon">◈</span>
        <h2>New project</h2>
        <p>Choose a language and start from a runnable template.</p>
        <label>
          Project name
          <input
            autoFocus
            value={projectName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. hello-world"
          />
        </label>
        <div className="language-cards">
          <button
            type="button"
            className={projectLanguage === "python" ? "chosen" : ""}
            onClick={() => onLanguageChange("python")}
          >
            <b>Python</b>
            <span>main.py · Python 3</span>
          </button>
          <button
            type="button"
            className={projectLanguage === "cpp" ? "chosen" : ""}
            onClick={() => onLanguageChange("cpp")}
          >
            <b>C++</b>
            <span>main.cpp · GCC</span>
          </button>
        </div>
        <button className="run" disabled={!projectName.trim() || thinking}>
          Create project
        </button>
      </form>
    </div>
  );
}
