export const languageIds = ["python", "cpp"] as const;
export type LanguageId = (typeof languageIds)[number];

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  column?: number;
}

export interface ExecutionFile {
  name: string;
  content: string;
}

export interface ExecutionRequest {
  language: LanguageId;
  code: string;
  files?: ExecutionFile[];
  entryFile?: string;
  stdin?: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  fileName: string;
  content: string;
  timestamp: string;
  label?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  speechText?: string;
  patch?: PatchProposal;
  timestamp: string;
}

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;
  actualOutput?: string;
  status: "idle" | "running" | "passed" | "failed" | "error" | "timeout";
  durationMs?: number | null;
  error?: string;
  explanation?: string;
  category?: "Sample" | "Boundary" | "Edge Case" | "Scale" | "Stress";
}

export interface ComplexityResult {
  timeComplexity: string;
  spaceComplexity: string;
  summary: string;
  bottleneck?: string;
  suggestion?: string;
}

export interface TestFixResult {
  message: string;
  speechText?: string;
  replacement: string;
  reason: string;
}

export interface ExecutionResult {
  status: "completed" | "compile_error" | "runtime_error" | "timeout" | "unavailable";
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
  exitCode: number | null;
  durationMs: number | null;
  languageVersion?: string;
}

export interface PatchProposal {
  file: string;
  original: string;
  replacement: string;
  reason: string;
  confidence: number;
}

export interface AnalysisResult {
  classification: "syntax" | "compilation" | "runtime" | "quality" | "unknown";
  summary: string;
  speechText?: string;
  nextStep: string;
  patch?: PatchProposal;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  language: LanguageId;
  content: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}
export interface Project extends ProjectSummary {
  files: WorkspaceFile[];
}
export interface Session {
  token: string;
  user: { id: string; email: string };
}

export function normalizeCodeNewlines(code: string): string {
  if (!code) return "";
  let result = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Only unescape literal "\\n" IF the entire string contains NO actual newlines
  if (!result.includes("\n") && result.includes("\\n")) {
    result = result.replace(/\\n/g, "\n");
  }

  return result.trimEnd() + "\n";
}
