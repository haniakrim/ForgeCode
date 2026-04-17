import { useEffect, useRef, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import { Save, CheckCheck, Users } from "lucide-react";
import { toast } from "sonner";

const languageFor = (path) => {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".jsx")) return "javascript";
  if (p.endsWith(".tsx")) return "typescript";
  if (p.endsWith(".ts")) return "typescript";
  if (p.endsWith(".js")) return "javascript";
  if (p.endsWith(".css")) return "css";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".html")) return "html";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".py")) return "python";
  return "plaintext";
};

export const MonacoYjsEditor = ({ projectId, filePath, initialContent, readOnly = false, onSaved }) => {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const [status, setStatus] = useState("connecting"); // connecting | connected | offline | saved
  const [peers, setPeers] = useState(0);
  const saveTimerRef = useRef(null);

  const save = useCallback(async () => {
    if (readOnly) return;
    try {
      const content = editorRef.current?.getValue() ?? "";
      await api.put(`/projects/${projectId}/files`, { path: filePath, content });
      setStatus("saved");
      onSaved?.(content);
    } catch {
      toast.error("Save failed");
    }
  }, [projectId, filePath, readOnly, onSaved]);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;

    const backend = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = backend.replace(/^http/, "ws") + "/api/ws/yjs";
    const ydoc = new Y.Doc();
    const room = `${projectId}:${filePath}`;

    // y-websocket needs a base URL + room name. It will form `${wsUrl}/${room}`.
    const provider = new WebsocketProvider(wsUrl, encodeURIComponent(`${projectId}/${filePath}`), ydoc, {
      connect: true,
      resyncInterval: 5000,
    });

    provider.on("status", (e) => {
      if (e.status === "connected") setStatus("connected");
      else if (e.status === "disconnected") setStatus("offline");
    });

    // Awareness: peer counter
    provider.awareness.setLocalStateField("user", { name: "you" });
    const updatePeers = () => setPeers(provider.awareness.getStates().size);
    provider.awareness.on("change", updatePeers);
    updatePeers();

    const ytext = ydoc.getText("content");
    // Seed initial content immediately (before sync) so the editor renders.
    // With our minimal relay, the first client's seed becomes the canonical doc.
    if (ytext.length === 0 && initialContent) {
      ytext.insert(0, initialContent);
    }

    const binding = new MonacoBinding(ytext, editor.getModel(), new Set([editor]), provider.awareness);

    // Autosave on change (debounced)
    const model = editor.getModel();
    const disposer = model.onDidChangeContent(() => {
      if (readOnly) return;
      setStatus("editing");
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(save, 1500);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);

    // Cleanup
    editor._forgeCleanup = () => {
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
      disposer.dispose();
    };
  };

  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      editorRef.current?._forgeCleanup?.();
    };
  }, [filePath]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-black/40 text-[10px] mono text-[var(--text-3)]">
        <div className="flex items-center gap-3">
          <span className="uppercase tracking-widest">{filePath}</span>
          {peers > 1 && (
            <span className="inline-flex items-center gap-1 text-[var(--emerald)]">
              <Users className="h-3 w-3" strokeWidth={1.8} /> {peers} editing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" && <span className="text-[var(--emerald)]">● live</span>}
          {status === "offline" && <span className="text-[var(--brand)]">● offline</span>}
          {status === "connecting" && <span>connecting…</span>}
          {status === "editing" && <span className="text-[var(--gold)]">● unsaved</span>}
          {status === "saved" && <span className="text-[var(--emerald)] inline-flex items-center gap-1"><CheckCheck className="h-3 w-3" strokeWidth={2} /> saved</span>}
          {!readOnly && (
            <button onClick={save} title="Save (⌘S)" className="inline-flex items-center gap-1 text-[var(--text-2)] hover:text-[var(--text)]" data-testid="save-file-btn">
              <Save className="h-3 w-3" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={languageFor(filePath)}
          defaultValue={initialContent}
          theme={theme === "daylight" ? "vs" : "vs-dark"}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontSize: 12.5,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>
    </div>
  );
};
