import { useState, useMemo, type ReactNode } from "react";

interface MarkdownMessageProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="chatgpt-code-block">
      <div className="chatgpt-code-header">
        <span className="code-lang-label">{language || "code"}</span>
        <button type="button" className="code-copy-btn" onClick={handleCopy}>
          {copied ? "✓ Copied!" : "📋 Copy code"}
        </button>
      </div>
      <pre className="chatgpt-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Parses inline formatting like **bold**, *italic*, and `inline code`
 */
function parseInline(text: string): ReactNode[] {
  // Regex matches: `code` or **bold** or *italic*
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={index} className="chatgpt-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="chatgpt-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="chatgpt-italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

/**
 * ChatGPT-style Markdown Message Renderer
 */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const elements = useMemo(() => {
    if (!content) return null;

    // Normalize newlines
    const normalized = content.replace(/\r\n/g, "\n");

    // Split text by fenced code blocks: ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/g;
    const segments: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(normalized)) !== null) {
      // Process text preceding the code block
      const textBefore = normalized.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push(renderTextSections(textBefore, `text-${lastIndex}`));
      }

      // Add the code block
      const language = match[1]?.trim() || "code";
      const code = match[2]?.replace(/\n$/, "") ?? "";
      segments.push(<CodeBlock key={`code-${match.index}`} language={language} code={code} />);

      lastIndex = match.index + match[0].length;
    }

    // Process remaining text after the last code block
    const remainingText = normalized.slice(lastIndex);
    if (remainingText.trim()) {
      segments.push(renderTextSections(remainingText, `text-${lastIndex}`));
    }

    return segments;
  }, [content]);

  return <div className="chatgpt-markdown-container">{elements}</div>;
}

/**
 * Renders paragraphs, headings, blockquotes, and lists
 */
function renderTextSections(text: string, keyPrefix: string): ReactNode {
  // Split by double newline to separate paragraphs/blocks
  const blocks = text.split(/\n{2,}/);

  return (
    <div key={keyPrefix} className="chatgpt-text-block">
      {blocks.map((block, blockIndex) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const blockKey = `${keyPrefix}-b-${blockIndex}`;

        // Headings
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={blockKey} className="chatgpt-heading h3">
              {parseInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={blockKey} className="chatgpt-heading h2">
              {parseInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={blockKey} className="chatgpt-heading h1">
              {parseInline(trimmed.slice(2))}
            </h2>
          );
        }

        // Blockquotes
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={blockKey} className="chatgpt-blockquote">
              {parseInline(trimmed.replace(/^>\s?/gm, ""))}
            </blockquote>
          );
        }

        // Lists (numbered or bulleted)
        const lines = trimmed.split("\n");
        const isBulletList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

        if (isBulletList) {
          return (
            <ul key={blockKey} className="chatgpt-list bullet">
              {lines.map((line, liIndex) => (
                <li key={liIndex} className="chatgpt-list-item">
                  {parseInline(line.replace(/^\s*[-*•]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol key={blockKey} className="chatgpt-list numbered">
              {lines.map((line, liIndex) => (
                <li key={liIndex} className="chatgpt-list-item">
                  {parseInline(line.replace(/^\s*\d+\.\s+/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        // Standard Paragraph (handle single newlines inside paragraph)
        return (
          <p key={blockKey} className="chatgpt-paragraph">
            {lines.map((line, lineIdx) => (
              <span key={lineIdx}>
                {parseInline(line)}
                {lineIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
