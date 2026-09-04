import { useState, useCallback, useRef } from "react";
import { useSpeechRecognition, type SpeechLanguageMode } from "./useSpeechRecognition";
import {
  useTextToSpeech,
  type TTSVoiceGender,
  isFemaleVoice,
  isMaleVoice,
  isIndianVoice,
  humanizeTextForSpeech,
} from "./useTextToSpeech";

export type AssistantState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  onVoiceCommand: (command: "run" | "save" | "fix" | "query", text: string) => void;
  onStateChange?: (state: AssistantState) => void;
}

export { isFemaleVoice, isMaleVoice, isIndianVoice, humanizeTextForSpeech };
export type VoiceGender = TTSVoiceGender;
export type LanguageMode = SpeechLanguageMode;

export function useVoiceAssistant({
  onTranscript,
  onVoiceCommand,
  onStateChange,
}: VoiceAssistantProps) {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSpeechResponse, setLastSpeechResponse] = useState<string>("");
  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const [lastAiMessage, setLastAiMessage] = useState<string>("");

  const isVoiceModeRef = useRef(false);
  isVoiceModeRef.current = isVoiceMode;

  const tts = useTextToSpeech({
    onStart: () => {
      if (onStateChange) onStateChange("speaking");
    },
    onEnd: () => {
      // In hands-free Voice Mode, automatically resume listening after speaking!
      if (isVoiceModeRef.current) {
        setTimeout(() => {
          if (isVoiceModeRef.current) {
            stt.startListening();
          }
        }, 500);
      } else {
        if (onStateChange) onStateChange("idle");
      }
    },
    onError: () => {
      if (onStateChange) onStateChange("error");
    },
  });

  const handleSpeechResult = useCallback(
    (text: string) => {
      setLastUserMessage(text);
      onTranscript(text);

      const lower = text.toLowerCase().trim();
      if (/^(exit voice mode|stop voice mode|close voice mode|exit)$/i.test(lower)) {
        setIsVoiceMode(false);
        tts.speak("Exiting voice mode.", true);
        return;
      }

      if (/^(run|run program|run code|execute|execute program)$/i.test(lower)) {
        onVoiceCommand("run", text);
      } else if (/^(save|save file|save code|save to disk)$/i.test(lower)) {
        onVoiceCommand("save", text);
      } else if (/^(fix it|fix error|fix code|fix the bug|repair code)$/i.test(lower)) {
        onVoiceCommand("fix", text);
      } else {
        onVoiceCommand("query", text);
      }
    },
    [onTranscript, onVoiceCommand, tts],
  );

  const stt = useSpeechRecognition({
    languageMode: tts.languageMode,
    onResult: handleSpeechResult,
  });

  // Determine global 5-state assistant state
  const assistantState: AssistantState = stt.error
    ? "error"
    : tts.isSpeaking
      ? "speaking"
      : processing
        ? "processing"
        : stt.isListening
          ? "listening"
          : "idle";

  // Instant Interruption: Stop speaking immediately and optionally start listening
  const interrupt = useCallback(() => {
    tts.stopSpeaking();
    stt.startListening();
  }, [tts, stt]);

  const toggleVoiceMode = useCallback(() => {
    setIsVoiceMode((prev) => {
      const next = !prev;
      if (next) {
        tts.stopSpeaking();
        stt.startListening();
      } else {
        stt.stopListening();
        tts.stopSpeaking();
      }
      return next;
    });
  }, [stt, tts]);

  const enterVoiceMode = useCallback(() => {
    setIsVoiceMode(true);
    tts.stopSpeaking();
    stt.startListening();
  }, [stt, tts]);

  const exitVoiceMode = useCallback(() => {
    setIsVoiceMode(false);
    stt.stopListening();
    tts.stopSpeaking();
  }, [stt, tts]);

  // Enhanced speak helper that records last speech
  const speak = useCallback(
    (text: string, force = false) => {
      setLastSpeechResponse(text);
      setLastAiMessage(text);
      tts.speak(text, force);
    },
    [tts],
  );

  return {
    // State machine
    assistantState,
    isListening: stt.isListening,
    isSpeaking: tts.isSpeaking,
    isVoiceMode,
    processing,
    setProcessing,
    speechSupported: stt.supported,
    interimText: stt.interimText,
    error: stt.error,
    lastSpeechResponse,
    lastUserMessage,
    lastAiMessage,

    // TTS configurations
    ttsEnabled: tts.ttsEnabled,
    voices: tts.voices,
    voiceGender: tts.voiceGender,
    languageMode: tts.languageMode,
    selectedVoiceURI: tts.selectedVoiceURI,
    setVoiceGender: tts.setVoiceGender,
    setLanguageMode: tts.setLanguageMode,
    changeVoice: tts.changeVoice,
    toggleTts: tts.toggleTts,
    testVoice: tts.testVoice,

    // Controls
    startListening: stt.startListening,
    stopListening: stt.stopListening,
    toggleListening: stt.toggleListening,
    speak,
    stopSpeaking: tts.stopSpeaking,
    interrupt,
    toggleVoiceMode,
    enterVoiceMode,
    exitVoiceMode,
  };
}
