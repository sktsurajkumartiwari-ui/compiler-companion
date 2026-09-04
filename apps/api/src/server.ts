import "./config.js";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { languageIds, type TestCase } from "@compiler-companion/shared";
import { execute, startInteractiveExecution } from "./execution.js";
import { DiagnosticProvider } from "./analysis.js";
import {
  hashPassword,
  issueToken,
  requireUser,
  type AuthRequest,
  verifyPassword,
  generateResetCode,
  verifyResetCode,
  clearResetCode,
} from "./auth.js";
import { sendVerificationEmail } from "./email.js";
import { randomBytes } from "node:crypto";
import { LocalStore } from "./store.js";
import {
  askOpenAI,
  analyzeComplexity,
  generateTestCases,
  explainTestCaseFailure,
  fixFailedTestCaseAI,
  checkAiHealth,
  queryAI,
} from "./openai.js";

const app = express();
const provider = new DiagnosticProvider();
const store = new LocalStore();
const allowedOrigin = process.env.CLIENT_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      // Allow localhost and 127.0.0.1 on any port in local development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigin) {
        const origins = allowedOrigin.split(",").map((s) => s.trim());
        if (origins.includes("*") || origins.includes(origin)) {
          return callback(null, true);
        }
      }
      if (!allowedOrigin) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "150kb" }));

const executeInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1),
  files: z
    .array(
      z.object({
        name: z.string(),
        content: z.string().max(100_000),
      }),
    )
    .optional(),
  entryFile: z.string().optional(),
  stdin: z.string().max(10_000).optional(),
});

const testCasesExecuteInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1),
  files: z
    .array(
      z.object({
        name: z.string(),
        content: z.string().max(100_000),
      }),
    )
    .optional(),
  entryFile: z.string().optional(),
  testCases: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.enum(["Sample", "Boundary", "Edge Case", "Scale", "Stress"]).optional(),
      input: z.string().max(20_000),
      expectedOutput: z.string().max(50_000).optional(),
      explanation: z.string().optional(),
    }),
  ),
});

const complexityInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1).max(100_000),
});

const generateTestCasesInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1).max(100_000),
});

const explainFailureInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1).max(100_000),
  testCase: z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(["Sample", "Boundary", "Edge Case", "Scale", "Stress"]).optional(),
    input: z.string().max(20_000),
    expectedOutput: z.string().max(50_000).optional(),
    actualOutput: z.string().max(50_000).optional(),
    error: z.string().max(50_000).optional(),
    explanation: z.string().optional(),
    status: z.enum(["idle", "running", "passed", "failed", "error", "timeout"]),
  }),
});

const fixTestCaseInput = z.object({
  language: z.enum(languageIds),
  code: z.string().min(1).max(100_000),
  failedTestCase: z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(["Sample", "Boundary", "Edge Case", "Scale", "Stress"]).optional(),
    input: z.string().max(20_000),
    expectedOutput: z.string().max(50_000).optional(),
    actualOutput: z.string().max(50_000).optional(),
    error: z.string().max(50_000).optional(),
    explanation: z.string().optional(),
    status: z.enum(["idle", "running", "passed", "failed", "error", "timeout"]),
  }),
  allTestCases: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.enum(["Sample", "Boundary", "Edge Case", "Scale", "Stress"]).optional(),
        input: z.string().max(20_000),
        expectedOutput: z.string().max(50_000).optional(),
        actualOutput: z.string().max(50_000).optional(),
        error: z.string().max(50_000).optional(),
        explanation: z.string().optional(),
        status: z.enum(["idle", "running", "passed", "failed", "error", "timeout"]).optional(),
      }),
    )
    .optional(),
  files: z
    .array(
      z.object({
        name: z.string(),
        content: z.string().max(100_000),
      }),
    )
    .optional(),
  entryFile: z.string().optional(),
});
const analysisInput = z.object({
  language: z.enum(languageIds),
  code: z.string().max(100_000),
  diagnostics: z.array(
    z.object({
      severity: z.enum(["error", "warning", "info"]),
      message: z.string(),
      line: z.number().optional(),
      column: z.number().optional(),
    }),
  ),
});
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((email) => email.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});
const forgotPasswordInput = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
});
const verifyResetCodeInput = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  code: z.string().trim().min(6).max(6),
  newPassword: z.string().min(8).max(128),
});
const googleAuthInput = z.object({
  credential: z.string().optional(),
  devProfile: z
    .object({
      email: z.string().email(),
      name: z.string().optional(),
    })
    .optional(),
});
const projectInput = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.enum(languageIds),
});
const renameProjectInput = z.object({
  name: z.string().trim().min(1).max(80),
});
const fileInput = z.object({
  name: z.string().regex(/^[\w.-]{1,100}$/),
  language: z.enum(languageIds),
});
const renameFileInput = z.object({
  name: z.string().regex(/^[\w.-]{1,100}$/),
});
const saveFileInput = z.object({ content: z.string().max(100_000) });
const novaInput = z.object({
  message: z.string().trim().min(1).max(4_000),
  language: z.enum(languageIds),
  code: z.string().max(100_000),
  files: z
    .array(
      z.object({
        name: z.string(),
        content: z.string().max(100_000),
      }),
    )
    .optional(),
  entryFile: z.string().optional(),
  persona: z.enum(["mentor", "architect", "concise"]).optional(),
  diagnostics: analysisInput.shape.diagnostics,
});

app.get("/", (_req, res) =>
  res.json({
    status: "online",
    message: "Compiler Companion API is running smoothly!",
    health: "/api/health",
  }),
);

app.get("/api/health", async (_req, res) => {
  const checkCmd = async (cmd: string): Promise<string> => {
    try {
      const { exec } = await import("node:child_process");
      return await new Promise<string>((resolve) => {
        exec(cmd, { timeout: 3000 }, (error, stdout, stderr) => {
          if (error) resolve(`error: ${error.message.split("\n")[0]}`);
          else resolve((stdout || stderr || "available").trim().split("\n")[0]);
        });
      });
    } catch (e) {
      return `catch: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  const [python3, python, gpp, dockerVer, aiStatus] = await Promise.all([
    checkCmd("python3 --version"),
    checkCmd("python --version"),
    checkCmd("g++ --version"),
    checkCmd("docker --version"),
    checkAiHealth(),
  ]);

  res.json({
    ok: true,
    version: "2026.09.05-v2",
    executionEnabled: true,
    ai: aiStatus,
    env: {
      python3,
      python,
      gpp,
      docker: dockerVer,
      platform: process.platform,
    },
  });
});

app.get("/api/health/ai-test", async (_req, res) => {
  try {
    const aiStatus = await checkAiHealth();
    if (!aiStatus.keyConfigured) {
      return res.status(400).json({
        ok: false,
        error: "No AI API key found in environment variables (GEMINI_API_KEY, AI_API_KEY, GROQ_API_KEY).",
        aiStatus,
      });
    }

    const testReply = await queryAI(
      "You are an assistant. Reply with only: OK",
      "ping",
      0.1,
      false,
    );

    res.json({
      ok: true,
      provider: aiStatus.provider,
      model: aiStatus.model,
      reply: testReply.slice(0, 100).trim(),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    const user = await store.createUser(input.email, await hashPassword(input.password));
    res.status(201).json({ token: issueToken(user.id), user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    const user = await store.userByEmail(input.email);
    if (!user) {
      return res.status(401).json({
        error: "No account found with this email. Please check your email or click 'Create Account'.",
      });
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      return res.status(401).json({
        error: "Incorrect password. Please verify your password or use 'Reset Password'.",
      });
    }
    res.json({ token: issueToken(user.id), user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = forgotPasswordInput.parse(req.body);
    const user = await store.userByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: "No account found with this email address. Please check your spelling or create an account.",
      });
    }
    const code = generateResetCode(email);
    const emailResult = await sendVerificationEmail(email, code);
    res.json({
      ok: true,
      message: `A 6-digit verification code has been sent to ${email}. Valid for 10 minutes.`,
      devPreview: emailResult.devPreview,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/verify-reset-code", async (req, res, next) => {
  try {
    const { email, code, newPassword } = verifyResetCodeInput.parse(req.body);
    const verification = verifyResetCode(email, code);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error || "Invalid verification code." });
    }
    const user = await store.userByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }
    const updated = await store.updateUserPassword(email, await hashPassword(newPassword));
    clearResetCode(email);
    res.json({
      token: issueToken(updated.id),
      user: { id: updated.id, email: updated.email },
      message: "Password reset successful! You are now logged in.",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/google", async (req, res, next) => {
  try {
    const input = googleAuthInput.parse(req.body);
    let email: string | undefined;
    let name: string | undefined;

    if (input.credential) {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.credential)}`,
      );
      if (!verifyRes.ok) {
        return res.status(401).json({ error: "Invalid Google credential token." });
      }
      const info = (await verifyRes.json()) as {
        email?: string;
        email_verified?: string | boolean;
        name?: string;
      };
      if (!info.email || (info.email_verified !== "true" && info.email_verified !== true)) {
        return res.status(401).json({ error: "Google account email is not verified." });
      }
      email = info.email.toLowerCase().trim();
      name = info.name;
    } else if (input.devProfile) {
      email = input.devProfile.email.toLowerCase().trim();
      name = input.devProfile.name;
    } else {
      return res.status(400).json({ error: "Missing Google credentials." });
    }

    let user = await store.userByEmail(email);
    if (!user) {
      const randomPassword = randomBytes(32).toString("hex") + "OAuth2026!";
      user = await store.createUser(email, await hashPassword(randomPassword));
      console.info(`[Google Auth] Created new account for ${email} (${name || "User"})`);
    } else {
      console.info(`[Google Auth] Existing user logged in: ${email}`);
    }

    res.json({
      token: issueToken(user.id),
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/demo", async (_req, res, next) => {
  try {
    const demoEmail = "demo@compiler.local";
    const demoPassword = "DemoPassword2026!";
    let user = await store.userByEmail(demoEmail);
    if (!user) {
      user = await store.createUser(demoEmail, await hashPassword(demoPassword));
    }
    res.json({ token: issueToken(user.id), user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});
app.get("/api/projects", requireUser, async (req: AuthRequest, res, next) => {
  try {
    res.json(await store.listProjects(req.userId!));
  } catch (error) {
    next(error);
  }
});
app.post("/api/projects", requireUser, async (req: AuthRequest, res, next) => {
  try {
    const input = projectInput.parse(req.body);
    res.status(201).json(await store.createProject(req.userId!, input.name, input.language));
  } catch (error) {
    next(error);
  }
});
app.get("/api/projects/:projectId", requireUser, async (req: AuthRequest, res, next) => {
  try {
    const project = await store.getProject(req.userId!, req.params.projectId as string);
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json(project);
  } catch (error) {
    next(error);
  }
});
app.post("/api/projects/:projectId/files", requireUser, async (req: AuthRequest, res, next) => {
  try {
    const input = fileInput.parse(req.body);
    const file = await store.createFile(
      req.userId!,
      req.params.projectId as string,
      input.name,
      input.language,
    );
    if (!file) return res.status(404).json({ error: "Project not found." });
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});
app.put(
  "/api/projects/:projectId/files/:fileId",
  requireUser,
  async (req: AuthRequest, res, next) => {
    try {
      const file = await store.saveFile(
        req.userId!,
        req.params.projectId as string,
        req.params.fileId as string,
        saveFileInput.parse(req.body).content,
      );
      if (!file) return res.status(404).json({ error: "File not found." });
      res.json(file);
    } catch (error) {
      next(error);
    }
  },
);
app.delete("/api/projects/:projectId", requireUser, async (req: AuthRequest, res, next) => {
  try {
    const deleted = await store.deleteProject(req.userId!, req.params.projectId as string);
    if (!deleted) return res.status(404).json({ error: "Project not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/projects/:projectId", requireUser, async (req: AuthRequest, res, next) => {
  try {
    const input = renameProjectInput.parse(req.body);
    const updated = await store.renameProject(
      req.userId!,
      req.params.projectId as string,
      input.name,
    );
    if (!updated) return res.status(404).json({ error: "Project not found." });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});
app.delete(
  "/api/projects/:projectId/files/:fileId",
  requireUser,
  async (req: AuthRequest, res, next) => {
    try {
      const deleted = await store.deleteFile(
        req.userId!,
        req.params.projectId as string,
        req.params.fileId as string,
      );
      if (!deleted) return res.status(404).json({ error: "File not found." });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
app.patch(
  "/api/projects/:projectId/files/:fileId",
  requireUser,
  async (req: AuthRequest, res, next) => {
    try {
      const input = renameFileInput.parse(req.body);
      const updated = await store.renameFile(
        req.userId!,
        req.params.projectId as string,
        req.params.fileId as string,
        input.name,
      );
      if (!updated) return res.status(404).json({ error: "File not found." });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);
app.post("/api/execute", async (req, res, next) => {
  try {
    const result = await execute(executeInput.parse(req.body));
    res.json(result);
  } catch (error) {
    console.error("[Execute Error]", error instanceof Error ? error.message : error);
    next(error);
  }
});

app.post("/api/execute/testcases", async (req, res, next) => {
  try {
    const input = testCasesExecuteInput.parse(req.body);
    const results: TestCase[] = [];

    for (const tc of input.testCases) {
      try {
        const execRes = await execute({
          language: input.language,
          code: input.code,
          files: input.files,
          entryFile: input.entryFile,
          stdin: tc.input.endsWith("\n") ? tc.input : `${tc.input}\n`,
        });

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

        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: execRes.stdout,
          status,
          durationMs: execRes.durationMs,
          error: status === "passed" ? undefined : error || execRes.stderr || undefined,
          explanation: tc.explanation,
        });
      } catch (tcErr) {
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: "",
          status: "error",
          durationMs: null,
          error: tcErr instanceof Error ? tcErr.message : "Test execution failed",
          explanation: tc.explanation,
        });
      }
    }

    res.json({ testCases: results });
  } catch (error) {
    next(error);
  }
});

app.post("/api/complexity", async (req, res, next) => {
  try {
    const input = complexityInput.parse(req.body);
    const result = await analyzeComplexity(input.language, input.code);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/testcases/generate", async (req, res, next) => {
  try {
    const input = generateTestCasesInput.parse(req.body);
    const testCases = await generateTestCases(input.language, input.code);
    res.json({ testCases });
  } catch (error) {
    next(error);
  }
});

app.post("/api/testcases/explain-failure", async (req, res, next) => {
  try {
    const input = explainFailureInput.parse(req.body);
    const explanation = await explainTestCaseFailure(
      input.language,
      input.code,
      input.testCase as TestCase,
    );
    res.json({ explanation });
  } catch (error) {
    next(error);
  }
});

app.post("/api/testcases/fix", async (req, res, next) => {
  try {
    const input = fixTestCaseInput.parse(req.body);
    const reply = await fixFailedTestCaseAI(
      input.language,
      input.code,
      input.failedTestCase as TestCase,
      input.allTestCases as TestCase[],
      input.files,
      input.entryFile,
    );
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
app.post("/api/analyze", async (req, res, next) => {
  try {
    const input = analysisInput.parse(req.body);

    // Try smart AI code analysis and 1-attempt repair first
    try {
      const activeFileName = input.language === "cpp" ? "main.cpp" : "main.py";
      const reply = await askOpenAI({
        message:
          input.diagnostics.length > 0
            ? `Please fix all errors and bugs in this code in 1 attempt:\n${input.diagnostics.map((d) => `- [Line ${d.line || "?"}] ${d.message}`).join("\n")}`
            : "Please analyze this code, fix any bugs, optimize performance, and ensure it is 100% bug-free and runnable.",
        language: input.language,
        code: input.code,
        diagnostics: input.diagnostics,
      });

      if (reply.replacement) {
        return res.json({
          classification: input.diagnostics.length > 0 ? "syntax" : "quality",
          summary: reply.message,
          speechText: reply.speechText,
          nextStep:
            "Review the proposed 1-shot correction and click 'Apply Proposed Patch' to update your code.",
          patch: {
            file: activeFileName,
            original: input.code,
            replacement: reply.replacement,
            reason: reply.reason || "1-attempt complete code correction by Nova.",
            confidence: 0.99,
          },
        });
      }
    } catch (aiErr) {
      console.warn("[Analyze AI fallback]", aiErr instanceof Error ? aiErr.message : aiErr);
    }

    // Fallback to deterministic DiagnosticProvider if LLM is unavailable
    res.json(await provider.analyze(input));
  } catch (error) {
    next(error);
  }
});
app.post("/api/nova/chat", async (req, res, next) => {
  try {
    const input = novaInput.parse(req.body);
    console.info("[Nova] Request:", input.message.slice(0, 100));
    const reply = await askOpenAI(input);
    console.info(
      "[Nova] Reply:",
      reply.message?.slice(0, 100),
      "hasReplacement:",
      !!reply.replacement,
    );
    res.json(reply);
  } catch (error) {
    console.error("[Nova Error]", error instanceof Error ? error.message : error);
    res.json({
      message: `### ⚠️ AI Assistant Notice\n\n${error instanceof Error ? error.message : "Unable to contact AI service."}`,
      reason: "AI Notice",
    });
  }
});
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, gender, language } = req.body as {
      text?: string;
      voice?: string;
      gender?: "male" | "female";
      language?: "auto" | "hindi" | "english";
    };

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required." });
    }

    const cleanText = text.trim().slice(0, 3000);
    if (!cleanText) {
      return res.status(400).json({ error: "Text cannot be empty." });
    }

    let targetVoice = voice;
    if (!targetVoice) {
      const isMale = gender !== "female";
      const hasDevanagari = /[\u0900-\u097F]/.test(cleanText);
      const isHindi = language === "hindi" || hasDevanagari || language === "auto";

      if (isHindi) {
        // Authentic Indian Teacher Voice Actors (Madhur / Swara)
        targetVoice = isMale ? "hi-IN-MadhurNeural" : "hi-IN-SwaraNeural";
      } else if (language === "english") {
        targetVoice = isMale ? "en-IN-PrabhatNeural" : "en-IN-NeerjaNeural";
      } else {
        targetVoice = isMale ? "hi-IN-MadhurNeural" : "hi-IN-SwaraNeural";
      }
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(targetVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(cleanText);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");

    audioStream.pipe(res);

    audioStream.on("end", () => {
      tts.close();
    });

    audioStream.on("error", (err) => {
      console.error("[TTS Stream Error]", err);
      tts.close();
      if (!res.headersSent) {
        res.status(500).json({ error: "TTS generation failed." });
      }
    });
  } catch (error) {
    console.error("[TTS Error]", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "TTS failed." });
    }
  }
});
app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API Error]", error instanceof Error ? error.message : error);
    if (error instanceof z.ZodError) {
      console.error("[API Error] Validation:", error.errors);
      const firstIssue = error.issues[0];
      const message = firstIssue?.message
        ? `${firstIssue.path.join(".") ? `${firstIssue.path.join(".")}: ` : ""}${firstIssue.message}`
        : "Invalid request";
      return res.status(400).json({ error: message, details: error.flatten() });
    }
    if (error instanceof Error && /already exists/.test(error.message))
      return res.status(409).json({ error: error.message });
    if (error instanceof Error && /timeout/i.test(error.message)) {
      console.error("[API Error] Timeout:", error.message);
      return res.status(504).json({ error: "Request timed out. Please try again." });
    }
    if (error instanceof Error && /ECONNREFUSED|fetch failed/i.test(error.message)) {
      console.error("[API Error] Connection:", error.message);
      return res.status(503).json({ error: "AI service is unavailable. Please try again later." });
    }
    console.error("[API Error] Unknown:", error);
    res.status(500).json({ error: "Internal server error" });
  },
);
const httpServer = createServer(app);

const wss = new WebSocketServer({
  server: httpServer,
  path: "/api/terminal",
});

wss.on("connection", (socket) => {
  console.info("[Terminal] Client connected");

  let session: ReturnType<typeof startInteractiveExecution> | null = null;

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "start") {
        if (session) {
          console.info("[Terminal] Terminating previous session to restart fresh");
          try {
            session.kill();
          } catch {
            /* ignore */
          }
          session = null;
        }

        if (typeof message.language !== "string" || typeof message.code !== "string") {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Invalid start request.",
            }),
          );
          return;
        }

        socket.send(
          JSON.stringify({
            type: "status",
            status: "starting",
          }),
        );

        session = startInteractiveExecution(
          {
            language: message.language,
            code: message.code,
            files: Array.isArray(message.files) ? message.files : undefined,
            entryFile: typeof message.entryFile === "string" ? message.entryFile : undefined,
          },
          (type, data) => {
            if (socket.readyState !== WebSocket.OPEN) return;

            socket.send(
              JSON.stringify({
                type,
                data,
              }),
            );
          },
          (code) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: "exit",
                  code,
                }),
              );
            }

            session = null;
          },
        );

        void session.startPromise;

        return;
      }

      if (message.type === "input") {
        if (typeof message.data !== "string") return;

        session?.sendInput(message.data);
        return;
      }

      if (message.type === "kill") {
        session?.kill();
        session = null;

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "killed",
            }),
          );
        }

        return;
      }
    } catch (error) {
      console.error("[Terminal] Message error:", error);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Invalid terminal message.",
          }),
        );
      }
    }
  });

  socket.on("close", () => {
    console.info("[Terminal] Client disconnected");
    session?.kill();
    session = null;
  });

  socket.on("error", (error) => {
    console.error("[Terminal] WebSocket error:", error);
    session?.kill();
    session = null;
  });
});

httpServer.listen(Number(process.env.PORT ?? 8787), () => {
  console.info(`API listening on :${process.env.PORT ?? 8787}`);
  console.info(
    "Interactive terminal: ws://localhost:" + (process.env.PORT ?? 8787) + "/api/terminal",
  );
});
