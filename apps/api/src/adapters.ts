import "./config.js";
import type { Diagnostic, LanguageId } from "@compiler-companion/shared";

export interface LanguageAdapter {
  id: LanguageId;
  label: string;
  extension: string;
  image: string;
  timeoutMs: number;
  memoryMb: number;
  sourceFile: string;
  command: string[];
  getCommand(entryFile?: string): string[];
  versionCommand: string[];
  parseDiagnostics(stderr: string): Diagnostic[];
}

const genericDiagnostics = (stderr: string): Diagnostic[] =>
  stderr
    .split("\n")
    .filter(Boolean)
    .map((message) => {
      const match = message.match(/(?:line\s+|:)(\d+)(?::(\d+))?/i);
      return {
        severity: "error" as const,
        message,
        line: match ? Number(match[1]) : undefined,
        column: match?.[2] ? Number(match[2]) : undefined,
      };
    });

export const adapters: Record<LanguageId, LanguageAdapter> = {
  python: {
    id: "python",
    label: "Python 3",
    extension: ".py",
    image: process.env.PYTHON_IMAGE ?? "compiler-companion-python:latest",
    timeoutMs: 10_000,
    memoryMb: 128,
    sourceFile: "main.py",
    command: ["python3", "-u", "/workspace/main.py"],
    getCommand(entryFile?: string) {
      const target = entryFile ? entryFile.replace(/^.*[\\/]/, "") : "main.py";
      return ["python3", "-u", `/workspace/${target}`];
    },
    versionCommand: ["python3", "--version"],
    parseDiagnostics: genericDiagnostics,
  },
  cpp: {
    id: "cpp",
    label: "C++ (GCC)",
    extension: ".cpp",
    image: process.env.CPP_IMAGE ?? "compiler-companion-cpp:latest",
    timeoutMs: 10_000,
    memoryMb: 256,
    sourceFile: "main.cpp",
    command: [
      "sh",
      "-c",
      "g++ -std=c++20 -O2 -I/workspace /workspace/*.cpp -o /run/program && /run/program",
    ],
    getCommand() {
      return [
        "sh",
        "-c",
        "g++ -std=c++20 -O2 -I/workspace /workspace/*.cpp -o /run/program && /run/program",
      ];
    },
    versionCommand: ["g++", "--version"],
    parseDiagnostics: genericDiagnostics,
  },
};
