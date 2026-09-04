import { useCallback, useEffect, useState } from "react";
import type { LanguageId, WorkspaceFile } from "@compiler-companion/shared";

function detectLanguage(filename: string): LanguageId {
  if (/\.(cpp|cc|cxx|h|hpp)$/i.test(filename)) return "cpp";
  return "python";
}

type ChromiumHandle = FileSystemDirectoryHandle & {
  queryPermission?: (desc: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: string }) => Promise<PermissionState>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

const DB_NAME = "compiler-companion-fs";
const STORE_NAME = "handles";
const KEY = "activeDirectory";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (handle) {
        store.put(handle, KEY);
      } else {
        store.delete(KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[LocalFS] Failed to persist handle in IndexedDB:", err);
  }
}

async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function useLocalFileSystem() {
  const [isSupported] = useState<boolean>(
    typeof window !== "undefined" && "showDirectoryPicker" in window,
  );
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<WorkspaceFile[]>([]);

  const loadFilesFromDirectory = useCallback(
    async (handle: FileSystemDirectoryHandle): Promise<WorkspaceFile[]> => {
      const files: WorkspaceFile[] = [];

      // FileSystemDirectoryHandle is async iterable in supported browsers
      // @ts-expect-error - entries() is standard in modern File System Access API
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === "file") {
          // Ignore hidden files / node_modules / git
          if (name.startsWith(".") || name === "node_modules" || name.endsWith(".tmp")) {
            continue;
          }

          try {
            const fileObj = await (entry as FileSystemFileHandle).getFile();
            const content = await fileObj.text();
            const language = detectLanguage(name);

            files.push({
              id: `local-${name}`,
              name,
              language,
              content,
              updatedAt: new Date(fileObj.lastModified).toISOString(),
            });
          } catch (err) {
            console.warn(`[LocalFS] Could not read file ${name}:`, err);
          }
        }
      }

      // Sort files alphabetically
      files.sort((a, b) => a.name.localeCompare(b.name));
      return files;
    },
    [],
  );

  // Auto-restore previously opened folder from IndexedDB on page load/reload
  useEffect(() => {
    let isCancelled = false;

    async function restore() {
      try {
        const stored = await getStoredHandle();
        if (!stored || isCancelled) return;

        const chromiumStored = stored as ChromiumHandle;
        const status =
          typeof chromiumStored.queryPermission === "function"
            ? await chromiumStored.queryPermission({ mode: "readwrite" })
            : "prompt";

        if (status === "granted") {
          const files = await loadFilesFromDirectory(stored);
          if (!isCancelled) {
            setDirHandle(stored);
            setFolderName(stored.name);
            setLocalFiles(files);
            try {
              localStorage.setItem("compiler-companion-mode", "local");
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.warn("[LocalFS] Could not auto-restore directory handle:", err);
      }
    }

    void restore();

    return () => {
      isCancelled = true;
    };
  }, [loadFilesFromDirectory]);

  const openFolder = useCallback(async (): Promise<{
    name: string;
    files: WorkspaceFile[];
  } | null> => {
    if (!isSupported) {
      alert(
        "Your browser does not support the File System Access API. Please use Google Chrome, Microsoft Edge, or a Chromium-based browser.",
      );
      return null;
    }

    try {
      // @ts-expect-error - showDirectoryPicker is standard in modern Chromium browsers
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });

      setDirHandle(handle);
      setFolderName(handle.name);

      const files = await loadFilesFromDirectory(handle);

      // If directory is empty, create a starter file
      if (files.length === 0) {
        const starterName = "main.py";
        const starterContent = "# Your Python Program\nprint('Hello from local folder!')\n";
        const fileHandle = await handle.getFileHandle(starterName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(starterContent);
        await writable.close();

        const starterFile: WorkspaceFile = {
          id: `local-${starterName}`,
          name: starterName,
          language: "python",
          content: starterContent,
          updatedAt: new Date().toISOString(),
        };
        files.push(starterFile);
      }

      setLocalFiles(files);
      await storeHandle(handle);
      try {
        localStorage.setItem("compiler-companion-mode", "local");
      } catch {
        // Ignore
      }
      return { name: handle.name, files };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // User cancelled folder picker
        return null;
      }
      console.error("[LocalFS] Error opening folder:", error);
      throw error;
    }
  }, [isSupported, loadFilesFromDirectory]);

  const saveLocalFile = useCallback(
    async (filename: string, content: string): Promise<WorkspaceFile | null> => {
      if (!dirHandle) return null;

      try {
        // Verify write permissions
        const chromiumDir = dirHandle as ChromiumHandle;
        if (typeof chromiumDir.queryPermission === "function") {
          const status = await chromiumDir.queryPermission({ mode: "readwrite" });
          if (status !== "granted") {
            if (typeof chromiumDir.requestPermission === "function") {
              const req = await chromiumDir.requestPermission({ mode: "readwrite" });
              if (req !== "granted") {
                throw new Error("Write permission to local folder was denied.");
              }
            }
          }
        }

        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        const updatedFile: WorkspaceFile = {
          id: `local-${filename}`,
          name: filename,
          language: detectLanguage(filename),
          content,
          updatedAt: new Date().toISOString(),
        };

        setLocalFiles((prev) => {
          const index = prev.findIndex((f) => f.name === filename);
          if (index !== -1) {
            const next = [...prev];
            next[index] = updatedFile;
            return next;
          }
          return [...prev, updatedFile];
        });

        return updatedFile;
      } catch (error) {
        console.error(`[LocalFS] Error saving file ${filename}:`, error);
        throw error;
      }
    },
    [dirHandle],
  );

  const createLocalFile = useCallback(
    async (filename: string, initialContent = ""): Promise<WorkspaceFile | null> => {
      if (!dirHandle) return null;

      try {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const defaultContent =
          initialContent ||
          (detectLanguage(filename) === "python"
            ? "# " + filename + "\n"
            : '#include <iostream>\n\nint main() {\n  std::cout << "Hello from ' +
              filename +
              '!\\n";\n  return 0;\n}\n');

        const writable = await fileHandle.createWritable();
        await writable.write(defaultContent);
        await writable.close();

        const newFile: WorkspaceFile = {
          id: `local-${filename}`,
          name: filename,
          language: detectLanguage(filename),
          content: defaultContent,
          updatedAt: new Date().toISOString(),
        };

        setLocalFiles((prev) =>
          [...prev.filter((f) => f.name !== filename), newFile].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        return newFile;
      } catch (error) {
        console.error(`[LocalFS] Error creating file ${filename}:`, error);
        throw error;
      }
    },
    [dirHandle],
  );

  const deleteLocalFile = useCallback(
    async (filename: string): Promise<boolean> => {
      if (!dirHandle) return false;

      try {
        await dirHandle.removeEntry(filename);
        setLocalFiles((prev) => prev.filter((f) => f.name !== filename));
        return true;
      } catch (error) {
        console.error(`[LocalFS] Error deleting file ${filename}:`, error);
        return false;
      }
    },
    [dirHandle],
  );

  const closeFolder = useCallback(() => {
    setDirHandle(null);
    setFolderName(null);
    setLocalFiles([]);
    void storeHandle(null);
    try {
      localStorage.removeItem("compiler-companion-mode");
    } catch {
      // Ignore
    }
  }, []);

  return {
    isSupported,
    isLocalMode: !!dirHandle,
    folderName,
    localFiles,
    openFolder,
    saveLocalFile,
    createLocalFile,
    deleteLocalFile,
    closeFolder,
  };
}
