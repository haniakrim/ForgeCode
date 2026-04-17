import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft, GitFork, FileCode2, Folder, Loader2,
  Sparkles, Brain, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ShowcaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [memory, setMemory] = useState("");
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/api/showcase/${id}`);
        if (!alive) return;
        setProject(r.data);
        // Memory isn't part of /showcase endpoint — it's public-safe to show so we fetch separately if accessible
        try {
          const m = await axios.get(`${API}/api/projects/${id}/memory`, { withCredentials: true });
          if (alive) setMemory(m.data.content || "");
        } catch { /* memory is restricted to members — ignore */ }
      } catch (e) {
        if (alive) setError(e?.response?.data?.detail || "Project not found");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const fork = async () => {
    if (!user) {
      toast.message("Sign in to fork");
      window.location.assign("/");
      return;
    }
    setForking(true);
    try {
      const r = await axios.post(`${API}/api/showcase/${id}/fork`, {}, { withCredentials: true });
      toast.success(`Forked as "${r.data.name}"`);
      window.location.assign(`/project/${r.data.project_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fork failed");
    } finally { setForking(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-[1040px] px-6 py-20 flex items-center gap-2 text-sm text-[var(--text-2)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" strokeWidth={1.8} />
          <span className="italic-serif">loading project…</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-[640px] px-6 py-24 text-center">
          <div className="serif text-4xl" style={{ fontWeight: 500 }}>Not found</div>
          <div className="mt-3 text-[var(--text-2)]">{error || "This project isn't public or has been removed."}</div>
          <Link to="/showcase" data-testid="showcase-detail-back" className="btn btn-ghost mt-6 inline-flex">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to Showcase
          </Link>
        </div>
      </div>
    );
  }

  const tree = buildTree(project.file_paths || []);

  return (
    <div className="min-h-screen pb-24" data-testid="showcase-detail-page">
      <Navbar />
      <div className="mx-auto max-w-[1120px] px-6 md:px-10 py-10">
        <Link to="/showcase" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors" data-testid="showcase-detail-back">
          <ArrowLeft className="h-3 w-3" strokeWidth={1.8} /> Showcase
        </Link>

        {/* Hero */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 md:gap-12">
          <div className="fade-up">
            <div className="overline flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-[var(--brand)]" strokeWidth={2} />
              public showcase
            </div>
            <h1 data-testid="showcase-detail-title" className="serif mt-4 text-4xl md:text-6xl leading-[0.95]" style={{ fontWeight: 400 }}>
              {project.name}
            </h1>
            {(project.showcase_tagline || project.description) && (
              <p className="mt-5 text-lg md:text-xl text-[var(--text-2)] leading-relaxed max-w-[640px] italic-serif">
                {project.showcase_tagline || project.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[var(--text-3)]">
              <div className="flex items-center gap-2">
                {project.owner_picture ? (
                  <img src={project.owner_picture} alt="" className="h-7 w-7 rounded-full object-cover border border-[var(--border)]" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)]" />
                )}
                <div>
                  <div className="overline !text-[var(--text-3)] !text-[9px]">author</div>
                  <div className="text-sm text-[var(--text)] mono">{project.owner_name}</div>
                </div>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div>
                <div className="overline !text-[var(--text-3)] !text-[9px]">stack</div>
                <div className="text-sm text-[var(--text)] mono">{project.stack || "react-fastapi"}</div>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div>
                <div className="overline !text-[var(--text-3)] !text-[9px]">forks</div>
                <div className="text-sm text-[var(--text)] mono">{project.fork_count || 0}</div>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div>
                <div className="overline !text-[var(--text-3)] !text-[9px]">files</div>
                <div className="text-sm text-[var(--text)] mono">{project.file_paths?.length || 0}</div>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div>
                <div className="overline !text-[var(--text-3)] !text-[9px]">published</div>
                <div className="text-sm text-[var(--text)] mono">
                  {new Date(project.published_at || project.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 h-fit noise relative overflow-hidden" data-testid="showcase-detail-actions">
            <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[var(--brand)]/20 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="overline !text-[var(--text-3)]">Want this?</div>
              <div className="serif text-xl mt-1" style={{ fontWeight: 500 }}>Fork and make it yours.</div>
              <p className="text-xs text-[var(--text-2)] mt-2 leading-relaxed">
                Gets you a clean copy under your account — files, memory, everything. No attribution required, but welcome.
              </p>
              <button
                data-testid="showcase-detail-fork"
                onClick={fork}
                disabled={forking}
                className="btn btn-primary w-full mt-5"
              >
                {forking ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitFork className="h-4 w-4" strokeWidth={2} />}
                Fork this project
              </button>
              {user?.user_id === project.user_id && (
                <div className="mt-3 text-[10px] text-[var(--text-3)] italic-serif text-center">
                  (You own this one — visit it from your dashboard.)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Memory (if accessible) */}
        {memory && (
          <section className="mt-14 glass rounded-2xl p-7" data-testid="showcase-detail-memory">
            <div className="overline flex items-center gap-2">
              <Brain className="h-3 w-3 text-[var(--brand)]" strokeWidth={2} /> project memory
            </div>
            <p className="text-xs text-[var(--text-3)] mt-1 italic-serif">
              What the AI remembers about this project's architecture.
            </p>
            <pre className="mt-4 text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-2)] font-mono">
              {memory}
            </pre>
          </section>
        )}

        {/* File tree */}
        <section className="mt-14" data-testid="showcase-detail-tree">
          <div className="overline flex items-center gap-2">
            <Folder className="h-3 w-3" strokeWidth={2} /> project files
          </div>
          <h2 className="serif text-3xl mt-3" style={{ fontWeight: 500 }}>
            What's inside
          </h2>
          {project.file_paths?.length === 0 ? (
            <div className="glass rounded-xl p-8 mt-6 text-center text-[var(--text-3)] italic-serif">
              No files yet — the owner hasn't generated any code.
            </div>
          ) : (
            <div className="mt-6 glass rounded-2xl p-6 max-w-[720px] font-mono text-sm">
              <FileTree tree={tree} />
            </div>
          )}
        </section>

        {/* Bottom fork CTA */}
        <div className="mt-20 glass rounded-3xl p-10 text-center relative overflow-hidden noise">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-[var(--brand)]/15 blur-3xl" />
          <div className="relative">
            <div className="serif text-3xl md:text-4xl" style={{ fontWeight: 500 }}>
              Like what you see?
            </div>
            <p className="mt-3 text-[var(--text-2)]">
              One click to get this project into your Forge dashboard.
            </p>
            <button
              data-testid="showcase-detail-fork-bottom"
              onClick={fork}
              disabled={forking}
              className="btn btn-primary mt-6 !px-8"
            >
              {forking ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitFork className="h-4 w-4" strokeWidth={2} />}
              Fork it now
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- helpers: file tree rendering (iterative) -------- */
function buildTree(paths) {
  const root = {};
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let node = root;
    parts.forEach((seg, idx) => {
      if (!node[seg]) node[seg] = { __leaf: idx === parts.length - 1, children: {} };
      node = node[seg].children;
    });
  }
  return root;
}

function flattenTree(tree, depth = 0, acc = []) {
  const entries = Object.entries(tree).sort((a, b) => {
    const aIsFolder = Object.keys(a[1].children || {}).length > 0;
    const bIsFolder = Object.keys(b[1].children || {}).length > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a[0].localeCompare(b[0]);
  });
  for (const [name, node] of entries) {
    const hasChildren = Object.keys(node.children || {}).length > 0;
    acc.push({ name, depth, hasChildren });
    if (hasChildren) flattenTree(node.children, depth + 1, acc);
  }
  return acc;
}

function FileTree({ tree }) {
  const flat = flattenTree(tree);
  return (
    <ul>
      {flat.map((row, i) => (
        <li key={i} style={{ paddingLeft: row.depth * 18 }}>
          <div className="flex items-center gap-2 py-0.5 text-[var(--text-2)]">
            {row.hasChildren
              ? <Folder className="h-3.5 w-3.5 text-[var(--gold)]" strokeWidth={1.5} />
              : <FileCode2 className="h-3.5 w-3.5 text-[var(--text-3)]" strokeWidth={1.5} />}
            <span className={row.hasChildren ? "text-[var(--text)]" : ""}>{row.name}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
