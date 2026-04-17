import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Sparkles, GitFork, ArrowUpRight, FileCode2, TrendingUp, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Showcase() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent"); // "recent" | "popular"
  const [forking, setForking] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/showcase?sort=${sort}`);
      setProjects(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load showcase");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sort]);

  const fork = async (projectId) => {
    if (!user) {
      toast.message("Sign in to fork");
      window.location.assign("/");
      return;
    }
    setForking(projectId);
    try {
      const r = await axios.post(`${API}/api/showcase/${projectId}/fork`, {}, { withCredentials: true });
      toast.success(`Forked as "${r.data.name}"`);
      window.location.assign(`/project/${r.data.project_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fork failed");
    } finally { setForking(null); }
  };

  return (
    <div className="min-h-screen pb-24">
      <Navbar />
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12" data-testid="showcase-page">
        {/* Hero */}
        <div className="fade-up max-w-[720px]">
          <div className="overline flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-[var(--brand)]" strokeWidth={2} /> Public gallery
          </div>
          <h1 className="serif mt-4 text-5xl md:text-6xl lg:text-7xl leading-[0.95]" style={{ fontWeight: 400 }}>
            Built by the <span className="italic-serif gradient-text">community.</span>
            <br />Fork in one&nbsp;click.
          </h1>
          <p className="mt-6 text-lg text-[var(--text-2)] leading-relaxed">
            Browse apps shipped with Forge. Open any project to study the code — or{" "}
            <span className="text-[var(--brand)]">fork it</span> to make it yours.
          </p>
        </div>

        {/* Sort tabs */}
        <div className="mt-10 flex items-center gap-2 border-b border-[var(--border)]">
          {[
            { id: "recent",  label: "Recent",  Icon: Clock },
            { id: "popular", label: "Popular", Icon: TrendingUp },
          ].map((t) => {
            const Icon = t.Icon;
            const active = sort === t.id;
            return (
              <button
                key={t.id}
                data-testid={`showcase-sort-${t.id}`}
                onClick={() => setSort(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2 -mb-px ${active ? "border-[var(--brand)] text-[var(--text)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]"}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-sm text-[var(--text-2)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" strokeWidth={1.8} />
            <span className="italic-serif">loading the gallery…</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-16 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-[var(--text-3)] mb-3" strokeWidth={1.5} />
            <div className="serif text-2xl" style={{ fontWeight: 500 }}>No public projects yet</div>
            <div className="text-sm text-[var(--text-3)] mt-2 italic-serif">
              Be the first — open any of your projects and flip the "Make public" toggle.
            </div>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p, idx) => (
              <li
                key={p.project_id}
                className="glass rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden hover:border-[var(--brand)]/40 transition-colors fade-up"
                style={{ animationDelay: `${idx * 40}ms` }}
                data-testid={`showcase-card-${p.project_id}`}
              >
                <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--brand)]/8 blur-3xl pointer-events-none" />
                <div className="flex items-start justify-between gap-3 relative">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.owner_picture ? (
                      <img src={p.owner_picture} alt="" className="h-8 w-8 rounded-full object-cover border border-[var(--border)]" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)]" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] text-[var(--text-3)] mono truncate">{p.owner_name}</div>
                      <div className="overline !text-[var(--text-3)] !text-[9px]">public</div>
                    </div>
                  </div>
                  {p.fork_count > 0 && (
                    <span className="chip chip-emerald !text-[10px] shrink-0">
                      <GitFork className="h-2.5 w-2.5 inline-block mr-0.5" strokeWidth={2} />
                      {p.fork_count}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="serif text-2xl leading-tight" style={{ fontWeight: 500 }}>{p.name}</div>
                  {(p.showcase_tagline || p.description) && (
                    <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed line-clamp-3">
                      {p.showcase_tagline || p.description}
                    </p>
                  )}
                </div>

                <div className="flex-1" />

                <div className="relative flex items-center justify-between text-xs text-[var(--text-3)] pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center gap-1">
                    <FileCode2 className="h-3 w-3" strokeWidth={1.8} />
                    <span className="mono">{p.stack || "react-fastapi"}</span>
                  </div>
                  <span className="mono text-[10px]">{new Date(p.published_at || p.updated_at).toLocaleDateString()}</span>
                </div>

                <div className="relative flex gap-2">
                  <Link
                    to={`/showcase/${p.project_id}`}
                    data-testid={`showcase-view-${p.project_id}`}
                    className="btn btn-ghost !py-2 flex-1 !text-xs"
                  >
                    View <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                  </Link>
                  <button
                    data-testid={`showcase-fork-${p.project_id}`}
                    onClick={() => fork(p.project_id)}
                    disabled={forking === p.project_id}
                    className="btn btn-primary !py-2 flex-1 !text-xs"
                  >
                    {forking === p.project_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitFork className="h-3 w-3" strokeWidth={2} />}
                    Fork
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
