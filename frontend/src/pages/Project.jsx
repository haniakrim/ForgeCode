import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Send, Loader2, Code2, Eye, FileCode2, Sparkles, Copy, CheckCheck, Download, Share2, WifiOff, Activity, NotebookPen, Hammer, Bot, ClipboardCheck, Brain, X, History, Users2 } from "lucide-react";
import { DeployMenu } from "../components/DeployMenu";
import { HistoryDialog } from "../components/HistoryDialog";
import { toast } from "sonner";
import { ShareDialog } from "../components/ShareDialog";
import { SandpackPreview } from "../components/SandpackPreview";
import { ActivityDialog } from "../components/ActivityDialog";
import { MonacoYjsEditor } from "../components/MonacoYjsEditor";

// ------------- Code block parser -------------
const parseContent = (text) => {
  const parts = [];
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });
    parts.push({ type: "code", lang: m[1] || "text", file: m[2] || null, value: m[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
};

const CodeFence = ({ block }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 mono text-xs text-[var(--text-2)]">
          <FileCode2 className="h-3 w-3 text-[var(--brand)]" strokeWidth={1.5} />
          {block.file || block.lang}
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(block.value); setCopied(true); setTimeout(() => setCopied(false), 1200); toast.success("Copied"); }}
          className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[var(--text-3)] hover:text-[var(--text)]"
        >
          {copied ? <CheckCheck className="h-3 w-3 text-[var(--emerald)]" /> : <Copy className="h-3 w-3" />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed text-[var(--text)]"><code>{block.value}</code></pre>
    </div>
  );
};

const MODE_META = {
  plan:  { label: "plan",  color: "text-[var(--gold)]",    bg: "bg-[var(--gold)]/8 border-[var(--gold)]/25" },
  build: { label: "build", color: "text-[var(--emerald)]", bg: "bg-[var(--emerald)]/8 border-[var(--emerald)]/25" },
  agent: { label: "agent", color: "text-[var(--brand)]",   bg: "bg-[var(--brand)]/8 border-[var(--brand)]/25" },
  multi: { label: "multi-agent", color: "text-white",      bg: "bg-white/8 border-white/20" },
};

const MessageBlock = ({ msg, onApprove }) => {
  const parts = parseContent(msg.content);
  const isUser = msg.role === "user";
  const meta = !isUser && msg.mode ? MODE_META[msg.mode] : null;
  const showApprove = !isUser && msg.mode === "plan" && msg.content && !msg.content.startsWith("[FORGE");
  return (
    <div data-testid={`msg-${msg.role}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] ${isUser ? "rounded-2xl rounded-br-md bg-[var(--brand)]/12 border border-[var(--brand)]/25 px-4 py-3" : "glass rounded-2xl rounded-bl-md px-4 py-3"}`}>
        <div className={`overline mb-1.5 flex items-center gap-2 ${isUser ? "!text-[var(--brand-hover)]" : ""}`}>
          <span>{isUser ? "you" : "forge"}</span>
          {meta && (
            <span data-testid={`mode-badge-${msg.mode}`} className={`px-1.5 py-[1px] rounded-full border text-[9px] uppercase tracking-widest ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          )}
        </div>
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">
          {parts.map((p, i) =>
            p.type === "text" ? <span key={i}>{p.value}</span> : <CodeFence key={i} block={p} />
          )}
        </div>
        {showApprove && (
          <button
            data-testid="approve-build-btn"
            onClick={() => onApprove?.(msg)}
            className="btn btn-primary mt-3 !py-1.5 !px-3 !text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Approve &amp; build
          </button>
        )}
      </div>
    </div>
  );
};

export default function Project() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState("code");
  const [shareOpen, setShareOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [presence, setPresence] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // user_id -> name
  const [wsConnected, setWsConnected] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
  const [mode, setMode] = useState("build"); // "plan" | "build" | "agent"
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryDoc, setMemoryDoc] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const typingDebounceRef = useRef(null);

  const isViewer = project?.role === "collaborator" && project?.member_role === "viewer";
  const isOwner = project?.role === "owner";

  const load = async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject(data.project);
      setMessages(data.messages);
      setMembers(data.members || []);
    } catch {
      toast.error("Project not found");
      navigate("/dashboard");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // Fetch user's active model label for the toolbar chip
  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([api.get("/settings"), api.get("/models")]);
        const mm = (m.data || []).find((x) => x.id === s.data.model_id);
        if (mm) setModelLabel(mm.label.toLowerCase());
      } catch { /* leave empty */ }
    })();
  }, []);

  // WebSocket: presence + typing + real-time broadcasts + auto-reconnect w/ backoff
  useEffect(() => {
    if (!id || !user) return;
    const backend = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = backend.replace(/^http/, "ws") + `/api/ws/projects/${id}`;
    let pingInterval, reconnectTimer;
    let attempt = 0;
    let closedByUs = false;
    let currentWs = null;

    const connect = () => {
      const socket = new WebSocket(wsUrl);
      currentWs = socket;
      wsRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setWsConnected(true);
        pingInterval = setInterval(() => {
          try { socket.send(JSON.stringify({ type: "ping" })); } catch {/* closed */}
        }, 30000);
      };
      socket.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === "error") { closedByUs = true; socket.close(); return; }
          if (m.type === "presence") setPresence(m.users || []);
          else if (m.type === "typing") {
            setTypingUsers((prev) => {
              const next = { ...prev };
              if (m.is_typing) next[m.user_id] = m.name; else delete next[m.user_id];
              return next;
            });
          } else if (m.type === "message") {
            setMessages((list) => list.find((x) => x.message_id === m.message.message_id) ? list : [...list, m.message]);
          }
        } catch {/* ignore malformed */}
      };
      socket.onclose = () => {
        clearInterval(pingInterval);
        setWsConnected(false);
        if (closedByUs) return;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => { try { socket.close(); } catch {/* closed */} };
    };

    connect();

    return () => {
      closedByUs = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer);
      try { currentWs?.close(); } catch {/* closed */}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.user_id]);

  const sendTyping = (isTyping) => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
    } catch {/* not connected */}
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    sendTyping(true);
    typingDebounceRef.current = setTimeout(() => sendTyping(false), 2500);
  };

  const send = async (e, opts = {}) => {
    e?.preventDefault?.();
    const override = opts.content;
    const overrideMode = opts.mode;
    const text = (override ?? input).trim();
    const activeMode = overrideMode || mode;
    if (!text || sending) return;
    if (!override) setInput("");
    setSending(true);
    const userTmp = { message_id: "tmp-u", role: "user", content: text, created_at: new Date().toISOString() };
    const aiTmp = { message_id: "tmp-a", role: "assistant", content: "", created_at: new Date().toISOString(), mode: activeMode };
    setMessages((m) => [...m, userTmp, aiTmp]);

    try {
      const endpoint = activeMode === "multi"
        ? `/api/projects/${id}/multi-agent/stream`
        : `/api/projects/${id}/chat/stream`;
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, mode: activeMode === "multi" ? "build" : activeMode }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Chat failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const lines = ev.split("\n");
          let type = "message";
          let data = "";
          for (const l of lines) {
            if (l.startsWith("event:")) type = l.slice(6).trim();
            else if (l.startsWith("data:")) data += l.slice(5).trim();
          }
          if (!data) continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (type === "token") {
            streamed += parsed.t ?? "";
            setMessages((m) => m.map((x) => x.message_id === "tmp-a" ? { ...x, content: streamed } : x));
          } else if (type === "tool_result") {
            // Agent mode: append a compact tool trace line to the message
            const line = `\n\n<tool ran="${parsed.tool?.name}" path="${parsed.tool?.path || ''}">${parsed.result?.ok ? 'ok' : (parsed.result?.error || 'failed')}</tool>`;
            streamed += line;
            setMessages((m) => m.map((x) => x.message_id === "tmp-a" ? { ...x, content: streamed } : x));
          } else if (type === "phase_start") {
            // Multi-agent: phase transition marker
            const banner = `\n\n### ▸ ${parsed.phase} phase\n`;
            streamed += banner;
            setMessages((m) => m.map((x) => x.message_id === "tmp-a" ? { ...x, content: streamed } : x));
          } else if (type === "phase_end") {
            /* no-op — phase_start already marks the transition */
          } else if (type === "done") {
            setMessages((m) => m.map((x) => {
              if (x.message_id === "tmp-u") return { ...userTmp, message_id: "done-u" };
              if (x.message_id === "tmp-a") return { ...parsed.message, mode: activeMode };
              return x;
            }));
            refresh();
          }
        }
      }
    } catch (err) {
      toast.error(err.message || "Chat failed");
      setMessages((m) => m.filter((x) => x.message_id !== "tmp-u" && x.message_id !== "tmp-a"));
    } finally {
      setSending(false);
    }
  };

  const approveAndBuild = (planMsg) => {
    send(null, {
      content: `Approve the plan above and build it now.\n\nFor reference, here was your plan:\n${(planMsg.content || "").slice(0, 3500)}`,
      mode: "build",
    });
  };

  const runReview = async () => {
    setReviewBusy(true); setReviewOpen(true); setReviewText("");
    try {
      const r = await api.post(`/projects/${id}/review`);
      setReviewText(r.data.review || "(no review returned)");
      refresh();
    } catch (err) {
      setReviewText(`**Review failed.** ${err?.response?.data?.detail || err.message}`);
    } finally { setReviewBusy(false); }
  };

  const openMemory = async () => {
    setMemoryOpen(true);
    try {
      const r = await api.get(`/projects/${id}/memory`);
      setMemoryDoc(r.data.content || "");
    } catch {
      setMemoryDoc("(failed to load memory)");
    }
  };

  const downloadZip = async () => {
    try {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/projects/${id}/export`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const cd = resp.headers.get("content-disposition") || "";
      const fn = /filename="?([^"]+)"?/.exec(cd)?.[1] || "forge-project.zip";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fn;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Exported");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const allCodeBlocks = messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => parseContent(m.content).filter((p) => p.type === "code"));

  const [activeFile, setActiveFile] = useState(0);
  useEffect(() => { setActiveFile(Math.max(0, allCodeBlocks.length - 1)); }, [allCodeBlocks.length]);
  const active = allCodeBlocks[activeFile];

  const previewSrcDoc = null; // replaced by SandpackPreview

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="glass rounded-2xl px-8 py-6 mono text-sm text-[var(--text-2)]">Loading<span className="caret"></span></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">
      {/* Floating project header */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-full items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/dashboard" className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]/40 transition-colors" data-testid="back-btn">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
            <div className="min-w-0">
              <div className="overline !text-[var(--text-3)]">composition</div>
              <div className="serif text-xl truncate" style={{ fontWeight: 500 }}>{project.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live presence avatars */}
            {presence.length > 1 && (
              <div className="flex items-center -space-x-2 mr-1" data-testid="presence-avatars">
                {presence.slice(0, 4).map((p) => (
                  <div
                    key={p.user_id}
                    title={`${p.name} · ${p.role}`}
                    className="relative h-6 w-6 rounded-full border-2 border-[var(--bg)] bg-gradient-to-br from-[var(--brand)] to-[var(--gold)] flex items-center justify-center text-[10px] text-white font-bold overflow-hidden"
                  >
                    {p.picture ? (
                      <img src={p.picture} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      (p.name || p.email)[0]?.toUpperCase()
                    )}
                  </div>
                ))}
                {presence.length > 4 && (
                  <div className="h-6 w-6 rounded-full border-2 border-[var(--bg)] bg-[var(--surface)] flex items-center justify-center text-[10px] text-[var(--text-2)]">
                    +{presence.length - 4}
                  </div>
                )}
                <span className="chip chip-emerald !py-0.5 ml-2 pulse-dot">{presence.length} live</span>
              </div>
            )}
            {isViewer && <span className="chip">viewer</span>}
            <span
              className={`chip ${wsConnected ? "chip-emerald pulse-dot" : ""} hidden sm:inline-flex`}
              title={wsConnected ? "Live" : "Reconnecting…"}
              data-testid="ws-status"
            >
              {wsConnected ? "live" : (
                <><WifiOff className="h-3 w-3 mr-1" strokeWidth={2} /> offline</>
              )}
            </span>
            <span className="chip hidden md:inline-flex" data-testid="current-model-chip">{modelLabel || "AI engine"}</span>
            <div className="chip">
              <Sparkles className="h-3 w-3 text-[var(--brand)]" strokeWidth={1.5} />
              {user?.credits} credits
            </div>
            <button
              onClick={downloadZip}
              data-testid="export-btn"
              className="btn btn-ghost !py-1.5 !px-3 !text-xs"
              title="Download project as ZIP"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden md:inline">Export</span>
            </button>
            <DeployMenu projectId={id} />
            <button
              onClick={runReview}
              data-testid="review-btn"
              className="btn btn-ghost !py-1.5 !px-3 !text-xs"
              title="Self-critique review"
            >
              <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden md:inline">Review</span>
            </button>
            <button
              onClick={openMemory}
              data-testid="memory-btn"
              className="btn btn-ghost !py-1.5 !px-3 !text-xs"
              title="Project memory"
            >
              <Brain className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden md:inline">Memory</span>
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              data-testid="history-btn"
              className="btn btn-ghost !py-1.5 !px-3 !text-xs"
              title="File history & rollback"
            >
              <History className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden md:inline">History</span>
            </button>
            {isOwner && (
              <button
                onClick={() => setActivityOpen(true)}
                data-testid="activity-btn"
                className="btn btn-ghost !py-1.5 !px-3 !text-xs"
                title="Activity log"
              >
                <Activity className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden md:inline">Activity</span>
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShareOpen(true)}
                data-testid="share-btn"
                className="btn btn-primary !py-1.5 !px-3 !text-xs"
                title="Share"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden md:inline">Share</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "minmax(380px, 1fr) minmax(420px, 1.35fr)" }}>
        {/* Left: Chat */}
        <div className="flex flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface-2)]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6" data-testid="chat-scroll">
            {messages.length === 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="overline">start the conversation</div>
                <div className="serif mt-3 text-2xl italic-serif">Tell Forge what to build.</div>
                <div className="mt-2 text-sm text-[var(--text-2)]">Be specific or vague — we&apos;re fluent in both.</div>
              </div>
            )}
            {messages.map((m, i) => <MessageBlock key={m.message_id || i} msg={m} onApprove={approveAndBuild} />)}
            {sending && (
              <div className="flex justify-start">
                <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="overline mb-1.5">forge</div>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" strokeWidth={1.8} />
                    <span className="italic-serif">composing<span className="caret"></span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={send} className="border-t border-[var(--border)] p-4 bg-[var(--surface)]" data-testid="chat-form">
            {Object.keys(typingUsers).length > 0 && (
              <div className="flex items-center gap-2 mb-2 px-1 text-xs text-[var(--text-2)] italic-serif" data-testid="typing-indicator">
                <span className="inline-flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-[var(--brand)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1 w-1 rounded-full bg-[var(--brand)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1 w-1 rounded-full bg-[var(--brand)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing…
              </div>
            )}
            <div className="glass rounded-2xl p-2 flex items-end gap-2">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={
                  isViewer ? "Viewers are read-only."
                  : mode === "plan"  ? "Describe the feature — I'll return a plan for you to approve."
                  : mode === "agent" ? "Describe the task — I'll read & write files autonomously."
                  : mode === "multi" ? "Planner → Coder → Reviewer will each take a pass (3 credits)."
                  : "Describe changes, features, fixes..."
                }
                rows={2}
                disabled={isViewer}
                data-testid="chat-input"
                className="flex-1 bg-transparent border-0 outline-none resize-none px-3 py-2 text-[15px] placeholder:text-[var(--text-3)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button type="submit" disabled={sending || !input.trim() || isViewer} data-testid="send-btn" className="btn btn-primary !rounded-xl self-stretch !px-4">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
            {/* Mode selector — Plan · Build · Agent */}
            <div className="mt-2 flex items-center gap-1" data-testid="mode-selector">
              {[
                { id: "plan",  label: "Plan",  Icon: NotebookPen,   desc: "Plan only — you approve before building." },
                { id: "build", label: "Build", Icon: Hammer,        desc: "Generate code directly (default)." },
                { id: "agent", label: "Agent", Icon: Bot,           desc: "Autonomous: reads & writes files in a loop." },
                { id: "multi", label: "Multi", Icon: Users2,        desc: "Planner → Coder → Reviewer relay (3 credits)." },
              ].map(({ id, label, Icon, desc }) => {
                const active = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`mode-${id}`}
                    title={desc}
                    onClick={() => setMode(id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--text-3)]"
                    }`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.8} />
                    {label}
                  </button>
                );
              })}
              <span className="ml-auto text-[10px] text-[var(--text-3)] mono">
                {mode === "plan" && "→ plan-first"}
                {mode === "build" && "→ direct build"}
                {mode === "agent" && "→ autonomous · max 5 rounds"}
                {mode === "multi" && "→ planner → coder → reviewer"}
              </span>
            </div>
          </form>
        </div>

        {/* Right: IDE / Preview */}
        <div className="flex flex-col overflow-hidden bg-[var(--ide-bg)]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-black/40">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTab("code")}
                data-testid="tab-code"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest border-b-2 transition-colors ${tab === "code" ? "border-[var(--brand)] text-[var(--text)]" : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"}`}
              >
                <Code2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Code
              </button>
              <button
                onClick={() => setTab("preview")}
                data-testid="tab-preview"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest border-b-2 transition-colors ${tab === "preview" ? "border-[var(--brand)] text-[var(--text)]" : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"}`}
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.8} /> Preview
              </button>
            </div>
            <div className="mono text-xs text-[var(--text-3)]">{allCodeBlocks.length} files generated</div>
          </div>

          {tab === "code" ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-60 shrink-0 border-r border-[var(--border)] bg-black/30 overflow-y-auto">
                <div className="overline p-4 !text-[var(--text-3)]">files</div>
                {allCodeBlocks.length === 0 ? (
                  <div className="px-4 pb-4 text-xs text-[var(--text-3)] italic-serif">No files yet — start chatting.</div>
                ) : (
                  allCodeBlocks.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveFile(i)}
                      data-testid={`file-${i}`}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs mono truncate border-l-2 transition-colors ${i === activeFile ? "border-[var(--brand)] bg-black/50 text-[var(--text)]" : "border-transparent text-[var(--text-2)] hover:bg-black/20"}`}
                    >
                      <FileCode2 className="h-3 w-3 shrink-0 text-[var(--brand)]" strokeWidth={1.5} />
                      <span className="truncate">{b.file || `${b.lang}-${i + 1}`}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {active ? (
                  <MonacoYjsEditor
                    projectId={id}
                    filePath={active.file || `${active.lang}-${activeFile + 1}`}
                    initialContent={active.value}
                    readOnly={isViewer}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full p-10">
                    <div className="max-w-sm text-center">
                      <div className="overline">idle</div>
                      <div className="serif mt-3 text-3xl italic-serif">Awaiting instructions</div>
                      <div className="mt-3 text-sm text-[var(--text-2)]">Describe your app in the chat. Forge will stream code into this pane.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-[var(--ide-bg)] overflow-hidden">
              <SandpackPreview codeBlocks={allCodeBlocks} />
            </div>
          )}
        </div>
      </div>

      {shareOpen && project && (
        <ShareDialog
          project={project}
          members={members}
          onClose={() => setShareOpen(false)}
          onUpdate={(updated) => setProject((p) => ({ ...p, ...updated }))}
        />
      )}
      {activityOpen && project && (
        <ActivityDialog projectId={id} onClose={() => setActivityOpen(false)} />
      )}
      {reviewOpen && (
        <DrawerDialog
          title="Code review"
          subtitle="Principal-level critique of the project so far"
          onClose={() => setReviewOpen(false)}
          testid="review-dialog"
        >
          {reviewBusy ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" strokeWidth={1.8} />
              <span className="italic-serif">reviewing…</span>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap leading-relaxed" data-testid="review-body">
              {reviewText || "(no review returned)"}
            </div>
          )}
        </DrawerDialog>
      )}
      {memoryOpen && (
        <DrawerDialog
          title="Project memory"
          subtitle="What Forge remembers across turns"
          onClose={() => setMemoryOpen(false)}
          testid="memory-dialog"
        >
          {memoryDoc ? (
            <pre className="text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-2)] font-mono" data-testid="memory-body">{memoryDoc}</pre>
          ) : (
            <div className="text-sm text-[var(--text-3)] italic-serif">
              Memory is empty — it fills in automatically as you build. Or use the API to set it manually.
            </div>
          )}
        </DrawerDialog>
      )}
      {historyOpen && (
        <HistoryDialog projectId={id} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

/* ---------- inline drawer/dialog used by Review + Memory ---------- */
function DrawerDialog({ title, subtitle, onClose, testid, children }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      data-testid={testid}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] h-full bg-[var(--bg)] border-l border-[var(--border)] overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl">
          <div>
            <div className="overline !text-[var(--text-3)]">{subtitle}</div>
            <div className="serif text-2xl mt-1" style={{ fontWeight: 500 }}>{title}</div>
          </div>
          <button
            onClick={onClose}
            data-testid={`${testid}-close`}
            className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]/40 transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
