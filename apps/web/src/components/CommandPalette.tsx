import { useEffect, useState, useRef } from "react";

export interface CommandItem {
  id: string;
  category: string;
  title: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredCommands = commands.filter((cmd) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-row">
          <span className="command-prefix">❯</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
          />
        </div>

        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-empty-state">No matching commands</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`command-item ${idx === selectedIndex ? "selected" : ""}`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="command-left">
                  <span className="command-category">{cmd.category}</span>
                  <span className="command-title">{cmd.title}</span>
                </div>
                {cmd.shortcut && <span className="command-shortcut">{cmd.shortcut}</span>}
              </div>
            ))
          )}
        </div>

        <div className="command-palette-footer">
          <span>↑↓ to navigate</span>
          <span>↵ to execute</span>
          <span>esc to dismiss</span>
        </div>
      </div>
    </div>
  );
}
