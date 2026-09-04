import {
  type ComplexityResult,
  type Diagnostic,
  type LanguageId,
  type TestCase,
  normalizeCodeNewlines,
} from "@compiler-companion/shared";

export interface NovaReply {
  message: string;
  speechText?: string;
  replacement?: string;
  reason?: string;
}

type NovaInput = {
  message: string;
  code: string;
  language: LanguageId;
  files?: Array<{ name: string; content: string }>;
  entryFile?: string;
  persona?: "mentor" | "architect" | "concise";
  diagnostics?: Diagnostic[];
  testCases?: TestCase[];
  failedTestCase?: TestCase;
};

const systemPrompt = `You are GOAT, a master AI coding mentor, expert software architect, and warm teacher (just like ChatGPT, Claude, and a senior staff software engineer).
Your primary goal is to write clean, standard, beginner-friendly code that ANYONE can easily understand, complete with clear, explanatory inline comments on every logical step, 100% bug-free.

CHATGPT-STYLE CODE & COMMENTING STANDARDS (MANDATORY FOR ALL CODE):
Whenever you generate, fix, or optimize code in "replacement":
1. READABLE & BEGINNER-FRIENDLY (NO CRYPTIC CODE):
   - Write standard, clean, beginner-friendly code that anyone can read effortlessly.
   - Use meaningful, descriptive variable and function names (e.g. \`total_sum\`, \`word_count\`, \`is_palindrome\`, \`char_frequency\`, \`student_scores\` instead of single-letter or cryptic names like \`a\`, \`b\`, \`t\`, \`res2\`, \`k\`, \`flag\`).
   - Avoid overly dense, cryptic one-liners, obscure tricks, or confusing nested expressions. Write clean, step-by-step logic that any student can follow.
2. THOUGHTFUL, CLEAR INLINE COMMENTS:
   - Provide helpful, friendly comments above or beside every major step, loop, condition, or helper function.
   - Comments should explain *what* the section is doing and *why* (e.g., "# Step 1: Read input and strip trailing whitespace", "# Step 2: Convert to lowercase for case-insensitive comparison", "# Step 3: Check if the reversed string matches the original").
   - When fixing a bug, add an explicit comment explaining the fix (e.g., "# FIX: Converted to lowercase to handle mixed-case inputs like 'Racecar'").
3. STANDARD IDIOMATIC STRUCTURE:
   - In Python: Use clean functions, PEP 8 spacing, clear variable assignments, and the standard \`if __name__ == "__main__":\` block.
   - In C++: Include all required headers (\`<iostream>\`, \`<vector>\`, \`<string>\`, \`<algorithm>\`), use clean indentation, meaningful variable names, and clear comments explaining vectors, loops, and conditions.
4. ROBUST INPUT / OUTPUT HANDLING:
   - Always handle inputs cleanly (e.g., \`input().strip()\` in Python, \`cin >> ...\` in C++).
   - Ensure the code handles edge cases (like empty strings, single items, 0) gracefully with an explanatory comment.

ONE-SHOT 100% ACCURATE CODE FIXING PROTOCOL (MANDATORY):
When the user asks to FIX, DEBUG, CORRECT, OPTIMIZE, or WRITE code, or when errors/diagnostics are reported:
1. Thoroughly analyze the full codebase, syntax, logic, imports, data types, and edge cases.
2. Identify and resolve ALL bugs (syntax errors, runtime exceptions, logic flaws, indentation issues, missing parentheses/quotes/colons, unhandled exceptions) simultaneously across the entire file.
3. In "replacement": Provide the COMPLETE, 100% RUNNABLE, BEAUTIFULLY COMMENTED, PRODUCTION-READY, BUG-FREE source code.
   - NEVER truncate.
   - NEVER use placeholders like "// ... rest of code ..." or "...".
   - Ensure the code compiles/runs on the very first attempt with zero errors.
4. In "reason": A concise 1-sentence summary of the fix.
5. In "message": Provide a structured, beautiful markdown explanation highlighting the exact bug and the solution in simple words.
6. In "speechText": Provide a warm spoken summary for voice output.

TEST CASE FIXING & REGRESSION PREVENTION PROTOCOL (MANDATORY):
When a failed test case is provided or when fixing test case failures:
1. ROOT CAUSE ANALYSIS:
   - Carefully study the test case Input, Expected Output, and what the code actually produced.
   - Pinpoint the exact issue: off-by-one errors, missing edge cases (empty input, single element, negative numbers), case sensitivity, wrong initialization, or algorithmic flaw.
2. REGRESSION PREVENTION (NO HARDCODING):
   - Fix the underlying general algorithm. NEVER write input-specific hacks like "if input == X: return Y".
   - Ensure the fix handles the failed case while keeping all standard and existing cases correct and passing.
3. IN "replacement": Return the COMPLETE, 100% runnable, ChatGPT-style well-commented updated source code that passes all test cases.
4. IN "reason": State the exact logic fix (e.g., "Converted string to lowercase to ensure case-insensitive comparison").
5. IN "message": Explain in friendly Hinglish/English what caused the failure, show the dry-run, and explain the fix.

TEACHER EXPLANATION STRUCTURE (MANDATORY):
When the user asks to EXPLAIN code or understand a concept:
1. 🎯 Scenario / Problem Overview: Explain what the code does and the main objective in simple, relatable words.
2. 📖 Line-by-Line / Step-by-Step Breakdown: Walk through the code line-by-line or section-by-section like a great teacher (e.g. "Line 1: Bhai yahan hum...", "Line 2: Is line me hum...").
3. 🚀 How It Works & Output: Provide sample input and output.

LANGUAGE & VOICE RULES:
1. HINGLISH (e.g. "bhai code fix karde", "error solve karo", "calculator explain karo", "ye code run kyu nahi ho raha"):
   - "message": Write in friendly, structured HINGLISH markdown with bold headers and step-by-step breakdown.
   - "speechText": Write in fluent, sweet, natural DEVANAGARI HINDI (e.g. "नमस्ते! मैंने आपके कोड को ठीक कर दिया है और हर स्टेप पर स्पष्ट कमेंट्स जोड़ दिए हैं ताकि आप आसानी से समझ सकें।").
2. PURE HINDI (e.g. "मुझे यह कोड ठीक करके दो", "पायथन में फंक्शन क्या है?"):
   - "message": Write in Hindi (Devanagari) with structured line-by-line breakdown.
   - "speechText": Write in Hindi (Devanagari).
3. PURE ENGLISH (e.g. "Fix this bug", "Explain this code", "How does a loop work?"):
   - "message": Write in structured English markdown with line-by-line breakdown.
   - "speechText": Write in clear, friendly spoken English walking through the concept.

CORE RULES:
1. Always prioritize 100% bug-free correctness, clean comments, and beginner-friendly readability in "replacement".
2. NEVER repeat greetings ("Namaste") on every single turn if already in an ongoing conversation.
3. NEVER put raw code syntax, curly braces, colons, or punctuation inside "speechText" (synthesizers must speak smooth human words only).

RESPONSE JSON FORMAT:
{
  "message": "Structured markdown explanation with line-by-line breakdown.",
  "speechText": "Natural spoken teacher walkthrough for the voice engine.",
  "replacement": "100% complete, runnable, well-commented source code.",
  "reason": "1-sentence summary."
}`;

function userContext(input: NovaInput): string {
  const parts: string[] = [`User request: ${input.message}`, `Language: ${input.language}`];

  if (input.code?.trim()) {
    const fileName = input.entryFile || (input.language === "cpp" ? "main.cpp" : "main.py");
    parts.push(
      `\nActive file (${fileName}):\n\`\`\`${input.language}\n${input.code.slice(0, 15000)}\n\`\`\``,
    );
  }

  if (input.files && input.files.length > 0) {
    const otherFiles = input.files.filter((f) => f.name !== input.entryFile);
    if (otherFiles.length > 0) {
      parts.push("\nRelated project files:");
      for (const file of otherFiles.slice(0, 6)) {
        parts.push(`\nFile: ${file.name}\n\`\`\`\n${file.content.slice(0, 4000)}\n\`\`\``);
      }
    }
  }

  if (input.diagnostics && input.diagnostics.length > 0) {
    const errorList = input.diagnostics
      .slice(0, 10)
      .map((d) => `- ${d.line ? `[Line ${d.line}] ` : ""}${d.message}`)
      .join("\n");
    parts.push(`\nCompiler / Runtime Diagnostics:\n${errorList}`);
  }

  if (input.failedTestCase) {
    parts.push(`\n🚨 FAILED TEST CASE REQUIRING FIX:
- Test Name: "${input.failedTestCase.name}" (${input.failedTestCase.category || "Test Case"})
${input.failedTestCase.explanation ? `- Purpose: ${input.failedTestCase.explanation}\n` : ""}- Input (stdin):
\`\`\`
${input.failedTestCase.input}
\`\`\`
- Expected Output:
\`\`\`
${input.failedTestCase.expectedOutput ?? "(None)"}
\`\`\`
- Actual Output:
\`\`\`
${input.failedTestCase.actualOutput || "(No stdout produced)"}
\`\`\`
${input.failedTestCase.error ? `- Stderr / Error: ${input.failedTestCase.error}\n` : ""}
Task: Modify the code to correctly produce the Expected Output for this test case while preserving correctness for all other valid inputs.`);
  }

  if (input.testCases && input.testCases.length > 0) {
    const otherCases = input.testCases.filter(
      (tc) => !input.failedTestCase || tc.id !== input.failedTestCase.id,
    );
    if (otherCases.length > 0) {
      parts.push(
        `\nOther Test Cases in Suite (must also pass without regression):\n` +
          otherCases
            .slice(0, 5)
            .map(
              (tc) =>
                `- [${tc.status?.toUpperCase() || "CASE"}] "${tc.name}": Input \`${JSON.stringify(tc.input)}\` -> Expected \`${JSON.stringify(tc.expectedOutput ?? "")}\``,
            )
            .join("\n"),
      );
    }
  }

  return parts.join("\n");
}

function parseReply(value: string): NovaReply {
  try {
    let cleaned = value.trim();

    // Match code block only if the entire response is wrapped in ```json ... ```
    const jsonMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    let candidate: Record<string, unknown> | null = null;
    try {
      candidate = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          candidate = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
        } catch {
          // Ignore invalid slice
        }
      }
    }

    if (candidate && typeof candidate === "object") {
      let replacement =
        typeof candidate.replacement === "string" && candidate.replacement.trim()
          ? candidate.replacement.trim()
          : undefined;

      const message =
        typeof candidate.message === "string" && candidate.message.trim()
          ? candidate.message.trim()
          : "Here is the generated code.";

      const speechText =
        typeof candidate.speechText === "string" && candidate.speechText.trim()
          ? candidate.speechText.trim()
          : undefined;

      // If replacement was not provided or empty, but message contains a markdown code block, extract it!
      if (!replacement && message) {
        const codeBlockMatch = message.match(
          /```(?:python|py|cpp|c\+\+|c)?\s*\n?([\s\S]*?)\n?```/i,
        );
        if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
          replacement = codeBlockMatch[1].trim();
        }
      }

      if (replacement) {
        replacement = normalizeCodeNewlines(
          replacement
            .replace(/^```(?:python|py|cpp|c\+\+|c)?\s*\n?/i, "")
            .replace(/\n?```\s*$/i, "")
            .trim(),
        );
      }

      const reason =
        typeof candidate.reason === "string" ? candidate.reason : "Code corrected by GOAT.";

      return {
        message,
        speechText,
        replacement,
        reason,
      };
    }

    // Fallback if LLM replied in plain markdown with a code block
    const codeMatch = value.match(/```(?:python|py|cpp|c\+\+|c)?\s*\n?([\s\S]*?)\n?```/i);
    return {
      message: value.replace(/```[\s\S]*?```/g, "").trim() || "Here is the corrected code.",
      replacement: codeMatch ? normalizeCodeNewlines(codeMatch[1].trim()) : undefined,
      reason: "Generated corrected code based on your request.",
    };
  } catch (error) {
    console.error("[GOAT parse error]", error);
    return {
      message: "GOAT prepared a response, but encountered a formatting issue. Please try again.",
    };
  }
}

export async function queryAI(
  system: string,
  user: string,
  temperature = 0.2,
  asJson = true,
): Promise<string> {
  const configuredUrl = process.env.AI_BASE_URL ?? "";

  if (/localhost:11434|127\.0\.0\.1:11434/.test(configuredUrl)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(`${configuredUrl.replace(/\/v1\/?$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? "llama3.2:latest",
          stream: false,
          options: { temperature },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "");
        throw new Error(`Ollama request failed (${response.status}): ${error.slice(0, 180)}`);
      }

      const data = (await response.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  if (!apiKey) {
    throw new Error(
      "AI API Key is not configured. Please add AI_API_KEY (Groq, Gemini, or OpenAI) to Render Environment Variables.",
    );
  }

  const isGemini =
    Boolean(process.env.GEMINI_API_KEY) ||
    apiKey.startsWith("AIzaSy") ||
    /googleapis\.com/.test(process.env.AI_BASE_URL ?? "");

  const baseUrl =
    process.env.AI_BASE_URL ??
    (isGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : "https://api.groq.com/openai/v1");

  const modelCandidates = isGemini
    ? [
        process.env.AI_MODEL || "gemini-2.0-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
      ]
    : [
        process.env.AI_MODEL || "openai/gpt-oss-120b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
      ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    for (const model of modelCandidates) {
      try {
        console.info(`[Nova] Calling model: ${model}`);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature,
            max_tokens: 3000,
            ...(asJson ? { response_format: { type: "json_object" } } : {}),
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          return data.choices?.[0]?.message?.content ?? "";
        }

        const errText = await response.text().catch(() => "");
        console.warn(`[Nova] Model ${model} returned ${response.status}: ${errText.slice(0, 120)}`);
      } catch (innerError) {
        console.warn(
          `[Nova] Attempt with ${model} failed:`,
          innerError instanceof Error ? innerError.message : innerError,
        );
      }
    }

    throw new Error("Unable to connect to AI provider. Please check your API key and network.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("GOAT request timed out. Please try a simpler request.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function askOpenAI(input: NovaInput): Promise<NovaReply> {
  const content = await queryAI(systemPrompt, userContext(input), 0.2);
  return parseReply(content);
}

const complexitySystemPrompt = `You are an expert algorithmic complexity analyzer and senior computer science professor.
Analyze the provided code for Time Complexity and Space Complexity in Big-O notation (e.g. O(1), O(log N), O(N), O(N log N), O(N^2), O(2^N)).
Identify any performance bottlenecks (e.g. nested loops, repeated copying, recursion depth) and suggest a concrete optimization if feasible.
Respond strictly in valid JSON format:
{
  "timeComplexity": "O(N)",
  "spaceComplexity": "O(1)",
  "summary": "Concise 2-sentence explanation of why the code has this complexity.",
  "bottleneck": "Identification of the specific loop or recursion line causing the bottleneck (or 'None' if optimal).",
  "suggestion": "How to optimize the algorithm or improve performance (e.g. using Hash Map, Two Pointers, or memoization)."
}`;

export async function analyzeComplexity(
  language: LanguageId,
  code: string,
): Promise<ComplexityResult> {
  try {
    const raw = await queryAI(
      complexitySystemPrompt,
      `Language: ${language}\n\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\``,
      0.1,
    );

    const parsed = JSON.parse(raw) as Partial<ComplexityResult>;
    return {
      timeComplexity: parsed.timeComplexity || "O(N)",
      spaceComplexity: parsed.spaceComplexity || "O(1)",
      summary: parsed.summary || "Algorithm complexity evaluated.",
      bottleneck: parsed.bottleneck || undefined,
      suggestion: parsed.suggestion || undefined,
    };
  } catch (err) {
    console.error("[Complexity analysis error]", err);
    return {
      timeComplexity: "Unknown",
      spaceComplexity: "Unknown",
      summary: "Could not evaluate complexity automatically. Please verify code syntax.",
      bottleneck: undefined,
      suggestion: undefined,
    };
  }
}

const testCaseGeneratorSystemPrompt = `You are an elite competitive programming setter (Codeforces Grandmaster / LeetCode Guardian) and expert QA test engineer.
Your mission is to generate high-quality, comprehensive, bug-finding test cases for the user's code.

### Instructions:
1. INPUT PARSING ANALYSIS:
   - Carefully inspect how the code consumes input (e.g., input().split(), consecutive input() calls, cin >> a >> b, or cin >> n followed by a loop).
   - Ensure the \`input\` format EXACTLY matches what the program reads. If it expects numbers on new lines, use newlines. If space-separated, format them on the same line.

2. GROUND-TRUTH EXPECTED OUTPUT:
   - Perform an exact, step-by-step mental trace of the problem logic to calculate 100% accurate \`expectedOutput\`.
   - Never guess or approximate outputs. Ensure formatting (e.g. YES/NO, space separation, exact casing) matches what the code prints.

3. COMPREHENSIVE TEST SUITE CATEGORIES:
   Generate 4 to 5 rigorous test cases covering:
   - Case 1 (Category "Sample"): Standard baseline case showing normal execution.
   - Case 2 (Category "Boundary"): Smallest or largest boundary conditions (e.g. n=0, n=1, empty string, or single element).
   - Case 3 (Category "Edge Case"): Tricky edge conditions (e.g. negative numbers, duplicates, all identical values, or boundary conditions).
   - Case 4 (Category "Scale"): Test invariance with unusual orderings (e.g. descending/reverse sorted, alternating values, or larger values).

4. EXPLANATION:
   - Provide a concise 1-sentence \`explanation\` for each test case explaining what edge case, invariant, or boundary it tests.

### Response Format:
Respond STRICTLY in valid JSON format:
{
  "testCases": [
    {
      "name": "Standard Positive Numbers",
      "category": "Sample",
      "input": "5\\n1 2 3 4 5",
      "expectedOutput": "15",
      "explanation": "Validates typical summation on standard positive integers."
    },
    {
      "name": "Single Element Boundary",
      "category": "Boundary",
      "input": "1\\n42",
      "expectedOutput": "42",
      "explanation": "Verifies that minimal length-1 array executes without index out of bounds."
    },
    {
      "name": "Negative and Zero Values",
      "category": "Edge Case",
      "input": "4\\n-10 0 5 -5",
      "expectedOutput": "-10",
      "explanation": "Tests correct handling of negative integers and zeroes."
    }
  ]
}`;

export async function generateTestCases(
  language: LanguageId,
  code: string,
): Promise<
  Array<{
    name: string;
    category?: TestCase["category"];
    input: string;
    expectedOutput: string;
    explanation?: string;
  }>
> {
  try {
    const raw = await queryAI(
      testCaseGeneratorSystemPrompt,
      `Language: ${language}\n\nCode to test:\n\`\`\`${language}\n${code}\n\`\`\``,
      0.15,
    );

    const parsed = JSON.parse(raw) as {
      testCases?: Array<{
        name?: string;
        category?: TestCase["category"];
        input?: string;
        expectedOutput?: string;
        explanation?: string;
      }>;
    };

    if (Array.isArray(parsed.testCases) && parsed.testCases.length > 0) {
      return parsed.testCases.map((tc, idx) => ({
        name: tc.name || `Case ${idx + 1}`,
        category: tc.category || (idx === 0 ? "Sample" : "Edge Case"),
        input: tc.input ?? "",
        expectedOutput: tc.expectedOutput ?? "",
        explanation: tc.explanation || undefined,
      }));
    }

    return [
      {
        name: "Default Sample",
        category: "Sample",
        input: "",
        expectedOutput: "",
        explanation: "Default test case",
      },
      {
        name: "Zero Boundary",
        category: "Boundary",
        input: "0",
        expectedOutput: "0",
        explanation: "Boundary with zero",
      },
    ];
  } catch (err) {
    console.error("[Test cases generator error]", err);
    return [
      {
        name: "Default Sample",
        category: "Sample",
        input: "",
        expectedOutput: "",
        explanation: "Default test case",
      },
      {
        name: "Zero Boundary",
        category: "Boundary",
        input: "0",
        expectedOutput: "",
        explanation: "Boundary with zero",
      },
    ];
  }
}

const explainFailureSystemPrompt = `You are GOAT, an expert, encouraging coding teacher and competitive programming mentor.
A student's code failed a specific test case in the test runner.
Your task is to analyze:
1. The student's code.
2. The Test Case Input.
3. The Expected Output.
4. What the student's code actually produced (Actual Output or Error message).

Provide a friendly, crystal-clear explanation in Hinglish/English explaining:
1. "Kaha gadbad hui" (Root Cause): Exactly which line of code or logic caused the difference.
2. Dry run walk-through of that specific input.
3. The exact fix to resolve the error.

Keep it encouraging, educational, and actionable.`;

export async function explainTestCaseFailure(
  language: LanguageId,
  code: string,
  testCase: TestCase,
): Promise<string> {
  const userPrompt = `Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`

Failed Test Case: "${testCase.name}" (${testCase.category || "Test Case"})
${testCase.explanation ? `Purpose: ${testCase.explanation}\n` : ""}
Input (stdin):
\`\`\`
${testCase.input}
\`\`\`

Expected Output:
\`\`\`
${testCase.expectedOutput ?? "(None specified)"}
\`\`\`

Actual Program Output:
\`\`\`
${testCase.actualOutput || "(No stdout produced)"}
\`\`\`

${testCase.error ? `Error / Stderr:\n\`\`\`\n${testCase.error}\n\`\`\`` : ""}

Please explain why my code failed on this input and how to fix it.`;

  return queryAI(explainFailureSystemPrompt, userPrompt, 0.2, false);
}

export async function fixFailedTestCaseAI(
  language: LanguageId,
  code: string,
  failedTestCase: TestCase,
  allTestCases?: TestCase[],
  files?: Array<{ name: string; content: string }>,
  entryFile?: string,
): Promise<NovaReply> {
  const message = `Please fix my code so that it passes the failed testcase "${failedTestCase.name}". Produce the 1-shot complete corrected code in "replacement" and explain the fix.`;
  return askOpenAI({
    message,
    language,
    code,
    files,
    entryFile,
    failedTestCase,
    testCases: allTestCases,
  });
}
