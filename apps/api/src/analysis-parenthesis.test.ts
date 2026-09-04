import { describe, expect, it } from "vitest";
import { DiagnosticProvider } from "./analysis.js";

describe("DiagnosticProvider unmatched parentheses", () => {
  it("proposes a reviewable closing parenthesis", async () => {
    const result = await new DiagnosticProvider().analyze({
      language: "python",
      code: "print('Hello'",
      diagnostics: [
        { severity: "error", message: "File '/workspace/main.py', line 1", line: 1 },
        { severity: "error", message: "SyntaxError: '(' was never closed" },
      ],
    });
    expect(result.patch?.replacement).toBe("print('Hello')");
  });
});
