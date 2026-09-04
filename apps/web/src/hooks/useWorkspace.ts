import { useEffect, useRef, useState } from "react";
import {
  type AnalysisResult,
  type ChatMessage,
  type ComplexityResult,
  type Diagnostic,
  type ExecutionResult,
  type FileVersion,
  type LanguageId,
  normalizeCodeNewlines,
  type PatchProposal,
  type Project,
  type ProjectSummary,
  type Session,
  type TestCase,
  type WorkspaceFile,
} from "@compiler-companion/shared";
import { call } from "../api";
import { useTerminal } from "./useTerminal";
import { useLocalFileSystem } from "./useLocalFileSystem";
import { useVoiceAssistant } from "./useVoiceAssistant";

interface HistoryEntry {
  fileId: string;
  content: string;
}

export type WorkspaceTab = "terminal" | "output" | "diagnostics" | "testcases";
export type SaveStatus = "saved" | "saving" | "unsaved";
export type NovaPersona = "mentor" | "architect" | "concise";

interface UseWorkspaceReturn {
  // State
  projects: ProjectSummary[];
  project: Project | null;
  file: WorkspaceFile | null;
  note: string;
  result: ExecutionResult | null;
  analysis: AnalysisResult | null;
  messages: ChatMessage[];
  thinking: boolean;
  prompt: string;
  stdin: string;
  createOpen: boolean;
  projectName: string;
  projectLanguage: LanguageId;
  activeTab: WorkspaceTab;
  terminal: ReturnType<typeof useTerminal>;
  autoSaveEnabled: boolean;
  saveStatus: SaveStatus;
  isLocalMode: boolean;
  localFolderName: string | null;
  localFiles: WorkspaceFile[];
  voice: ReturnType<typeof useVoiceAssistant>;
  persona: NovaPersona;
  versions: FileVersion[];
  historyOpen: boolean;
  diffOpen: boolean;
  diffData: { original: string; replacement: string; reason?: string } | null;

  // Student Features: Test Suite, Complexity, Templates
  testCases: TestCase[];
  isRunningTests: boolean;
  isGeneratingTests: boolean;
  isAutoFixingTests: boolean;
  complexity: ComplexityResult | null;
  complexityOpen: boolean;
  isAnalyzingComplexity: boolean;
  templatesOpen: boolean;
  testCasePatches: Record<string, PatchProposal>;

  // Actions
  openProject: (id: string) => Promise<void>;
  openCreate: () => void;
  createProject: () => Promise<void>;
  deleteProject: (id: string, name: string) => Promise<void>;
  renameProject: (id: string, currentName: string) => Promise<void>;
  addFile: () => Promise<void>;
  deleteFile: (file: WorkspaceFile) => Promise<void>;
  renameFile: (file: WorkspaceFile) => Promise<void>;
  selectFile: (file: WorkspaceFile) => void;
  updateCode: (content: string) => void;
  save: () => Promise<void>;
  run: () => Promise<void>;
  analyze: (isVoicePrompt?: boolean) => Promise<void>;
  applyPatch: (customPatch?: PatchProposal) => void;
  applyPatchAndRunTests: (customPatch?: PatchProposal) => void;
  undoFix: () => void;
  askNova: (customQuery?: string, isVoicePrompt?: boolean) => Promise<void>;
  clearChat: () => void;
  setPersona: (persona: NovaPersona) => void;
  openHistory: () => void;
  closeHistory: () => void;
  restoreVersion: (version: FileVersion) => Promise<void>;
  openDiff: (original: string, replacement: string, reason?: string) => void;
  closeDiff: () => void;
  toggleAutoSave: () => void;
  downloadFile: () => void;
  openLocalFolder: () => Promise<void>;
  closeLocalFolder: () => void;

  // Test Suite & Student Actions
  addTestCase: () => void;
  deleteTestCase: (id: string) => void;
  updateTestCase: (
    id: string,
    updates: Partial<Pick<TestCase, "name" | "input" | "expectedOutput">>,
  ) => void;
  runTestCases: () => Promise<void>;
  generateTestCases: () => Promise<void>;
  debugTestCaseFailure: (testCase: TestCase) => Promise<void>;
  autoFixTestCase: (testCase: TestCase) => Promise<void>;
  openComplexity: () => Promise<void>;
  closeComplexity: () => void;
  openTemplates: () => void;
  closeTemplates: () => void;
  insertTemplate: (templateCode: string) => void;

  // Setters for simple state
  setPrompt: (value: string) => void;
  setStdin: (value: string) => void;
  setCreateOpen: (value: boolean) => void;
  setProjectName: (value: string) => void;
  setProjectLanguage: (value: LanguageId) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
}

export function useWorkspace(session: Session, onSignOut?: () => void): UseWorkspaceReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [note, setNote] = useState("Create a project or open a local folder on your PC to start.");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [persona, setPersona] = useState<NovaPersona>("mentor");
  const [thinking, setThinking] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [stdin, setStdin] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLanguage, setProjectLanguage] = useState<LanguageId>("python");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("terminal");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Version history & Diff Viewer state
  const [versions, setVersions] = useState<FileVersion[]>(() => {
    try {
      const stored = localStorage.getItem("compiler-companion-versions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<{
    original: string;
    replacement: string;
    reason?: string;
  } | null>(null);

  // Student Features State
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: "tc-1",
      name: "Case 1",
      input: "",
      expectedOutput: "",
      status: "idle",
    },
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [complexity, setComplexity] = useState<ComplexityResult | null>(null);
  const [complexityOpen, setComplexityOpen] = useState(false);
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isAutoFixingTests, setIsAutoFixingTests] = useState(false);
  const [testCasePatches, setTestCasePatches] = useState<Record<string, PatchProposal>>({});

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("compiler-companion-autosave");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const token = session.token;
  const localFs = useLocalFileSystem();
  const isLocalModeRef = useRef(localFs.isLocalMode);
  useEffect(() => {
    isLocalModeRef.current = localFs.isLocalMode;
  }, [localFs.isLocalMode]);

  // Keep active file in sync when local folder is active or restored
  useEffect(() => {
    if (localFs.isLocalMode && localFs.localFiles.length > 0) {
      if (!file || !localFs.localFiles.some((f) => f.id === file.id)) {
        setFile(localFs.localFiles[0]);
        setSaveStatus("saved");
      }
    }
  }, [localFs.isLocalMode, localFs.localFiles, file]);

  // Load test cases when active file changes
  useEffect(() => {
    if (!file) return;
    try {
      const stored = localStorage.getItem(`compiler-companion-tc-${file.id}`);
      if (stored) {
        setTestCases(JSON.parse(stored));
        return;
      }
    } catch {
      // Ignore localStorage read error
    }

    // Default test case for file
    setTestCases([
      {
        id: `${Date.now()}-1`,
        name: "Case 1",
        input: "",
        expectedOutput: "",
        status: "idle",
      },
    ]);
  }, [file?.id]);

  const saveTestCases = (updated: TestCase[]) => {
    setTestCases(updated);
    if (file?.id) {
      try {
        localStorage.setItem(`compiler-companion-tc-${file.id}`, JSON.stringify(updated));
      } catch {
        // Ignore localStorage write error
      }
    }
  };

  const addTestCase = () => {
    const newCase: TestCase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Case ${testCases.length + 1}`,
      input: "",
      expectedOutput: "",
      status: "idle",
    };
    saveTestCases([...testCases, newCase]);
  };

  const deleteTestCase = (id: string) => {
    saveTestCases(testCases.filter((tc) => tc.id !== id));
  };

  const updateTestCase = (
    id: string,
    updates: Partial<Pick<TestCase, "name" | "input" | "expectedOutput">>,
  ) => {
    saveTestCases(
      testCases.map((tc) => (tc.id === id ? { ...tc, ...updates, status: "idle" } : tc)),
    );
  };

  const runTestCases = async () => {
    if (!file || testCases.length === 0) return;
    await save();
    setIsRunningTests(true);
    setActiveTab("testcases");

    // Set status to running
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: "running" })));

    try {
      const allFiles: Array<{ name: string; content: string }> = localFs.isLocalMode
        ? localFs.localFiles.map((f) => ({ name: f.name, content: f.content }))
        : project
          ? project.files.map((f) => ({ name: f.name, content: f.content }))
          : [{ name: file.name, content: file.content }];

      const res = await call<{ testCases: TestCase[] }>(
        "/execute/testcases",
        {
          method: "POST",
          body: JSON.stringify({
            language: file.language,
            code: file.content,
            files: allFiles,
            entryFile: file.name,
            testCases: testCases.map((tc) => ({
              id: tc.id,
              name: tc.name,
              category: tc.category,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              explanation: tc.explanation,
            })),
          }),
        },
        token,
      );

      saveTestCases(res.testCases);
      const passed = res.testCases.filter((t) => t.status === "passed").length;
      setNote(`Test Suite: ${passed}/${res.testCases.length} Passed.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to run test cases.");
      setTestCases((prev) =>
        prev.map((tc) => ({ ...tc, status: "error", error: "Execution failed" })),
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  const generateTestCases = async () => {
    if (!file) return;
    setIsGeneratingTests(true);
    setNote("Nova is analyzing code to generate standard and edge test cases…");

    try {
      const res = await call<{
        testCases: Array<{
          name: string;
          category?: TestCase["category"];
          input: string;
          expectedOutput: string;
          explanation?: string;
        }>;
      }>(
        "/testcases/generate",
        {
          method: "POST",
          body: JSON.stringify({
            language: file.language,
            code: file.content,
          }),
        },
        token,
      );

      if (res.testCases && res.testCases.length > 0) {
        const mapped: TestCase[] = res.testCases.map((tc, idx) => ({
          id: `${Date.now()}-${idx}`,
          name: tc.name || `Case ${idx + 1}`,
          category: tc.category,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          explanation: tc.explanation,
          status: "idle",
        }));
        saveTestCases(mapped);
        setActiveTab("testcases");
        setNote(`Nova generated ${mapped.length} test cases with edge cases.`);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to generate test cases.");
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const debugTestCaseFailure = async (testCase: TestCase) => {
    const query = `My code failed on test case "${testCase.name}"${testCase.category ? ` (${testCase.category})` : ""}.\nInput:\n\`\`\`\n${testCase.input}\n\`\`\`\nExpected Output:\n\`\`\`\n${testCase.expectedOutput ?? "(None)"}\n\`\`\`\nActual Program Output:\n\`\`\`\n${testCase.actualOutput || "(No stdout produced)"}\n\`\`\`\n${testCase.error ? `Error / Stderr:\n\`\`\`\n${testCase.error}\n\`\`\`\n` : ""}Please explain what logic went wrong on this input and provide the 1-shot fix.`;
    await askNova(query);
  };

  const autoFixTestCase = async (testCase: TestCase) => {
    if (!file) return;
    setIsAutoFixingTests(true);
    setThinking(true);
    setNote(`Nova is analyzing failed test "${testCase.name}" and engineering a 1-shot fix...`);

    try {
      const allFiles: Array<{ name: string; content: string }> = localFs.isLocalMode
        ? localFs.localFiles.map((f) => ({ name: f.name, content: f.content }))
        : project
          ? project.files.map((f) => ({ name: f.name, content: f.content }))
          : [{ name: file.name, content: file.content }];

      const reply = await call<{
        message: string;
        speechText?: string;
        replacement?: string;
        reason?: string;
      }>(
        "/testcases/fix",
        {
          method: "POST",
          body: JSON.stringify({
            language: file.language,
            code: file.content,
            failedTestCase: testCase,
            allTestCases: testCases,
            files: allFiles,
            entryFile: file.name,
          }),
        },
        token,
      );

      if (reply.replacement) {
        const normalizedReplacement = normalizeCodeNewlines(reply.replacement);
        const patchProposal: PatchProposal = {
          file: file.name,
          original: file.content,
          replacement: normalizedReplacement,
          reason: reply.reason || `Fix for test case "${testCase.name}"`,
          confidence: 0.98,
        };

        const userMsg: ChatMessage = {
          id: `${Date.now()}-u`,
          role: "user",
          content: `Fix failed test case "${testCase.name}" (${testCase.category || "Test Case"}):\n- Input: \`${testCase.input}\`\n- Expected: \`${testCase.expectedOutput ?? ""}\`\n- Actual: \`${testCase.actualOutput || testCase.error || "Failed"}\``,
          timestamp: new Date().toISOString(),
        };

        const assistantMsg: ChatMessage = {
          id: `${Date.now()}-a`,
          role: "assistant",
          content: reply.message,
          speechText: reply.speechText,
          patch: patchProposal,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        setAnalysis({
          classification: "quality",
          summary: reply.message,
          speechText: reply.speechText,
          nextStep: "Review the proposed code fix in the diff viewer or click 'Apply to Editor'.",
          patch: patchProposal,
        });

        setTestCasePatches((prev) => ({
          ...prev,
          [testCase.id]: patchProposal,
        }));

        setNote(
          `Nova prepared a fix for "${testCase.name}". Review the code and click 'Apply to Editor'.`,
        );

        if (voice.isVoiceMode && reply.speechText) {
          voice.speak(reply.speechText);
        }
      } else {
        setNote(reply.message || "Nova could not generate a code fix for this test case.");
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to auto-fix test case.");
    } finally {
      setIsAutoFixingTests(false);
      setThinking(false);
    }
  };

  function applyPatchAndRunTests(customPatch?: PatchProposal) {
    applyPatch(customPatch);
    setNote("Fix applied to editor. Re-running test suite in Docker...");
    setTimeout(() => {
      void runTestCases();
    }, 400);
  }

  const openComplexity = async () => {
    setComplexityOpen(true);
    if (!file) return;
    setIsAnalyzingComplexity(true);
    try {
      const res = await call<ComplexityResult>(
        "/complexity",
        {
          method: "POST",
          body: JSON.stringify({
            language: file.language,
            code: file.content,
          }),
        },
        token,
      );
      setComplexity(res);
    } catch (err) {
      setComplexity({
        timeComplexity: "Unknown",
        spaceComplexity: "Unknown",
        summary: err instanceof Error ? err.message : "Failed to evaluate complexity.",
      });
    } finally {
      setIsAnalyzingComplexity(false);
    }
  };

  const closeComplexity = () => setComplexityOpen(false);

  const openTemplates = () => setTemplatesOpen(true);
  const closeTemplates = () => setTemplatesOpen(false);

  const insertTemplate = (templateCode: string) => {
    updateCode(templateCode);
    setNote("Inserted template into editor.");
    void save();
  };

  const addVersion = (fileId: string, fileName: string, content: string, label = "Save") => {
    setVersions((prev) => {
      const last = prev.find((v) => v.fileName === fileName);
      if (last && last.content === content) return prev;

      const newVersion: FileVersion = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileId,
        fileName,
        content,
        timestamp: new Date().toISOString(),
        label,
      };
      const updated = [newVersion, ...prev.slice(0, 49)];
      try {
        localStorage.setItem("compiler-companion-versions", JSON.stringify(updated));
      } catch {
        // Ignore localStorage error
      }
      return updated;
    });
  };

  const openHistory = () => setHistoryOpen(true);
  const closeHistory = () => setHistoryOpen(false);

  const restoreVersion = async (version: FileVersion) => {
    updateCode(version.content);
    addVersion(version.fileId, version.fileName, version.content, "Restored snapshot");
    setNote(`Restored snapshot of ${version.fileName}.`);
  };

  const openDiff = (original: string, replacement: string, reason?: string) => {
    setDiffData({ original, replacement, reason });
    setDiffOpen(true);
  };

  const closeDiff = () => {
    setDiffOpen(false);
    setDiffData(null);
  };

  const clearChat = () => {
    setMessages([]);
    setAnalysis(null);
    setNote("Conversation cleared.");
  };

  const voice = useVoiceAssistant({
    onTranscript: (text) => {
      setPrompt(text);
    },
    onVoiceCommand: (command, text) => {
      if (command === "run") {
        setNote("Voice command: Running code...");
        void run();
      } else if (command === "save") {
        setNote("Voice command: Saving file...");
        void save();
      } else if (command === "fix") {
        setNote("Voice command: Analyzing errors...");
        void analyze(true);
      } else {
        setPrompt(text);
        void askNova(text, true);
      }
    },
  });

  const terminal = useTerminal({
    onExit: (stdout, stderr, exitCode) => {
      setThinking(false);
      const diagnostics: Diagnostic[] = stderr
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

      const status =
        exitCode === 0
          ? "completed"
          : file?.language === "cpp" && /error:/i.test(stderr)
            ? "compile_error"
            : "runtime_error";

      setResult({
        status,
        stdout,
        stderr,
        diagnostics,
        exitCode,
        durationMs: null,
      });

      if (stderr) {
        setNote(stderr.split("\n")[0] || "Execution completed with errors.");
      } else {
        setNote(stdout ? "Program finished successfully." : "Execution completed.");
      }
    },
  });

  async function refresh() {
    const items = await call<ProjectSummary[]>("/projects", {}, token);
    setProjects(items);
    let lastMode: string | null = null;
    try {
      lastMode = localStorage.getItem("compiler-companion-mode");
    } catch {
      // Ignore
    }
    const isLocal = isLocalModeRef.current || lastMode === "local";
    if (!project && !isLocal && items[0]) {
      await openProject(items[0].id, false);
    }
  }

  useEffect(() => {
    void refresh().catch((error: Error) => {
      if (/invalid session|sign in is required/i.test(error.message)) {
        onSignOut?.();
        return;
      }
      setNote(error.message);
    });
  }, []);

  async function openProject(id: string, closeLocal = true) {
    if (closeLocal) {
      localFs.closeFolder();
    }
    const next = await call<Project>(`/projects/${id}`, {}, token);
    setProject(next);
    if (closeLocal || !isLocalModeRef.current) {
      setFile(next.files[0] ?? null);
    }
    setResult(null);
    setAnalysis(null);
    setSaveStatus("saved");
  }

  async function openLocalFolder() {
    try {
      const res = await localFs.openFolder();
      if (res) {
        setFile(res.files[0] ?? null);
        setResult(null);
        setAnalysis(null);
        setSaveStatus("saved");
        setNote(`Opened PC folder: ${res.name} (Direct Disk Saving Active)`);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to open local folder.");
    }
  }

  function closeLocalFolder() {
    localFs.closeFolder();
    if (project) {
      setFile(project.files[0] ?? null);
    }
    setNote("Switched back to cloud workspace.");
  }

  function openCreate() {
    setProjectName("");
    setProjectLanguage("python");
    setCreateOpen(true);
  }

  async function createProject() {
    if (!projectName.trim()) return;
    setThinking(true);
    try {
      const created = await call<Project>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({
            name: projectName.trim(),
            language: projectLanguage,
          }),
        },
        token,
      );
      await refresh();
      localFs.closeFolder();
      setProject(created);
      setFile(created.files[0]);
      setCreateOpen(false);
      setNote(`${created.name} created.`);
      setSaveStatus("saved");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Project could not be created.");
    } finally {
      setThinking(false);
    }
  }

  async function deleteProject(id: string, name: string) {
    const confirm = window.confirm(`Are you sure you want to delete project "${name}"?`);
    if (!confirm) return;

    try {
      await call(`/projects/${id}`, { method: "DELETE" }, token);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (project?.id === id) {
        if (remaining[0]) {
          await openProject(remaining[0].id);
        } else {
          setProject(null);
          setFile(null);
        }
      }
      setNote(`Deleted project ${name}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to delete project.");
    }
  }

  async function renameProject(id: string, currentName: string) {
    const nextName = window.prompt("New project name:", currentName);
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;
    const cleanName = nextName.trim();

    try {
      await call(
        `/projects/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: cleanName }),
        },
        token,
      );
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: cleanName } : p)));
      if (project?.id === id) {
        setProject({ ...project, name: cleanName });
      }
      setNote(`Renamed project to ${cleanName}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to rename project.");
    }
  }

  async function addFile() {
    if (localFs.isLocalMode) {
      const name = window.prompt(
        "Enter file name with extension (e.g. calculator.py, helper.cpp, utils.h):",
        "new_file.py",
      );
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      try {
        const created = await localFs.createLocalFile(cleanName);
        if (created) {
          setFile(created);
          setSaveStatus("saved");
          setNote(`Created local file ${cleanName} on your PC.`);
        }
      } catch (err) {
        setNote(err instanceof Error ? err.message : "Failed to create file on disk.");
      }
      return;
    }

    if (!project) return;
    const name = window.prompt("File name with extension (e.g. helper.py, utils.h):", "helper.py");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const language: LanguageId = /\.(cpp|cc|cxx|h|hpp)$/i.test(cleanName) ? "cpp" : "python";
    const created = await call<WorkspaceFile>(
      `/projects/${project.id}/files`,
      {
        method: "POST",
        body: JSON.stringify({ name: cleanName, language }),
      },
      token,
    );
    setProject({ ...project, files: [...project.files, created] });
    setFile(created);
    setSaveStatus("saved");
  }

  async function deleteFile(targetFile: WorkspaceFile) {
    const confirm = window.confirm(`Delete "${targetFile.name}"?`);
    if (!confirm) return;

    if (localFs.isLocalMode) {
      const deleted = await localFs.deleteLocalFile(targetFile.name);
      if (deleted) {
        if (file?.id === targetFile.id) {
          const remaining = localFs.localFiles.filter((f) => f.id !== targetFile.id);
          setFile(remaining[0] ?? null);
        }
        setNote(`Deleted ${targetFile.name} from local disk.`);
      }
      return;
    }

    if (!project) return;
    try {
      await call(`/projects/${project.id}/files/${targetFile.id}`, { method: "DELETE" }, token);
      const remaining = project.files.filter((f) => f.id !== targetFile.id);
      setProject({ ...project, files: remaining });
      if (file?.id === targetFile.id) {
        setFile(remaining[0] ?? null);
      }
      setNote(`Deleted ${targetFile.name}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to delete file.");
    }
  }

  async function renameFile(targetFile: WorkspaceFile) {
    const nextName = window.prompt("New file name:", targetFile.name);
    if (!nextName || !nextName.trim() || nextName.trim() === targetFile.name) return;
    const cleanName = nextName.trim();

    if (localFs.isLocalMode) {
      try {
        const created = await localFs.createLocalFile(cleanName);
        if (created) {
          await localFs.saveLocalFile(cleanName, targetFile.content);
          await localFs.deleteLocalFile(targetFile.name);
          setFile({ ...created, content: targetFile.content });
          setNote(`Renamed to ${cleanName} on disk.`);
        }
      } catch (err) {
        setNote(err instanceof Error ? err.message : "Failed to rename local file.");
      }
      return;
    }

    if (!project) return;
    try {
      const updated = await call<WorkspaceFile>(
        `/projects/${project.id}/files/${targetFile.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: cleanName }),
        },
        token,
      );
      setProject({
        ...project,
        files: project.files.map((f) => (f.id === updated.id ? updated : f)),
      });
      if (file?.id === targetFile.id) {
        setFile(updated);
      }
      setNote(`Renamed to ${cleanName}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed to rename file.");
    }
  }

  function selectFile(newFile: WorkspaceFile) {
    setFile(newFile);
    setSaveStatus("saved");
  }

  function updateCode(content: string) {
    if (!file) return;
    setFile({ ...file, content });
    setSaveStatus("unsaved");
  }

  async function save() {
    if (!file) return;

    if (localFs.isLocalMode) {
      setSaveStatus("saving");
      try {
        const saved = await localFs.saveLocalFile(file.name, file.content);
        if (saved) {
          setFile(saved);
          setSaveStatus("saved");
          addVersion(file.id, file.name, file.content, "Manual Save");
          setNote(`Saved ${file.name} directly to PC disk.`);
        }
      } catch (error) {
        setSaveStatus("unsaved");
        setNote(error instanceof Error ? error.message : "Failed to save file to local disk.");
      }
      return;
    }

    if (!project) return;
    setSaveStatus("saving");
    try {
      const saved = await call<WorkspaceFile>(
        `/projects/${project.id}/files/${file.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: file.content }),
        },
        token,
      );
      setFile(saved);
      setProject({
        ...project,
        files: project.files.map((item) => (item.id === saved.id ? saved : item)),
      });
      setSaveStatus("saved");
      addVersion(file.id, file.name, file.content, "Manual Save");
      setNote("Saved.");
    } catch (error) {
      setSaveStatus("unsaved");
      setNote(error instanceof Error ? error.message : "Failed to save file.");
    }
  }

  function toggleAutoSave() {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("compiler-companion-autosave", String(next));
      } catch {
        // Ignore localStorage error
      }
      setNote(next ? "Auto-Save is ON." : "Auto-Save is OFF.");
      return next;
    });
  }

  function downloadFile() {
    if (!file) return;
    try {
      const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || (file.language === "python" ? "main.py" : "main.cpp");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNote(`Downloaded ${file.name} to local device.`);
    } catch {
      setNote("Failed to download file.");
    }
  }

  // Debounced auto-save effect
  useEffect(() => {
    if (!autoSaveEnabled || !file || saveStatus !== "unsaved") return;

    const timer = setTimeout(() => {
      void save();
    }, 800);

    return () => clearTimeout(timer);
  }, [autoSaveEnabled, file?.content, saveStatus, project?.id, file?.id, localFs.isLocalMode]);

  async function run() {
    if (!file) return;
    await save();
    setActiveTab("terminal");
    setAnalysis(null);

    // Collect all project files for multi-file sandboxing
    const allFiles: Array<{ name: string; content: string }> = localFs.isLocalMode
      ? localFs.localFiles.map((f) => ({ name: f.name, content: f.content }))
      : project
        ? project.files.map((f) => ({ name: f.name, content: f.content }))
        : [{ name: file.name, content: file.content }];

    await terminal.start(file.language, file.content, allFiles, file.name);
  }

  async function analyze(isVoicePrompt = false) {
    if (!file) return;
    setThinking(true);
    try {
      const diagnostics: Diagnostic[] = result?.diagnostics ?? [];
      const next = await call<AnalysisResult>("/analyze", {
        method: "POST",
        body: JSON.stringify({
          language: file.language,
          code: file.content,
          diagnostics,
        }),
      });
      setAnalysis(next);
      setNote(next.summary);
      if (isVoicePrompt && next.summary) voice.speak(next.summary);
    } finally {
      setThinking(false);
    }
  }

  function applyPatch(customPatch?: PatchProposal) {
    const targetPatch = customPatch || analysis?.patch;
    if (!file || !targetPatch) return;

    // Snapshot version before applying AI patch
    addVersion(file.id, file.name, file.content, "Before AI Fix");

    setHistory((items) => [...items, { fileId: file.id, content: file.content }]);

    const cleanReplacement = normalizeCodeNewlines(targetPatch.replacement);
    const isFullFile =
      !targetPatch.original ||
      targetPatch.original === file.content ||
      cleanReplacement.split("\n").length > 3 ||
      targetPatch.original.trim().length === 0;

    let finalCode = cleanReplacement;
    if (isFullFile) {
      updateCode(cleanReplacement);
    } else {
      const cleanOriginal = normalizeCodeNewlines(targetPatch.original).trimEnd();
      if (file.content.includes(cleanOriginal)) {
        finalCode = file.content.replace(cleanOriginal, cleanReplacement.trimEnd());
        updateCode(finalCode);
      } else {
        updateCode(cleanReplacement);
      }
    }

    // Snapshot version after applying AI patch
    addVersion(file.id, file.name, finalCode, "Applied AI Fix");

    setResult(null);
    setAnalysis(null);
    setNote("Code applied to editor. Saving...");

    // Immediate save to disk
    if (localFs.isLocalMode) {
      void localFs.saveLocalFile(file.name, finalCode).then((saved) => {
        if (saved) {
          setFile(saved);
          setSaveStatus("saved");
          setNote(`Saved ${file.name} to PC disk.`);
        }
      });
    } else if (project) {
      void call<WorkspaceFile>(
        `/projects/${project.id}/files/${file.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: finalCode }),
        },
        token,
      ).then((saved) => {
        setFile(saved);
        setProject({
          ...project,
          files: project.files.map((item) => (item.id === saved.id ? saved : item)),
        });
        setSaveStatus("saved");
        setNote("Saved.");
      });
    }
  }

  function undoFix() {
    if (!file) return;
    const entry = [...history].reverse().find((item) => item.fileId === file.id);
    if (!entry) return;
    updateCode(entry.content);
    setHistory((items) => items.filter((item) => item !== entry));
    setResult(null);
    setAnalysis(null);
    setNote("Last AI fix undone.");
  }

  async function askNova(customQuery?: string, isVoicePrompt = false) {
    const request = (customQuery || prompt).trim();
    if (!request) return;
    setPrompt("");
    setThinking(true);
    voice.setProcessing(true);

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: request,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const activeLanguage = file?.language || projectLanguage || "python";
      const activeCode = file?.content || "";
      const activeFileName = file?.name || (activeLanguage === "cpp" ? "main.cpp" : "main.py");
      const activeDiagnostics = result?.diagnostics ?? [];

      const allFiles = localFs.isLocalMode
        ? localFs.localFiles.map((f) => ({ name: f.name, content: f.content }))
        : project
          ? project.files.map((f) => ({ name: f.name, content: f.content }))
          : [{ name: activeFileName, content: activeCode }];

      if (/\b(fix|repair|correct)\b/i.test(request) && activeDiagnostics.length) {
        const next = await call<AnalysisResult>("/analyze", {
          method: "POST",
          body: JSON.stringify({
            language: activeLanguage,
            code: activeCode,
            diagnostics: activeDiagnostics,
          }),
        });
        if (next.patch) {
          setAnalysis(next);
          const assistantMsg: ChatMessage = {
            id: `${Date.now()}-a`,
            role: "assistant",
            content: next.summary,
            speechText: next.speechText,
            patch: next.patch,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setNote("Nova prepared a patch. Review or click Apply to update your code.");
          if ((isVoicePrompt || voice.isVoiceMode) && next.summary) {
            voice.speak(next.speechText || next.summary);
          }
          return;
        }
      }

      const reply = await call<{
        message: string;
        speechText?: string;
        replacement?: string;
        reason?: string;
      }>(
        "/nova/chat",
        {
          method: "POST",
          body: JSON.stringify({
            message: request,
            language: activeLanguage,
            code: activeCode,
            files: allFiles,
            entryFile: activeFileName,
            persona,
            diagnostics: activeDiagnostics,
          }),
        },
        token,
      );

      const normalizedReplacement = reply.replacement
        ? normalizeCodeNewlines(reply.replacement)
        : undefined;

      const patchProposal: PatchProposal | undefined = normalizedReplacement
        ? {
            file: activeFileName,
            original: activeCode,
            replacement: normalizedReplacement,
            reason: reply.reason ?? "Generated by Nova.",
            confidence: 0.95,
          }
        : undefined;

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: reply.message,
        speechText: reply.speechText,
        patch: patchProposal,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setAnalysis({
        classification: "quality",
        summary: reply.message,
        speechText: reply.speechText,
        nextStep: normalizedReplacement
          ? "Review the generated code before applying it to your editor."
          : "Ask Nova to generate or revise code when ready.",
        patch: patchProposal,
      });
      setNote(reply.message);
      if (isVoicePrompt || voice.isVoiceMode) {
        voice.speak(reply.speechText || reply.message);
      }
    } catch (error) {
      console.error("[Nova ask error]", error);
      const errMsg = error instanceof Error ? error.message : "Could not reach Nova.";
      setNote(`Nova: ${errMsg}`);
      const errorMsg: ChatMessage = {
        id: `${Date.now()}-err`,
        role: "assistant",
        content: `⚠️ Could not reach Nova: ${errMsg}\nPlease ensure the backend API server is running.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setThinking(false);
      voice.setProcessing(false);
    }
  }

  // Keyboard shortcuts: Ctrl+S (save), Ctrl+Enter (run), Ctrl+Shift+F (analyze)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void run();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (result?.diagnostics && result.diagnostics.length > 0) {
          void analyze();
        } else {
          void askNova(
            "Please review, debug, and auto-fix any syntax errors, runtime exceptions, or logic bugs in this code. Provide the complete corrected source code with clear inline comments.",
          );
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        undoFix();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [file, history, project, saveStatus, localFs.isLocalMode]);

  return {
    // State
    projects,
    project,
    file,
    note,
    result,
    analysis,
    messages,
    thinking,
    prompt,
    stdin,
    createOpen,
    projectName,
    projectLanguage,
    activeTab,
    terminal,
    autoSaveEnabled,
    saveStatus,
    isLocalMode: localFs.isLocalMode,
    localFolderName: localFs.folderName,
    localFiles: localFs.localFiles,
    voice,
    persona,
    versions,
    historyOpen,
    diffOpen,
    diffData,

    // Student State
    testCases,
    isRunningTests,
    isGeneratingTests,
    isAutoFixingTests,
    complexity,
    complexityOpen,
    isAnalyzingComplexity,
    templatesOpen,
    testCasePatches,

    // Actions
    openProject,
    openCreate,
    createProject,
    deleteProject,
    renameProject,
    addFile,
    deleteFile,
    renameFile,
    selectFile,
    updateCode,
    save,
    run,
    analyze,
    applyPatch,
    applyPatchAndRunTests,
    undoFix,
    askNova,
    clearChat,
    setPersona,
    openHistory,
    closeHistory,
    restoreVersion,
    openDiff,
    closeDiff,
    toggleAutoSave,
    downloadFile,
    openLocalFolder,
    closeLocalFolder,

    // Student Actions
    addTestCase,
    deleteTestCase,
    updateTestCase,
    runTestCases,
    generateTestCases,
    debugTestCaseFailure,
    autoFixTestCase,
    openComplexity,
    closeComplexity,
    openTemplates,
    closeTemplates,
    insertTemplate,

    // Setters
    setPrompt,
    setStdin,
    setCreateOpen,
    setProjectName,
    setProjectLanguage,
    setActiveTab,
  };
}
