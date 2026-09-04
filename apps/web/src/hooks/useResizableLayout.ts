import { useCallback, useEffect, useRef, useState } from "react";

export type ResizingTarget = "sidebar" | "terminal" | "ai" | null;
export type AiDisplayMode = "popup" | "docked" | "fullscreen";

const STORAGE_KEYS = {
  SIDEBAR_WIDTH: "cc_sidebar_width",
  TERMINAL_HEIGHT: "cc_terminal_height",
  AI_WIDTH: "cc_ai_width",
  AI_OPEN: "cc_ai_open",
  AI_DISPLAY_MODE: "cc_ai_display_mode",
  AI_BTN_POS: "cc_ai_btn_pos",
  AI_POPUP_POS: "cc_ai_popup_pos",
};

export function useResizableLayout() {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH);
      return saved ? Math.max(160, Math.min(480, parseInt(saved, 10))) : 240;
    } catch {
      return 240;
    }
  });

  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TERMINAL_HEIGHT);
      return saved ? Math.max(34, Math.min(600, parseInt(saved, 10))) : 210;
    } catch {
      return 210;
    }
  });

  const [aiWidth, setAiWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_WIDTH);
      return saved ? Math.max(280, Math.min(600, parseInt(saved, 10))) : 360;
    } catch {
      return 360;
    }
  });

  const [isAiOpen, setIsAiOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_OPEN);
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const [previousDisplayMode, setPreviousDisplayMode] = useState<"docked" | "popup">("docked");
  const [aiDisplayMode, setAiDisplayMode] = useState<AiDisplayMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_DISPLAY_MODE);
      return saved === "docked" ? "docked" : "popup";
    } catch {
      return "popup";
    }
  });

  const [btnPos, setBtnPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_BTN_POS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    const defaultX = typeof window !== "undefined" ? Math.max(10, window.innerWidth - 140) : 1000;
    const defaultY = typeof window !== "undefined" ? Math.max(10, window.innerHeight - 80) : 700;
    return { x: defaultX, y: defaultY };
  });

  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_POPUP_POS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    const defaultX = typeof window !== "undefined" ? Math.max(10, window.innerWidth - 380) : 800;
    return { x: defaultX, y: 56 };
  });

  const lastExpandedTerminalHeight = useRef<number>(210);

  // Active resize/drag state: null | "sidebar" | "terminal" | "ai" | "drag-btn" | "drag-popup"
  const [activeAction, setActiveAction] = useState<
    "sidebar" | "terminal" | "ai" | "drag-btn" | "drag-popup" | null
  >(null);

  const actionStartRef = useRef<{
    startX: number;
    startY: number;
    startDim: number;
    startPosX: number;
    startPosY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    startDim: 0,
    startPosX: 0,
    startPosY: 0,
    hasMoved: false,
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, sidebarWidth.toString());
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TERMINAL_HEIGHT, terminalHeight.toString());
      if (terminalHeight > 40) {
        lastExpandedTerminalHeight.current = terminalHeight;
      }
    } catch {
      /* ignore */
    }
  }, [terminalHeight]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_WIDTH, aiWidth.toString());
    } catch {
      /* ignore */
    }
  }, [aiWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_OPEN, isAiOpen.toString());
    } catch {
      /* ignore */
    }
  }, [isAiOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_DISPLAY_MODE, aiDisplayMode);
    } catch {
      /* ignore */
    }
  }, [aiDisplayMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_BTN_POS, JSON.stringify(btnPos));
    } catch {
      /* ignore */
    }
  }, [btnPos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_POPUP_POS, JSON.stringify(popupPos));
    } catch {
      /* ignore */
    }
  }, [popupPos]);

  // Adjust positions on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      setBtnPos((prev) => ({
        x: Math.max(10, Math.min(window.innerWidth - 130, prev.x)),
        y: Math.max(10, Math.min(window.innerHeight - 70, prev.y)),
      }));
      setPopupPos((prev) => ({
        x: Math.max(10, Math.min(window.innerWidth - 370, prev.x)),
        y: Math.max(10, Math.min(window.innerHeight - 200, prev.y)),
      }));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Global mousemove and mouseup listeners
  useEffect(() => {
    if (!activeAction) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ref = actionStartRef.current;
      const dx = e.clientX - ref.startX;
      const dy = e.clientY - ref.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        ref.hasMoved = true;
      }

      if (activeAction === "sidebar") {
        const newWidth = Math.max(160, Math.min(480, ref.startDim + dx));
        setSidebarWidth(newWidth);
      } else if (activeAction === "terminal") {
        const newHeight = Math.max(34, Math.min(window.innerHeight * 0.75, ref.startDim - dy));
        setTerminalHeight(newHeight);
      } else if (activeAction === "ai") {
        const newWidth = Math.max(280, Math.min(window.innerWidth * 0.5, ref.startDim - dx));
        setAiWidth(newWidth);
      } else if (activeAction === "drag-btn") {
        const newX = Math.max(10, Math.min(window.innerWidth - 130, ref.startPosX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 70, ref.startPosY + dy));
        setBtnPos({ x: newX, y: newY });
      } else if (activeAction === "drag-popup") {
        const newX = Math.max(10, Math.min(window.innerWidth - 370, ref.startPosX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 100, ref.startPosY + dy));
        setPopupPos({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setActiveAction(null);
      document.body.classList.remove("dragging-element");
    };

    document.body.classList.add("dragging-element");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.classList.remove("dragging-element");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeAction]);

  // Start Resizing Handlers
  const startResizingSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actionStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDim: sidebarWidth,
        startPosX: 0,
        startPosY: 0,
        hasMoved: false,
      };
      setActiveAction("sidebar");
    },
    [sidebarWidth],
  );

  const startResizingTerminal = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actionStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDim: terminalHeight,
        startPosX: 0,
        startPosY: 0,
        hasMoved: false,
      };
      setActiveAction("terminal");
    },
    [terminalHeight],
  );

  const startResizingAi = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actionStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDim: aiWidth,
        startPosX: 0,
        startPosY: 0,
        hasMoved: false,
      };
      setActiveAction("ai");
    },
    [aiWidth],
  );

  // Dragging Handlers for Floating AI
  const startDraggingBtn = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      actionStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDim: 0,
        startPosX: btnPos.x,
        startPosY: btnPos.y,
        hasMoved: false,
      };
      setActiveAction("drag-btn");
    },
    [btnPos],
  );

  const startDraggingPopup = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      actionStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDim: 0,
        startPosX: popupPos.x,
        startPosY: popupPos.y,
        hasMoved: false,
      };
      setActiveAction("drag-popup");
    },
    [popupPos],
  );

  const toggleTerminal = useCallback(() => {
    setTerminalHeight((prev) => {
      if (prev <= 40) {
        return lastExpandedTerminalHeight.current > 40 ? lastExpandedTerminalHeight.current : 210;
      }
      lastExpandedTerminalHeight.current = prev;
      return 34; // collapsed tab header
    });
  }, []);

  const openTerminal = useCallback(() => {
    setTerminalHeight((prev) => {
      if (prev <= 40) {
        return lastExpandedTerminalHeight.current > 40 ? lastExpandedTerminalHeight.current : 210;
      }
      return prev;
    });
  }, []);

  const toggleAi = useCallback(() => {
    setIsAiOpen((prev) => !prev);
  }, []);

  const openAi = useCallback(() => {
    setIsAiOpen(true);
  }, []);

  const closeAi = useCallback(() => {
    setIsAiOpen(false);
  }, []);

  const toggleAiDisplayMode = useCallback(() => {
    setAiDisplayMode((prev) => {
      if (prev === "fullscreen") {
        return previousDisplayMode === "docked" ? "popup" : "docked";
      }
      return prev === "popup" ? "docked" : "popup";
    });
  }, [previousDisplayMode]);

  const toggleAiFullscreen = useCallback(() => {
    setAiDisplayMode((prev) => {
      if (prev === "fullscreen") {
        return previousDisplayMode;
      }
      setPreviousDisplayMode(prev === "popup" ? "popup" : "docked");
      return "fullscreen";
    });
  }, [previousDisplayMode]);

  const handleBtnClick = useCallback(() => {
    if (!actionStartRef.current.hasMoved) {
      setIsAiOpen((prev) => !prev);
    }
  }, []);

  return {
    sidebarWidth,
    terminalHeight,
    aiWidth,
    isAiOpen,
    aiDisplayMode,
    btnPos,
    popupPos,
    resizing: activeAction,
    isTerminalCollapsed: terminalHeight <= 40,
    startResizingSidebar,
    startResizingTerminal,
    startResizingAi,
    startDraggingBtn,
    startDraggingPopup,
    handleBtnClick,
    toggleTerminal,
    openTerminal,
    toggleAi,
    openAi,
    closeAi,
    toggleAiDisplayMode,
    toggleAiFullscreen,
    wasJustDragged: () => actionStartRef.current.hasMoved,
  };
}
