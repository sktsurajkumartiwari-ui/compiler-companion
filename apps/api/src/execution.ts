import { mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { spawn, exec } from "node:child_process";
import type { ExecutionRequest, ExecutionResult, LanguageId } from "@compiler-companion/shared";
import { adapters } from "./adapters.js";

/** Convert Windows path to Docker-compatible path */
function toDockerPath(p: string): string {
  if (!win32.isAbsolute(p)) return p;
  const normalized = p.replace(/\\/g, "/");
  const match = normalized.match(/^([a-zA-Z]):\/(.*)/);
  if (match) {
    return `/${match[1].toLowerCase()}/${match[2]}`;
  }
  return normalized;
}

const maxCodeBytes = 100_000;

// Binary cache
const binCache = new Map<string, boolean>();

async function checkBin(bin: string): Promise<boolean> {
  if (binCache.has(bin)) return binCache.get(bin)!;
  return new Promise<boolean>((resolve) => {
    exec(`${bin} --version`, { timeout: 3000 }, (err) => {
      const ok = !err;
      binCache.set(bin, ok);
      resolve(ok);
    });
  });
}

async function isDockerAvailable(): Promise<boolean> {
  if (process.env.EXECUTION_ENABLED !== "true") return false;
  return new Promise<boolean>((resolve) => {
    exec("docker info", { timeout: 3000 }, (err) => resolve(!err));
  });
}

async function getPythonBinary(): Promise<string> {
  for (const bin of ["python3", "python"]) {
    if (await checkBin(bin)) return bin;
  }
  throw new Error("Python runtime (python3 or python) is not installed on the server.");
}

async function getCppCompiler(): Promise<string> {
  if (await checkBin("g++")) return "g++";
  throw new Error("C++ compiler (g++) is not installed on the server.");
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

function runDockerProcess(args: string[], input: string, timeoutMs: number) {
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

function runNativeProcess(
  cmd: string,
  args: string[],
  cwd: string,
  input: string,
  timeoutMs: number,
) {
  return new Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }>(
    (resolve, reject) => {
      const child = spawn(cmd, args, { cwd, windowsHide: true });
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

/** Execute code in batch mode (for Run / Test Cases / Benchmarking) */
export async function execute(request: ExecutionRequest): Promise<ExecutionResult> {
  if (Buffer.byteLength(request.code, "utf8") > maxCodeBytes) {
    throw new Error("Code exceeds the 100 KB execution limit.");
  }

  const adapter = adapters[request.language];
  if (!adapter) {
    return unavailable(`Unsupported language: ${request.language}`);
  }

  const rawWorkDir = await mkdtemp(join(tmpdir(), "compiler-companion-"));
  const startedAt = performance.now();

  try {
    const entryFileName =
      (request.entryFile ? request.entryFile.replace(/^.*[\\/]/, "") : adapter.sourceFile) ||
      adapter.sourceFile;

    // Write all project files
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

    if (!written.has(entryFileName)) {
      await writeFile(join(rawWorkDir, entryFileName), request.code, "utf8");
    }

    const useDocker = await isDockerAvailable();

    if (useDocker) {
      const workDir = toDockerPath(rawWorkDir);
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

      const run = await runDockerProcess(args, request.stdin ?? "", adapter.timeoutMs);
      const durationMs = Math.round(performance.now() - startedAt);
      if (run.timedOut) {
        return {
          status: "timeout",
          stdout: run.stdout,
          stderr: "Execution exceeded the configured time limit.",
          diagnostics: [],
          exitCode: null,
          durationMs,
        };
      }

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
    }

    // Native execution fallback
    if (request.language === "python") {
      const pythonBin = await getPythonBinary();
      const run = await runNativeProcess(
        pythonBin,
        ["-u", entryFileName],
        rawWorkDir,
        request.stdin ?? "",
        adapter.timeoutMs,
      );
      const durationMs = Math.round(performance.now() - startedAt);

      if (run.timedOut) {
        return {
          status: "timeout",
          stdout: run.stdout,
          stderr: "Execution exceeded time limit.",
          diagnostics: [],
          exitCode: null,
          durationMs,
        };
      }

      return {
        status: run.code === 0 ? "completed" : "runtime_error",
        stdout: run.stdout,
        stderr: run.stderr,
        diagnostics: adapter.parseDiagnostics(run.stderr),
        exitCode: run.code,
        durationMs,
      };
    }

    if (request.language === "cpp") {
      const gppBin = await getCppCompiler();
      const outBin = process.platform === "win32" ? "program.exe" : "./program";

      // Find all .cpp files
      const dirEntries = await readdir(rawWorkDir);
      const cppFiles = dirEntries.filter((f) => /\.(cpp|cc|cxx)$/i.test(f));
      if (cppFiles.length === 0) cppFiles.push(entryFileName);

      // Compile
      const compileRun = await runNativeProcess(
        gppBin,
        ["-std=c++20", "-O2", ...cppFiles, "-o", outBin],
        rawWorkDir,
        "",
        15_000,
      );

      if (compileRun.code !== 0) {
        return {
          status: "compile_error",
          stdout: compileRun.stdout,
          stderr: compileRun.stderr,
          diagnostics: adapter.parseDiagnostics(compileRun.stderr),
          exitCode: compileRun.code,
          durationMs: Math.round(performance.now() - startedAt),
        };
      }

      // Execute compiled binary
      const run = await runNativeProcess(
        join(rawWorkDir, outBin),
        [],
        rawWorkDir,
        request.stdin ?? "",
        adapter.timeoutMs,
      );
      const durationMs = Math.round(performance.now() - startedAt);

      return {
        status: run.code === 0 ? "completed" : "runtime_error",
        stdout: run.stdout,
        stderr: run.stderr,
        diagnostics: adapter.parseDiagnostics(run.stderr),
        exitCode: run.code,
        durationMs,
      };
    }

    return unavailable(`Execution not configured for ${request.language}.`);
  } catch (error) {
    return unavailable(
      error instanceof Error ? `Execution failed: ${error.message}` : "Execution failed.",
    );
  } finally {
    await rm(rawWorkDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Start interactive terminal execution over WebSocket */
export function startInteractiveExecution(
  request: ExecutionRequest,
  onOutput: (type: "stdout" | "stderr", data: string) => void,
  onExit: (code: number | null) => void,
) {
  if (Buffer.byteLength(request.code, "utf8") > maxCodeBytes) {
    throw new Error("Code exceeds the 100 KB execution limit.");
  }

  const adapter = adapters[request.language];
  if (!adapter) {
    throw new Error(`Unsupported language: ${request.language}`);
  }

  let rawWorkDir: string | null = null;
  let activeContainerName: string | null = null;
  let child: ReturnType<typeof spawn> | null = null;
  let finished = false;
  let timeoutTimer: NodeJS.Timeout | null = null;

  const cleanup = async () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
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

  const kill = () => {
    if (finished) return;
    finished = true;

    if (child) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Child process may already have terminated
      }
    }

    void cleanup();
  };

  const start = async () => {
    rawWorkDir = await mkdtemp(join(tmpdir(), "compiler-companion-terminal-"));

    const entryFileName =
      (request.entryFile ? request.entryFile.replace(/^.*[\\/]/, "") : adapter.sourceFile) ||
      adapter.sourceFile;

    // Write all project files
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

    if (!written.has(entryFileName)) {
      await writeFile(join(rawWorkDir, entryFileName), request.code, "utf8");
    }

    // Safety timeout: 60 seconds max interactive lifetime
    timeoutTimer = setTimeout(() => {
      if (!finished) {
        onOutput("stderr", "\n[Process exceeded interactive execution time limit (60s)]\n");
        kill();
        onExit(null);
      }
    }, 60_000);

    const useDocker = await isDockerAvailable();

    if (useDocker) {
      const workDir = toDockerPath(rawWorkDir);
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
    } else if (request.language === "python") {
      const pythonBin = await getPythonBinary();
      child = spawn(pythonBin, ["-u", entryFileName], {
        cwd: rawWorkDir,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else if (request.language === "cpp") {
      const gppBin = await getCppCompiler();
      const outBin = process.platform === "win32" ? "program.exe" : "./program";

      const dirEntries = await readdir(rawWorkDir);
      const cppFiles = dirEntries.filter((f) => /\.(cpp|cc|cxx)$/i.test(f));
      if (cppFiles.length === 0) cppFiles.push(entryFileName);

      onOutput("stdout", "[Compiling C++ program...]\n");

      // Compile first
      const compileRun = await runNativeProcess(
        gppBin,
        ["-std=c++20", "-O2", ...cppFiles, "-o", outBin],
        rawWorkDir,
        "",
        15_000,
      );

      if (compileRun.code !== 0) {
        finished = true;
        onOutput("stderr", compileRun.stderr || "Compilation failed.\n");
        onExit(compileRun.code);
        void cleanup();
        return;
      }

      onOutput("stdout", "[Compilation successful. Running...]\n");

      child = spawn(join(rawWorkDir, outBin), [], {
        cwd: rawWorkDir,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      throw new Error(`Execution unsupported for ${request.language}`);
    }

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

  const sendInput = (input: string) => {
    if (!child || child.killed || !child.stdin || child.stdin.destroyed) {
      return false;
    }

    child.stdin.write(input);
    return true;
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
