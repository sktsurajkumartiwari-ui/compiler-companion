import { useState, useRef, useCallback, useEffect } from "react";

export type TTSVoiceGender = "male" | "female";
export type TTSLanguageMode = "auto" | "hindi" | "english";

export interface TextToSpeechHookProps {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

export function isIndianVoice(voiceOrName: SpeechSynthesisVoice | string): boolean {
  const name = (typeof voiceOrName === "string" ? voiceOrName : voiceOrName.name).toLowerCase();
  const lang = (typeof voiceOrName === "string" ? "" : voiceOrName.lang).toLowerCase();

  return (
    lang.includes("hi-in") ||
    lang.includes("hi_in") ||
    lang.includes("en-in") ||
    lang.includes("en_in") ||
    name.includes("india") ||
    name.includes("prabhat") ||
    name.includes("neerja") ||
    name.includes("madhur") ||
    name.includes("swara") ||
    name.includes("heera") ||
    name.includes("ravi") ||
    name.includes("kalpana") ||
    name.includes("ananya") ||
    name.includes("हिन्दी") ||
    name.includes("hindi")
  );
}

export function isFemaleVoice(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("swara") ||
    n.includes("neerja") ||
    n.includes("heera") ||
    n.includes("aria") ||
    n.includes("jenny") ||
    n.includes("zira") ||
    n.includes("hazel") ||
    n.includes("susan") ||
    n.includes("catherine") ||
    n.includes("linda") ||
    n.includes("female") ||
    n.includes("girl") ||
    n.includes("woman") ||
    n.includes("victoria") ||
    n.includes("kalpana") ||
    n.includes("ananya") ||
    n.includes("google us english") ||
    n.includes("google हिन्दी") ||
    n.includes("google hindi") ||
    n.includes("google uk english female") ||
    n.includes("google español") ||
    n.includes("google français")
  );
}

export function isMaleVoice(name: string): boolean {
  const n = name.toLowerCase();
  if (isFemaleVoice(n)) return false;
  return (
    n.includes("guy") ||
    n.includes("christopher") ||
    n.includes("prabhat") ||
    n.includes("brian") ||
    n.includes("ryan") ||
    n.includes("david") ||
    n.includes("mark") ||
    n.includes("george") ||
    n.includes("ravi") ||
    n.includes("madhur") ||
    n.includes("eric") ||
    n.includes("uk english male") ||
    (n.includes("male") && !n.includes("female"))
  );
}

export function humanizeTextForSpeech(text: string): string {
  if (!text) return "";

  let speech = text;

  // 1. Convert code blocks into conversational cues
  speech = speech.replace(
    /```(?:python|cpp|c\+\+|json|bash)?\s*([\s\S]*?)\s*```/gi,
    " Here is the code. ",
  );

  // 2. Convert inline backtick code `something` to spoken words
  speech = speech.replace(/`([^`]+)`/g, " $1 ");

  // 3. Remove markdown headers, bold, italics, bullets, blockquotes
  speech = speech
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^[*-]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "");

  // 4. Remove emojis that cause robotic TTS glitches
  speech = speech.replace(/\p{Extended_Pictographic}/gu, "").replace(/[\uFE00-\uFE0F]/g, "");

  // 5. Expand abbreviations & contractions for ultra-smooth pronunciation
  speech = speech
    .replace(/\be\.g\.\b/gi, "for example")
    .replace(/\bi\.e\.\b/gi, "that is")
    .replace(/\betc\.\b/gi, "and so on")
    .replace(/\blet's\b/gi, "let us")
    .replace(/\bdon't\b/gi, "do not")
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bit's\b/gi, "it is")
    .replace(/\bthat's\b/gi, "that is")
    .replace(/\bwhat's\b/gi, "what is")
    .replace(/\bhere's\b/gi, "here is")
    .replace(/\bdef\s+/gi, "function ")
    .replace(/\breturn\s+/gi, "returns ")
    .replace(/\bprint\s*\(/gi, "prints ");

  // 6. Replace programming symbols with natural conversational words
  speech = speech
    .replace(/!=/g, " is not equal to ")
    .replace(/==/g, " equals ")
    .replace(/\+=/g, " plus equals ")
    .replace(/-=/g, " minus equals ")
    .replace(/<=/g, " is less than or equal to ")
    .replace(/>=/g, " is greater than or equal to ")
    .replace(/->/g, " leads to ")
    .replace(/=>/g, " then ")
    .replace(/[()[\]{}"']/g, " ")
    .replace(/[:;_#$@%^&|~]/g, " ");

  // 7. Format gentle pauses and remove excess whitespace
  speech = speech
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\.\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  // Allow full, structured teacher explanations up to 2500 characters without skipping
  if (speech.length > 2500) {
    const cutoff = speech.lastIndexOf(".", 2500);
    speech = cutoff > 1500 ? speech.slice(0, cutoff + 1) : speech.slice(0, 2500) + "...";
  }

  return speech;
}

export function useTextToSpeech({ onStart, onEnd, onError }: TextToSpeechHookProps = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceGender, setVoiceGenderState] = useState<TTSVoiceGender>(() => {
    try {
      const stored = localStorage.getItem("compiler-companion-voice-gender");
      return stored === "female" ? "female" : "male";
    } catch {
      return "male";
    }
  });

  const [languageMode, setLanguageModeState] = useState<TTSLanguageMode>(() => {
    try {
      const stored = localStorage.getItem("compiler-companion-lang-mode");
      return (stored as TTSLanguageMode) || "auto";
    } catch {
      return "auto";
    }
  });

  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    try {
      return localStorage.getItem("compiler-companion-voice-uri") || "";
    } catch {
      return "";
    }
  });

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("compiler-companion-tts") === "true";
    } catch {
      return true;
    }
  });

  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const changeVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try {
      localStorage.setItem("compiler-companion-voice-uri", voiceURI);
    } catch {
      // Ignore
    }
  }, []);

  const setVoiceGender = useCallback((gender: TTSVoiceGender) => {
    setVoiceGenderState(gender);
    setSelectedVoiceURI("");
    try {
      localStorage.setItem("compiler-companion-voice-gender", gender);
      localStorage.removeItem("compiler-companion-voice-uri");
    } catch {
      // Ignore
    }
  }, []);

  const setLanguageMode = useCallback((mode: TTSLanguageMode) => {
    setLanguageModeState(mode);
    setSelectedVoiceURI("");
    try {
      localStorage.setItem("compiler-companion-lang-mode", mode);
      localStorage.removeItem("compiler-companion-voice-uri");
    } catch {
      // Ignore
    }
  }, []);

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("compiler-companion-tts", String(next));
      } catch {
        // Ignore
      }
      if (!next) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
  }, []);

  const speak = useCallback(
    async (text: string, force = false) => {
      if (!ttsEnabled && !force) {
        return;
      }

      stopSpeaking();

      const cleanText = humanizeTextForSpeech(text);
      if (!cleanText.trim()) return;

      // 1. Prioritize Ultra-Realistic HD Neural Voice Stream from Backend (/api/tts)
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            gender: voiceGender,
            language: languageMode,
          }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;
          audio.playbackRate = 1.06; // Snappy, natural pace

          audio.onplay = () => {
            setIsSpeaking(true);
            if (onStart) onStart();
          };

          audio.onended = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
            if (onEnd) onEnd();
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn(
          "[TextToSpeech] Backend HD Neural TTS failed, falling back to local synthesizer:",
          err,
        );
      }

      // 2. Fallback: Local Browser SpeechSynthesis
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const hasDevanagari = /[\u0900-\u097F]/.test(cleanText);
      const isHindi = languageMode === "hindi" || (languageMode === "auto" && hasDevanagari);
      const isMale = voiceGender === "male";
      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;

      utterance.rate = 1.08; // Fast, energetic pace
      utterance.pitch = 1.0;

      const allVoices = window.speechSynthesis.getVoices();
      let chosenVoice: SpeechSynthesisVoice | undefined;

      if (selectedVoiceURI) {
        chosenVoice = allVoices.find((v) => v.voiceURI === selectedVoiceURI);
      }

      if (!chosenVoice) {
        if (isHindi) {
          if (isMale) {
            chosenVoice = allVoices.find((v) => isIndianVoice(v) && isMaleVoice(v.name));
            if (!chosenVoice) chosenVoice = allVoices.find((v) => isMaleVoice(v.name));
          } else {
            chosenVoice = allVoices.find((v) => isIndianVoice(v) && isFemaleVoice(v.name));
            if (!chosenVoice) chosenVoice = allVoices.find((v) => isFemaleVoice(v.name));
          }
        } else {
          if (isMale) {
            chosenVoice = allVoices.find((v) => isIndianVoice(v) && isMaleVoice(v.name));
            if (!chosenVoice) chosenVoice = allVoices.find((v) => isMaleVoice(v.name));
          } else {
            chosenVoice = allVoices.find((v) => isIndianVoice(v) && isFemaleVoice(v.name));
            if (!chosenVoice) chosenVoice = allVoices.find((v) => isFemaleVoice(v.name));
          }
        }
      }

      if (!chosenVoice) {
        chosenVoice = isMale
          ? allVoices.find((v) => isMaleVoice(v.name))
          : allVoices.find((v) => isFemaleVoice(v.name));
      }

      if (!chosenVoice) {
        chosenVoice = allVoices[0];
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || "en-US";
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (onStart) onStart();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (err) => {
        console.warn("[TextToSpeech] Synthesis error:", err);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        if (onError) onError(err);
      };

      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error("[TextToSpeech] speak failed:", e);
      }
    },
    [
      ttsEnabled,
      selectedVoiceURI,
      voiceGender,
      languageMode,
      stopSpeaking,
      onStart,
      onEnd,
      onError,
    ],
  );

  const testVoice = useCallback(() => {
    let sample = "";
    if (languageMode === "hindi" || languageMode === "auto") {
      sample =
        voiceGender === "male"
          ? "Namaste! Main aapka AI coding mentor GOAT hoon. Chaliye milkar code seekhte hain."
          : "Namaste! Main aapki AI coding mentor GOAT hoon. Chaliye milkar code seekhte hain.";
    } else {
      sample =
        voiceGender === "male"
          ? "Hello! I am GOAT, your AI coding mentor. Ready to explore code together!"
          : "Hello! I am GOAT, your AI coding mentor. Ready to explore code together!";
    }
    speak(sample, true);
  }, [speak, voiceGender, languageMode]);

  return {
    isSpeaking,
    ttsEnabled,
    voices,
    voiceGender,
    languageMode,
    selectedVoiceURI,
    setVoiceGender,
    setLanguageMode,
    changeVoice,
    toggleTts,
    speak,
    stopSpeaking,
    testVoice,
  };
}
