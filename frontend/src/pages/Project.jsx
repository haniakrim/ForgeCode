import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Send, Loader2, Code2, Eye, FileCode2, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";

// ------------- Code block renderer -------------
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

const MessageBlock = ({ msg }) => {
  const parts = parseContent(msg.content);
  const isUser = msg.role === "user";
  return (
    <div
      data-testid={`msg-${msg.role}`}
      className={
        isUser
          ? "ml-10 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#0A0A0A]"
          : "mr-10 border-2 border-black border-l-8 border-l-[#FF3311] bg-[#F4F4F0] p-4"
      }
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF3311]">
        {isUser ? "// you" : "// forge"}
      </div>
      <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.type === "text" ? (
            <span key={i}>{p.value}</span>
          ) : (
            <div key={i} className="my-2 border-2 border-black bg-[#0A0A0A] text-[#E0E0E0]">
              <div className="flex items-center justify-between border-b-2 border-[#333] bg-[#141414] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#999]">
                <span className="flex items-center gap-2">
                  <FileCode2 className="h-3 w-3" strokeWidth={3} />
                  {p.file || p.lang}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(p.value); toast.success("Copied"); }}
                  className="border border-[#555] px-2 py-0.5 text-[9px] hover:bg-[#FF3311] hover:text-white hover:border-[#FF3311]"
                >
                  copy
                </button>
              </div>
              <pre className="overflow-x-auto p-3 text-xs"><code>{p.value}</code></pre>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default function Project() {
  const { id } = useParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState("code"); // 'code' | 'preview'
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    // optimistic
    setMessages((m) => [...m, { message_id: "tmp", role: "user", content: text, created_at: new Date().toISOString() }]);
    try {
      const { data } = await api.post(`/projects/${id}/chat`, { content: text });
      setMessages((m) => [...m.filter((x) => x.message_id !== "tmp"), { role: "user", content: text, created_at: new Date().toISOString() }, data.message]);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Chat failed");
      setMessages((m) => m.filter((x) => x.message_id !== "tmp"));
    } finally {
      setSending(false);
    }
  };

  // Extract latest code blocks for IDE pane
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
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><script src="https://cdn.tailwindcss.com"></script><style>body{font-family:ui-sans-serif,system-ui;padding:1rem}</style></head><body><div id="root"></div><script type="text/babel">
try {
${jsx.value.replace(/^(import|export).*$/gm, "")}
const _Root = typeof App !== 'undefined' ? App : (typeof Component !== 'undefined' ? Component : () => <div style={{padding:20,fontFamily:'monospace'}}>No default component detected.</div>);
ReactDOM.createRoot(document.getElementById('root')).render(<_Root />);
} catch (e) { document.getElementById('root').innerHTML = '<pre style="color:#c00;padding:1rem;font-family:monospace">'+e.message+'</pre>'; }
</script></body></html>`;
    }
    return `<!DOCTYPE html><html><body style="font-family:JetBrains Mono, monospace;background:#0A0A0A;color:#E0E0E0;padding:2rem;margin:0"><div style="border:2px solid #FF3311;padding:1.5rem"><div style="color:#FF3311;font-weight:900;letter-spacing:.2em;font-size:.7rem;text-transform:uppercase">// preview idle</div><div style="margin-top:.5rem;font-size:1.3rem;font-weight:900">Start chatting to see your app here.</div></div></body></html>`;
  })();

  if (!project) {
    return (
      <div>
        <Navbar />
        <div className="p-10 font-mono text-sm">Loading<span className="caret"></span></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="flex items-center justify-between border-b-2 border-black bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="border-2 border-black bg-white p-1.5 hover:bg-black hover:text-white" data-testid="back-btn">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={3} />
          </Link>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">// project</div>
            <div className="text-lg font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{project.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <span className="tag-chip bg-[#00AA00] text-white">● active</span>
          <span className="tag-chip">claude sonnet 4.5</span>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "minmax(360px, 1fr) minmax(400px, 1.4fr)" }}>
        {/* Left: Chat */}
        <div className="flex flex-col overflow-hidden border-r-2 border-black bg-[#F4F4F0]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6" data-testid="chat-scroll">
            {messages.length === 0 && (
              <div className="border-2 border-dashed border-black bg-white p-6 text-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF3311]">// start the conversation</div>
                <div className="mt-2 text-base font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                  Tell FORGE what to build. Be specific or vague.
                </div>
              </div>
            )}
            {messages.map((m, i) => <MessageBlock key={m.message_id || i} msg={m} />)}
            {sending && (
              <div className="mr-10 border-2 border-black border-l-8 border-l-[#FF3311] bg-[#F4F4F0] p-4 flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
                <span className="font-bold uppercase tracking-widest text-xs">forge is thinking<span className="caret"></span></span>
              </div>
            )}
          </div>
          <form onSubmit={send} className="border-t-2 border-black bg-white p-4" data-testid="chat-form">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Describe changes, features, fixes..."
                rows={2}
                data-testid="chat-input"
                className="input-brut resize-none"
              />
              <button type="submit" disabled={sending || !input.trim()} data-testid="send-btn" className="btn-primary self-stretch px-4">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={3} />}
              </button>
            </div>
          </form>
        </div>

        {/* Right: IDE / Preview */}
        <div className="flex flex-col overflow-hidden bg-[#0A0A0A]">
          <div className="flex items-center justify-between border-b-2 border-[#333] bg-[#141414] px-4 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab("code")}
                data-testid="tab-code"
                className={`flex items-center gap-1.5 border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${tab === "code" ? "border-[#FF3311] bg-[#FF3311] text-white" : "border-[#555] text-[#999]"}`}
              >
                <Code2 className="h-3 w-3" strokeWidth={3} /> Code
              </button>
              <button
                onClick={() => setTab("preview")}
                data-testid="tab-preview"
                className={`flex items-center gap-1.5 border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${tab === "preview" ? "border-[#FF3311] bg-[#FF3311] text-white" : "border-[#555] text-[#999]"}`}
              >
                <Eye className="h-3 w-3" strokeWidth={3} /> Preview
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#666]">
              <TerminalIcon className="h-3 w-3" /> forge.ide — {allCodeBlocks.length} files
            </div>
          </div>

          {tab === "code" ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-56 shrink-0 border-r-2 border-[#333] bg-[#0F0F0F] overflow-y-auto">
                <div className="p-3 text-[10px] font-bold uppercase tracking-widest text-[#666]">// files</div>
                {allCodeBlocks.length === 0 ? (
                  <div className="px-3 pb-3 text-[11px] text-[#555]">No files yet — start chatting.</div>
                ) : (
                  allCodeBlocks.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveFile(i)}
                      data-testid={`file-${i}`}
                      className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[11px] font-mono truncate ${i === activeFile ? "border-[#FF3311] bg-[#1a1a1a] text-white" : "border-transparent text-[#aaa] hover:bg-[#1a1a1a]"}`}
                    >
                      <FileCode2 className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                      <span className="truncate">{b.file || `${b.lang}-${i + 1}`}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {active ? (
                  <pre className="p-5 text-xs leading-relaxed text-[#E0E0E0]"><code>{active.value}</code></pre>
                ) : (
                  <div className="p-10 font-mono text-sm text-[#888]">
                    <div className="text-[#FF3311] text-[10px] uppercase tracking-widest">// idle</div>
                    <div className="mt-2 text-2xl font-black tracking-tighter text-white" style={{ fontFamily: "Cabinet Grotesk" }}>
                      Awaiting instructions<span className="caret"></span>
                    </div>
                    <div className="mt-3 max-w-sm text-[#777]">
                      Describe the app you want. FORGE will stream code into this pane.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <iframe
              data-testid="preview-iframe"
              srcDoc={previewSrcDoc}
              className="flex-1 w-full bg-white"
              title="preview"
              sandbox="allow-scripts"
            />
          )}
        </div>
      </div>
    </div>
  );
}
