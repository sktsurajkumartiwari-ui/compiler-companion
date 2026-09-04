import type { AnalysisResult, Diagnostic, LanguageId } from "@compiler-companion/shared";

export interface AIProvider {
  analyze(input: {
    code: string;
    language: LanguageId;
    diagnostics: Diagnostic[];
  }): Promise<AnalysisResult>;
}

/** Deterministic fallback: useful only for observed diagnostics, never presented as an LLM response. */
export class DiagnosticProvider implements AIProvider {
  async analyze({
    code,
    language,
    diagnostics,
  }: {
    code: string;
    language: LanguageId;
    diagnostics: Diagnostic[];
  }): Promise<AnalysisResult> {
    const first = diagnostics[0];
    const syntaxDiagnostic = diagnostics.find((diagnostic) =>
      /expected ':'|was never closed|unclosed|unmatched '\)'|unterminated string|unterminated (single|double) quote/i.test(
        diagnostic.message,
      ),
    );
    if (
      language === "python" &&
      /unterminated string|unterminated (single|double) quote/i.test(
        syntaxDiagnostic?.message ?? "",
      )
    ) {
      const lines = code.split("\n");
      const at = (syntaxDiagnostic?.line ?? first?.line ?? 1) - 1;
      const original = lines[at] ?? "";
      const nextLine = lines[at + 1] ?? "";

      // Check if string was split across the current and next line
      if (
        (original.endsWith('"') || original.endsWith("'")) &&
        (nextLine.includes('"') || nextLine.includes("'")) &&
        !nextLine.startsWith("def ") &&
        !nextLine.startsWith("class ")
      ) {
        const quoteChar = original.endsWith('"') ? '"' : "'";
        const prefix = original.slice(0, original.lastIndexOf(quoteChar));
        const merged = `${prefix}${quoteChar}${nextLine.trimStart()}`;
        return {
          classification: "syntax",
          summary: `Line ${at + 1} has a string literal split across lines.`,
          nextStep: "Review the proposed fix to merge the broken string literal.",
          patch: {
            file: "main.py",
            original: `${original}\n${nextLine}`,
            replacement: merged,
            reason: "Merged string literal that was broken across two lines.",
            confidence: 0.98,
          },
        };
      }

      const singleQuotes = (original.match(/'/g) ?? []).length;
      const doubleQuotes = (original.match(/"/g) ?? []).length;
      let replacement = original;
      if (singleQuotes % 2 !== 0) {
        replacement = `${original}'`;
      } else if (doubleQuotes % 2 !== 0) {
        replacement = `${original}"`;
      }
      if (replacement !== original) {
        return {
          classification: "syntax",
          summary: `Line ${at + 1} has an unterminated string literal.`,
          nextStep: "Review the proposed quote fix and apply the patch.",
          patch: {
            file: "main.py",
            original,
            replacement,
            reason: "All string literals must be properly closed with a matching quote.",
            confidence: 0.98,
          },
        };
      }
    }
    if (language === "python" && /expected ':'/.test(syntaxDiagnostic?.message ?? "")) {
      const lines = code.split("\n");
      const at = (syntaxDiagnostic?.line ?? first?.line ?? 1) - 1;
      const original = lines[at] ?? "";
      if (!original.trimEnd().endsWith(":"))
        return {
          classification: "syntax",
          summary: `Python needs a colon at the end of line ${at + 1}.`,
          nextStep: "Review and accept the proposed syntax correction.",
          patch: {
            file: "main.py",
            original,
            replacement: `${original.trimEnd()}:`,
            reason: "Python block statements end with a colon.",
            confidence: 0.98,
          },
        };
    }
    if (
      language === "python" &&
      /was never closed|unclosed/i.test(syntaxDiagnostic?.message ?? "")
    ) {
      const lines = code.split("\n");
      const at = (syntaxDiagnostic?.line ?? first?.line ?? 1) - 1;
      const original = lines[at] ?? "";
      const opens = (original.match(/\(/g) ?? []).length;
      const closes = (original.match(/\)/g) ?? []).length;
      if (opens > closes)
        return {
          classification: "syntax",
          summary: `Line ${at + 1} opens a parenthesis but does not close it.`,
          nextStep: "Review the proposed closing parenthesis, then run the file again.",
          patch: {
            file: "main.py",
            original,
            replacement: `${original}${")".repeat(opens - closes)}`,
            reason: "Every opening parenthesis needs a matching closing parenthesis.",
            confidence: 0.97,
          },
        };
    }
    if (language === "python" && /unmatched '\)'/i.test(syntaxDiagnostic?.message ?? "")) {
      const lines = code.split("\n");
      const at = (syntaxDiagnostic?.line ?? first?.line ?? 1) - 1;
      const original = lines[at] ?? "";
      const opens = (original.match(/\(/g) ?? []).length;
      const closes = (original.match(/\)/g) ?? []).length;
      if (closes > opens)
        return {
          classification: "syntax",
          summary: `Line ${at + 1} has an extra closing parenthesis.`,
          nextStep: "Review the proposed removal, then run the file again.",
          patch: {
            file: "main.py",
            original,
            replacement: original.replace(/\)(?!.*\))/, ""),
            reason: "The statement has more closing than opening parentheses.",
            confidence: 0.97,
          },
        };
    }
    if (first)
      return {
        classification: /traceback|exception|runtime/i.test(first.message)
          ? "runtime"
          : "compilation",
        summary: `The runner reported: ${first.message}`,
        nextStep: "Inspect the highlighted diagnostic, then make or request a targeted patch.",
      };
    return {
      classification: "unknown",
      summary: "No compiler diagnostic is available yet.",
      nextStep:
        "Run the code first, or select the relevant code and describe the intended behavior.",
    };
  }
}
