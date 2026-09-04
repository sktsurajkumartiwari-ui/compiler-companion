import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechLanguageMode = "auto" | "hindi" | "english";

export interface SpeechRecognitionHookProps {
  languageMode?: SpeechLanguageMode;
  onResult?: (finalTranscript: string) => void;
  onError?: (error: string) => void;
}

export interface SpeechRecognitionEventItem {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultItem {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionEventItem;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultItem;
  };
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function useSpeechRecognition({
  languageMode = "auto",
  onResult,
  onError,
}: SpeechRecognitionHookProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastTranscriptRef = useRef("");
  const hasDispatchedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as Record<string, unknown>;
    const hasRecognition = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    setSupported(hasRecognition);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
    }
    setIsListening(false);
  }, []);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort error
      }
    }
    hasDispatchedRef.current = true; // prevent dispatch on abort
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionConstructor = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      (new () => SpeechRecognitionInstance) | undefined;

    if (!SpeechRecognitionConstructor) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      if (onError) onError("unsupported_browser");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    setError(null);
    hasDispatchedRef.current = false;
    lastTranscriptRef.current = "";

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;

    // Use Indian English (en-IN) by default to accurately recognize Hinglish, Hindi, and English loanwords
    recognition.lang =
      languageMode === "hindi" ? "hi-IN" : languageMode === "english" ? "en-US" : "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText("");
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (!item) continue;
        const transcript = item[0]?.transcript ?? "";
        if (item.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      const activeText = (finalTranscript || interim).trim();
      if (activeText) {
        lastTranscriptRef.current = activeText;
        setInterimText(activeText);
      }

      if (finalTranscript && !hasDispatchedRef.current) {
        const text = finalTranscript.trim();
        hasDispatchedRef.current = true;
        setInterimText("");
        if (onResult) onResult(text);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn("[SpeechRecognition] Error event:", event.error);
      if (event.error === "not-allowed") {
        setError(
          "Microphone permission was denied. Please allow microphone access in your browser URL bar.",
        );
      } else if (event.error === "no-speech") {
        // Soft error: don't block UI with error state
        setError(null);
      } else if (event.error !== "aborted") {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
      setInterimText("");
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Fallback: If recognition ended before a final event, dispatch last recognized interim transcript!
      if (!hasDispatchedRef.current && lastTranscriptRef.current) {
        const text = lastTranscriptRef.current.trim();
        hasDispatchedRef.current = true;
        setInterimText("");
        if (onResult) onResult(text);
      }
      setInterimText("");
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("[SpeechRecognition] Failed to start:", err);
      setIsListening(false);
    }
  }, [languageMode, onResult, onError]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    interimText,
    supported,
    error,
    startListening,
    stopListening,
    abortListening,
    toggleListening,
  };
}
