import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API } from "../lib/api";
import axios from "axios";
import { Sparkles, ArrowUpRight, FileCode2, Terminal } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

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

export default function Share() {
  const { id } = useParams();
  const { theme, toggle } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/share/${id}`)
      .then((r) => setData(r.data))
      .catch(() => setError("This project is private or doesn't exist."));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-10 text-center max-w-md">
          <div className="overline">404</div>
          <h1 className="serif mt-3 text-3xl italic-serif">{error}</h1>
          <Link to="/" className="btn btn-primary mt-6">Go to Forge</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center mono text-sm text-[var(--text-2)]"><span className="caret">Loading</span></div>;
  }

  const { project, messages, owner } = data;
  const allCodeBlocks = messages.filter((m) => m.role === "assistant")
    .flatMap((m) => parseContent(m.content).filter((p) => p.type === "code"));

  return (
    <div className="min-h-screen">
      {/* Slim top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]">
              <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
            </div>
            <span className="serif text-xl">Forge<span className="italic-serif text-[var(--brand)]">.</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="chip chip-brand">shared</span>
            <button onClick={toggle} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-2">
              {theme === "noir" ? "☀" : "☾"}
            </button>
            <Link to="/" className="btn btn-primary !py-1.5 !px-3 !text-xs">Try Forge <ArrowUpRight className="h-3 w-3" strokeWidth={1.8} /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-10" data-testid="share-page">
        <div className="overline">A composition shared by {owner?.name || "a Forge user"}</div>
        <h1 className="serif mt-3 text-4xl md:text-5xl" style={{ fontWeight: 400 }}>
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-3 text-[var(--text-2)] max-w-2xl">{project.description}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-3)]">
          <Terminal className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="mono">{allCodeBlocks.length} files · {messages.length} messages</span>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversation preview */}
          <div>
            <div className="overline mb-4">Conversation</div>
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
              {messages.slice(-10).map((m, i) => (
                <div key={i} className={m.role === "user"
                  ? "rounded-2xl rounded-br-md bg-[var(--brand)]/12 border border-[var(--brand)]/25 px-4 py-3"
                  : "glass rounded-2xl rounded-bl-md px-4 py-3"}>
                  <div className="overline mb-1.5">{m.role === "user" ? "prompt" : "forge"}</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">{m.content.replace(/```[\s\S]*?```/g, "[code block]")}</div>
                </div>
              ))}
              {messages.length > 10 && (
                <div className="text-center text-xs text-[var(--text-3)] py-3">· earlier messages hidden ·</div>
              )}
            </div>
          </div>

          {/* Files */}
          <div>
            <div className="overline mb-4">Generated files</div>
            {allCodeBlocks.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-[var(--text-2)]">No code generated yet.</div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {allCodeBlocks.map((b, i) => (
                  <details key={i} className="border-b border-[var(--border)] last:border-0 group">
                    <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-3 hover:bg-[var(--surface-2)]">
                      <div className="flex items-center gap-2 mono text-xs">
                        <FileCode2 className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.5} />
                        {b.file || `${b.lang}-${i + 1}`}
                      </div>
                      <span className="text-[var(--text-3)] text-xs group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <pre className="bg-[var(--ide-bg)] text-[var(--ide-text)] px-5 py-4 text-xs overflow-x-auto"><code>{b.value}</code></pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="overline">Want to build your own?</div>
          <h2 className="serif mt-3 text-3xl italic-serif">It takes about <span className="gradient-text">forty seconds</span>.</h2>
          <Link to="/" className="btn btn-primary mt-6">Try Forge free <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} /></Link>
        </div>
      </div>
    </div>
  );
}
