import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Send, Loader2, Code2, Eye, FileCode2, Sparkles, Copy, CheckCheck, Download } from "lucide-react";
import { toast } from "sonner";

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
    <div className="my-3 rounded-xl overflow-hidden border border-[var(--border)] bg-black/60">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-black/40">
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

const MessageBlock = ({ msg }) => {
  const parts = parseContent(msg.content);
  const isUser = msg.role === "user";
  return (
    <div data-testid={`msg-${msg.role}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] ${isUser ? "rounded-2xl rounded-br-md bg-[var(--brand)]/12 border border-[var(--brand)]/25 px-4 py-3" : "glass rounded-2xl rounded-bl-md px-4 py-3"}`}>
        <div className={`overline mb-1.5 ${isUser ? "!text-[var(--brand-hover)]" : ""}`}>{isUser ? "you" : "forge"}</div>
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">
          {parts.map((p, i) =>
            p.type === "text" ? <span key={i}>{p.value}</span> : <CodeFence key={i} block={p} />
          )}
        </div>
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
  const scrollRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject(data.project);
      setMessages(data.messages);
    } catch {
      toast.error("Project not found");
      navigate("/dashboard");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    const userTmp = { message_id: "tmp-u", role: "user", content: text, created_at: new Date().toISOString() };
    const aiTmp = { message_id: "tmp-a", role: "assistant", content: "", created_at: new Date().toISOString() };
    setMessages((m) => [...m, userTmp, aiTmp]);

    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${id}/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
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
        // Parse SSE events separated by \n\n
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
          } else if (type === "done") {
            setMessages((m) => m.map((x) => {
              if (x.message_id === "tmp-u") return { ...userTmp, message_id: "done-u" };
              if (x.message_id === "tmp-a") return parsed.message;
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

  const previewSrcDoc = (() => {
    const html = allCodeBlocks.find((b) => (b.file || "").match(/\.html$/i) || b.lang === "html");
    if (html) return html.value;
    const jsx = allCodeBlocks.find((b) => b.lang === "jsx" || b.lang === "tsx" || (b.file || "").match(/\.(j|t)sx?$/i));
    if (jsx) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><script src="https://cdn.tailwindcss.com"></script><style>body{font-family:ui-sans-serif,system-ui;padding:1rem;background:#fafafa}</style></head><body><div id="root"></div><script type="text/babel">
try {
${jsx.value.replace(/^(import|export).*$/gm, "")}
const _Root = typeof App !== 'undefined' ? App : (typeof Component !== 'undefined' ? Component : () => <div style={{padding:20,fontFamily:'ui-monospace'}}>No default component detected.</div>);
ReactDOM.createRoot(document.getElementById('root')).render(<_Root />);
} catch (e) { document.getElementById('root').innerHTML = '<pre style="color:#c00;padding:1rem;font-family:ui-monospace">'+e.message+'</pre>'; }
</script></body></html>`;
    }
    return `<!DOCTYPE html><html><body style="font-family:'IBM Plex Mono',monospace;background:#050505;color:#A19E98;padding:3rem;margin:0;height:100vh;display:flex;align-items:center;justify-content:center"><div style="max-width:420px"><div style="color:#F25C05;font-size:.7rem;letter-spacing:.22em;text-transform:uppercase">// preview idle</div><div style="margin-top:.75rem;font-size:1.8rem;font-family:'Playfair Display',serif;font-style:italic;color:#F2E8D5">Awaiting your instruction.</div><div style="margin-top:.75rem;font-size:.9rem">Describe what you want to build in the chat — the preview will render here.</div></div></body></html>`;
  })();

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <div className="glass rounded-2xl px-8 py-6 mono text-sm text-[var(--text-2)]">Loading<span className="caret"></span></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#050505]">
      {/* Floating project header */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#050505]/80 backdrop-blur-xl">
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
            <span className="chip chip-emerald pulse-dot hidden sm:inline-flex">active</span>
            <span className="chip hidden md:inline-flex">claude sonnet 4.5</span>
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
          </div>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "minmax(380px, 1fr) minmax(420px, 1.35fr)" }}>
        {/* Left: Chat */}
        <div className="flex flex-col overflow-hidden border-r border-[var(--border)] bg-[#070707]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6" data-testid="chat-scroll">
            {messages.length === 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="overline">start the conversation</div>
                <div className="serif mt-3 text-2xl italic-serif">Tell Forge what to build.</div>
                <div className="mt-2 text-sm text-[var(--text-2)]">Be specific or vague — we&apos;re fluent in both.</div>
              </div>
            )}
            {messages.map((m, i) => <MessageBlock key={m.message_id || i} msg={m} />)}
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
          <form onSubmit={send} className="border-t border-[var(--border)] p-4 bg-[#0A0A0A]" data-testid="chat-form">
            <div className="glass rounded-2xl p-2 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Describe changes, features, fixes..."
                rows={2}
                data-testid="chat-input"
                className="flex-1 bg-transparent border-0 outline-none resize-none px-3 py-2 text-[15px] placeholder:text-[var(--text-3)]"
              />
              <button type="submit" disabled={sending || !input.trim()} data-testid="send-btn" className="btn btn-primary !rounded-xl self-stretch !px-4">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
          </form>
        </div>

        {/* Right: IDE / Preview */}
        <div className="flex flex-col overflow-hidden bg-[#050505]">
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
              <div className="flex-1 overflow-auto">
                {active ? (
                  <div className="flex">
                    <div className="shrink-0 text-right select-none border-r border-[var(--border)] bg-black/20 px-3 py-5 mono text-xs line-numbers">
                      {active.value.split("\n").map((_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
                    </div>
                    <pre className="flex-1 px-5 py-5 text-xs leading-6 text-[var(--text)]"><code>{active.value}</code></pre>
                  </div>
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
            <div className="flex-1 p-3 bg-black/40">
              <iframe
                data-testid="preview-iframe"
                srcDoc={previewSrcDoc}
                className="h-full w-full rounded-xl border border-[var(--border)] bg-white"
                title="preview"
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
