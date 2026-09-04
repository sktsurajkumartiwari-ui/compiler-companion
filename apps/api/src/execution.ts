import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { spawn } from "node:child_process";
import type { ExecutionRequest, ExecutionResult } from "@compiler-companion/shared";
import { adapters } from "./adapters.js";

/** Convert Windows path to Docker-compatible path */
function toDockerPath(p: string): string {
  // If not Windows path, return as-is
  if (!win32.isAbsolute(p)) return p;
  // Convert C:\Users\... to /c/Users/...
  const normalized = p.replace(/\\/g, "/");
  const match = normalized.match(/^([a-zA-Z]):\/(.*)/);
  if (match) {
    return `/${match[1].toLowerCase()}/${match[2]}`;
  }
  return normalized;
}

const maxCodeBytes = 100_000;

function docker(args: string[], input: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }>(
    (resolve, reject) => {
      const child = spawn("docker", args, { windowsHide: true });
      let stdout = "",
        stderr = "",
        timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      child.stdout.on("data", (data) => {
        stdout += data;
      });
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code, timedOut });
      });
      child.stdin.end(input);
    },
  );
}

export async function execute(request: ExecutionRequest): Promise<ExecutionResult> {
  if (Buffer.byteLength(request.code, "utf8") > maxCodeBytes)
    throw new Error("Code exceeds the 100 KB execution limit.");
  if (process.env.EXECUTION_ENABLED !== "true")
    return unavailable(
      "Secure execution is disabled. Enable Docker-backed execution in the server environment.",
    );
  const adapter = adapters[request.language];
  const rawWorkDir = await mkdtemp(join(tmpdir(), "compiler-companion-"));
  const workDir = toDockerPath(rawWorkDir);
  const startedAt = performance.now();
  try {
    const entryFileName =
      (request.entryFile ? request.entryFile.replace(/^.*[\\/]/, "") : adapter.sourceFile) ||
      adapter.sourceFile;

    // Write all project files, updating the entry file with the latest request.code
    const written = new Set<string>();
    if (request.files && request.files.length > 0) {
      for (const file of request.files) {
        const safeName = file.name.replace(/^.*[\\/]/, "");
        if (!safeName) continue;
        const content = safeName === entryFileName ? request.code : file.content;
        await writeFile(join(rawWorkDir, safeName), content, "utf8");
        written.add(safeName);
      }
    }

    // Ensure the entry file is written if not already in files
    if (!written.has(entryFileName)) {
      await writeFile(join(rawWorkDir, entryFileName), request.code, "utf8");
    }

    const command = adapter.getCommand(entryFileName);

    const args = [
      "run",
      "-i",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "64",
      "--memory",
      `${adapter.memoryMb}m`,
      "--cpus",
      "0.5",
      "--user",
      "65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=32m,uid=65534,gid=65534,mode=700",
      "--tmpfs",
      "/run:rw,exec,nosuid,size=32m,uid=65534,gid=65534,mode=700",
      "--mount",
      `type=bind,src=${workDir},dst=/workspace,readonly`,
      adapter.image,
      ...command,
    ];
    const run = await docker(args, request.stdin ?? "", adapter.timeoutMs);
    const durationMs = Math.round(performance.now() - startedAt);
    if (run.timedOut)
      return {
        status: "timeout",
        stdout: run.stdout,
        stderr: "Execution exceeded the configured time limit.",
        diagnostics: [],
        exitCode: null,
        durationMs,
      };
    const diagnostics = adapter.parseDiagnostics(run.stderr);
    const status =
      run.code === 0
        ? "completed"
        : request.language === "cpp" && /error:/i.test(run.stderr)
          ? "compile_error"
          : "runtime_error";
    return {
      status,
      stdout: run.stdout,
      stderr: run.stderr,
      diagnostics,
      exitCode: run.code,
      durationMs,
    };
  } catch (error) {
    return unavailable(
      error instanceof Error ? `Sandbox failed: ${error.message}` : "Sandbox failed.",
    );
  } finally {
    await rm(rawWorkDir, { recursive: true, force: true }).catch(() => {});
  }
}

function unavailable(message: string): ExecutionResult {
  return {
    status: "unavailable",
    stdout: "",
    stderr: message,
    diagnostics: [{ severity: "info", message }],
    exitCode: null,
    durationMs: null,
  };
}
export function startInteractiveExecution(
  request: ExecutionRequest,
  onOutput: (type: "stdout" | "stderr", data: string) => void,
  onExit: (code: number | null) => void,
) {
  if (Buffer.byteLength(request.code, "utf8") > maxCodeBytes) {
    throw new Error("Code exceeds the 100 KB execution limit.");
  }

  if (process.env.EXECUTION_ENABLED !== "true") {
    throw new Error(
      "Secure execution is disabled. Enable Docker-backed execution in the server environment.",
    );
  }

  const adapter = adapters[request.language];

  if (!adapter) {
    throw new Error(`Unsupported language: ${request.language}`);
  }

  let rawWorkDir: string | null = null;
  let activeContainerName: string | null = null;
  let child: ReturnType<typeof spawn> | null = null;
  let finished = false;

  const start = async () => {
    rawWorkDir = await mkdtemp(join(tmpdir(), "compiler-companion-terminal-"));
    const workDir = toDockerPath(rawWorkDir);

    const entryFileName =
      (request.entryFile ? request.entryFile.replace(/^.*[\\/]/, "") : adapter.sourceFile) ||
      adapter.sourceFile;

    // Write all project files, updating the entry file with the latest request.code
    const written = new Set<string>();
    if (request.files && request.files.length > 0) {
      for (const file of request.files) {
        const safeName = file.name.replace(/^.*[\\/]/, "");
        if (!safeName) continue;
        const content = safeName === entryFileName ? request.code : file.content;
        await writeFile(join(rawWorkDir, safeName), content, "utf8");
        written.add(safeName);
      }
    }

    // Ensure the entry file is written if not already in files
    if (!written.has(entryFileName)) {
      await writeFile(join(rawWorkDir, entryFileName), request.code, "utf8");
    }

    const containerName = `cc-interactive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    activeContainerName = containerName;
    const command = adapter.getCommand(entryFileName);

    const args = [
      "run",
      "--name",
      containerName,
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "64",
      "--memory",
      `${adapter.memoryMb}m`,
      "--cpus",
      "0.5",
      "--user",
      "65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=32m,uid=65534,gid=65534,mode=700",
      "--tmpfs",
      "/run:rw,exec,nosuid,size=32m,uid=65534,gid=65534,mode=700",
      "--mount",
      `type=bind,src=${workDir},dst=/workspace,readonly`,
      "-i",
      adapter.image,
      ...command,
    ];

    child = spawn("docker", args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      onOutput("stdout", data.toString());
    });

    child.stderr?.on("data", (data) => {
      onOutput("stderr", data.toString());
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      onOutput("stderr", `Process error: ${error.message}\n`);
      onExit(null);
      void cleanup();
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      onExit(code);
      void cleanup();
    });
  };

  const cleanup = async () => {
    if (activeContainerName) {
      try {
        spawn("docker", ["rm", "-f", activeContainerName], { windowsHide: true });
      } catch {
        // Ignore
      }
      activeContainerName = null;
    }
    if (rawWorkDir) {
      await rm(rawWorkDir, {
        recursive: true,
        force: true,
      }).catch(() => {});
      rawWorkDir = null;
    }
  };

  const sendInput = (input: string) => {
    if (!child || child.killed || !child.stdin || child.stdin.destroyed) {
      return false;
    }

    child.stdin.write(input);
    return true;
  };

  const kill = () => {
    if (!child || finished) return;

    finished = true;

    try {
      child.kill("SIGKILL");
    } catch {
      // Child process may already have terminated
    }

    void cleanup();
  };

  const startPromise = start().catch((error) => {
    if (finished) return;

    finished = true;

    onOutput(
      "stderr",
      error instanceof Error ? `${error.message}\n` : "Failed to start terminal process.\n",
    );

    onExit(null);
    void cleanup();
  });

  return {
    startPromise,
    sendInput,
    kill,
  };
}
