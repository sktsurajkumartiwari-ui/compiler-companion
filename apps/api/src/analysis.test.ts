import { describe, expect, it } from "vitest";
import { DiagnosticProvider } from "./analysis.js";

describe("DiagnosticProvider", () => {
  it("proposes a reviewable colon fix for a Python diagnostic", async () => {
    const result = await new DiagnosticProvider().analyze({
      language: "python",
      code: "if True\n  print('hi')",
      diagnostics: [{ severity: "error", message: "expected ':'", line: 1 }],
    });
    expect(result.patch?.replacement).toBe("if True:");
  });

  it("proposes a reviewable quote fix for unterminated string", async () => {
    const result = await new DiagnosticProvider().analyze({
      language: "python",
      code: "def divide(a, b):\n  return 'Error: Division by zero!",
      diagnostics: [
        {
          severity: "error",
          message: "SyntaxError: unterminated string literal (detected at line 2)",
          line: 2,
        },
      ],
    });
    expect(result.patch?.replacement).toBe("  return 'Error: Division by zero!'");
  });

  it("proposes a fix for string split across two lines", async () => {
    const result = await new DiagnosticProvider().analyze({
      language: "python",
      code: 'def calc():\n  print("\nSimple Calculator")\n  print("1. Add")',
      diagnostics: [
        {
          severity: "error",
          message: "SyntaxError: unterminated string literal (detected at line 2)",
          line: 2,
        },
      ],
    });
    expect(result.patch?.replacement).toBe('  print("Simple Calculator")');
  });
});
