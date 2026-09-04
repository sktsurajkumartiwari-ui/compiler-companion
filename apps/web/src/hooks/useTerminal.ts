import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageId } from "@compiler-companion/shared";

export type TerminalStatus = "idle" | "starting" | "running" | "exited" | "killed" | "error";

export interface TerminalLog {
  id: string;
  type: "stdout" | "stderr" | "stdin" | "system";
  text: string;
  timestamp: number;
}

interface UseTerminalOptions {
  onExit?: (fullStdout: string, fullStderr: string, exitCode: number | null) => void;
}

export function useTerminal(options?: UseTerminalOptions) {
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [inputValue, setInputValue] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const stdoutAccumulator = useRef<string>("");
  const stderrAccumulator = useRef<string>("");
  const onExitRef = useRef(options?.onExit);
  onExitRef.current = options?.onExit;

  const appendLog = useCallback((type: TerminalLog["type"], text: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        text,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const getWsUrl = useCallback(() => {
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    const host = window.location.hostname || "localhost";
    const isLocalhost = /^(localhost|127\.0\.0\.1)$/.test(host);
    if (!isLocalhost) {
      return "wss://compiler-companion-api.onrender.com/api/terminal";
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}:8787/api/terminal`;
  }, []);

  const connect = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        resolve(socketRef.current);
        return;
      }

      const ws = new WebSocket(getWsUrl());
      socketRef.current = ws;

      ws.onopen = () => {
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "status":
              if (msg.status === "starting") {
                setStatus("starting");
              }
              break;
            case "stdout":
              setStatus("running");
              stdoutAccumulator.current += msg.data;
              appendLog("stdout", msg.data);
              break;
            case "stderr":
              setStatus("running");
              stderrAccumulator.current += msg.data;
              appendLog("stderr", msg.data);
              break;
            case "exit":
              setStatus("exited");
              appendLog("system", `\n[Program exited with code ${msg.code ?? 0}]`);
              onExitRef.current?.(
                stdoutAccumulator.current,
                stderrAccumulator.current,
                msg.code ?? 0,
              );
              break;
            case "killed":
              setStatus("killed");
              appendLog("system", "\n[Program terminated]");
              onExitRef.current?.(stdoutAccumulator.current, stderrAccumulator.current, null);
              break;
            case "error":
              setStatus("error");
              appendLog("stderr", `Error: ${msg.message}\n`);
              break;
          }
        } catch {
          appendLog("stdout", event.data);
        }
      };

      ws.onerror = () => {
        setStatus("error");
        appendLog("stderr", "WebSocket connection error. Make sure the API server is running.\n");
        reject(new Error("WebSocket connection error"));
      };

      ws.onclose = () => {
        socketRef.current = null;
      };
    });
  }, [appendLog, getWsUrl]);

  const start = useCallback(
    async (
      language: LanguageId,
      code: string,
      files?: Array<{ name: string; content: string }>,
      entryFile?: string,
    ) => {
      stdoutAccumulator.current = "";
      stderrAccumulator.current = "";
      setLogs([]);
      setStatus("starting");
      appendLog("system", `[Running ${language} in secure sandbox...]\n`);

      try {
        const ws = await connect();
        ws.send(JSON.stringify({ type: "start", language, code, files, entryFile }));
      } catch (err) {
        setStatus("error");
        appendLog(
          "stderr",
          `Failed to launch sandbox: ${err instanceof Error ? err.message : "Connection failed"}\n`,
        );
      }
    },
    [appendLog, connect],
  );

  const sendInput = useCallback(
    (text: string) => {
      const trimmed = text.trimEnd();
      if (trimmed) {
        setInputHistory((prev) => [...prev, trimmed]);
      }
      setHistoryIndex(-1);
      setInputValue("");

      // Echo to logs
      appendLog("stdin", `${text.endsWith("\n") ? text : text + "\n"}`);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const payload = text.endsWith("\n") ? text : `${text}\n`;
        socketRef.current.send(JSON.stringify({ type: "input", data: payload }));
      }
    },
    [appendLog],
  );

  const kill = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "kill" }));
    }
    setStatus("killed");
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
    stdoutAccumulator.current = "";
    stderrAccumulator.current = "";
  }, []);

  const navigateHistory = useCallback(
    (direction: "up" | "down") => {
      if (inputHistory.length === 0) return;

      if (direction === "up") {
        const nextIndex =
          historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInputValue(inputHistory[nextIndex] ?? "");
      } else {
        if (historyIndex === -1) return;
        const nextIndex = historyIndex + 1;
        if (nextIndex >= inputHistory.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(nextIndex);
          setInputValue(inputHistory[nextIndex] ?? "");
        }
      }
    },
    [historyIndex, inputHistory],
  );

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return {
    status,
    logs,
    inputValue,
    setInputValue,
    start,
    sendInput,
    kill,
    clear,
    navigateHistory,
  };
}
