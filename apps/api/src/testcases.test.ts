import { describe, expect, it } from "vitest";
import type { TestCase } from "@compiler-companion/shared";

describe("Test Cases Evaluation Logic", () => {
  function evaluateTestCase(
    tc: { id: string; name: string; input: string; expectedOutput?: string },
    execRes: { status: string; stdout: string; stderr: string; durationMs: number | null },
  ): TestCase {
    let status: TestCase["status"] = "passed";
    let error: string | undefined = undefined;

    if (execRes.status === "timeout") {
      status = "timeout";
      error = "Time Limit Exceeded (Timeout)";
    } else if (execRes.status !== "completed") {
      status = "error";
      error = execRes.stderr || "Runtime or compilation error";
    } else if (
      tc.expectedOutput !== undefined &&
      tc.expectedOutput !== null &&
      tc.expectedOutput.trim() !== ""
    ) {
      const actualNorm = (execRes.stdout ?? "").trim().replace(/\r\n/g, "\n");
      const expectedNorm = tc.expectedOutput.trim().replace(/\r\n/g, "\n");
      if (actualNorm === expectedNorm) {
        status = "passed";
      } else {
        status = "failed";
      }
    } else {
      status = "passed";
    }

    return {
      id: tc.id,
      name: tc.name,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: execRes.stdout,
      status,
      durationMs: execRes.durationMs,
      error: status === "passed" ? undefined : error || execRes.stderr || undefined,
    };
  }

  it("marks matching stdout as passed", () => {
    const res = evaluateTestCase(
      { id: "1", name: "Case 1", input: "5\n", expectedOutput: "10\n" },
      { status: "completed", stdout: "10\n", stderr: "", durationMs: 40 },
    );
    expect(res.status).toBe("passed");
    expect(res.error).toBeUndefined();
  });

  it("marks mismatching stdout as failed", () => {
    const res = evaluateTestCase(
      { id: "2", name: "Case 2", input: "5\n", expectedOutput: "10" },
      { status: "completed", stdout: "15\n", stderr: "", durationMs: 40 },
    );
    expect(res.status).toBe("failed");
    expect(res.actualOutput).toBe("15\n");
  });

  it("marks runtime error as error status with error message", () => {
    const res = evaluateTestCase(
      { id: "3", name: "Case 3", input: "0\n", expectedOutput: "1" },
      { status: "runtime_error", stdout: "", stderr: "ZeroDivisionError", durationMs: 12 },
    );
    expect(res.status).toBe("error");
    expect(res.error).toContain("ZeroDivisionError");
  });

  it("marks timeout as timeout status", () => {
    const res = evaluateTestCase(
      { id: "4", name: "Case 4", input: "1000\n", expectedOutput: "42" },
      { status: "timeout", stdout: "", stderr: "Timeout", durationMs: 5000 },
    );
    expect(res.status).toBe("timeout");
    expect(res.error).toContain("Time Limit Exceeded");
  });
});
