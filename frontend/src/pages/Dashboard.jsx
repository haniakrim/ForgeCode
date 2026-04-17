import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, FolderOpen, Trash2, ArrowUpRight, Sparkles, LayoutGrid, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
    } catch { toast.error("Could not load projects"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createProject = async (name, description, initialPrompt) => {
    try {
      const { data } = await api.post("/projects", { name, description });
      if (initialPrompt) {
        await api.post(`/projects/${data.project_id}/chat`, { content: initialPrompt });
      }
      toast.success("Composition started");
      navigate(`/project/${data.project_id}`);
    } catch { toast.error("Could not create project"); }
  };

  const quickCreate = async () => {
    if (!prompt.trim()) return;
    const name = prompt.split(/\s+/).slice(0, 5).join(" ").slice(0, 40) || "Untitled";
    await createProject(name, prompt, prompt);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await createProject(form.name, form.description, form.description);
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this composition?")) return;
    await api.delete(`/projects/${id}`);
    setProjects((p) => p.filter((x) => x.project_id !== id));
    toast.success("Deleted");
  };

  const suggestions = ["Recipe sharing app", "AI meeting summarizer", "Minimal portfolio", "Mini CRM", "Habit tracker"];

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-14" data-testid="dashboard-page">
        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-8 fade-up">
            <div className="overline">Your studio</div>
            <h1 className="serif mt-4 text-5xl md:text-6xl" style={{ fontWeight: 400, lineHeight: 1 }}>
              Good to see you,<br />
              <span className="italic-serif gradient-text">{user?.name?.split(" ")[0] || "friend"}.</span>
            </h1>
            <p className="mt-4 text-[var(--text-2)] max-w-xl">What shall we compose today?</p>

            {/* Quick prompt */}
            <div className="glass relative mt-8 rounded-3xl p-1.5 noise">
              <div className="rounded-2xl bg-black/40 border border-white/5 p-5">
                <div className="mono text-xs text-[var(--text-3)]">// describe an app</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  data-testid="quick-prompt-input"
                  rows={3}
                  placeholder="A habit tracker with streaks, dark mode, and a daily summary email..."
                  className="mt-3 w-full bg-transparent border-0 outline-none resize-none serif text-xl md:text-2xl placeholder:text-[var(--text-3)] placeholder:italic-serif"
                  style={{ fontWeight: 400 }}
                />
                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setPrompt(`Build a ${s.toLowerCase()} with a refined, modern UI.`)}
                        className="chip hover:text-[var(--brand)] hover:border-[var(--brand)]/40 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={quickCreate}
                    disabled={!prompt.trim()}
                    data-testid="quick-create-btn"
                    className="btn btn-primary"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={1.8} /> Compose
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile card */}
          <div className="col-span-12 lg:col-span-4 fade-up d-2">
            <div className="glass rounded-3xl p-7">
              <div className="overline">Profile</div>
              <div className="mt-4 flex items-center gap-4">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="h-14 w-14 rounded-full object-cover border border-[var(--border)]" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)]"></div>
                )}
                <div className="min-w-0">
                  <div className="serif text-xl truncate" style={{ fontWeight: 500 }}>{user?.name}</div>
                  <div className="text-sm text-[var(--text-3)] truncate">{user?.email}</div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4">
                  <div className="serif text-4xl text-[var(--brand)]" style={{ fontWeight: 500 }}>{user?.credits ?? 0}</div>
                  <div className="overline mt-1 !text-[var(--text-3)]">credits</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4">
                  <div className="serif text-4xl" style={{ fontWeight: 500 }}>{projects.length}</div>
                  <div className="overline mt-1 !text-[var(--text-3)]">projects</div>
                </div>
              </div>
              <Link to="/templates" className="btn btn-ghost mt-5 w-full">
                <LayoutGrid className="h-4 w-4" strokeWidth={1.8} /> Browse templates
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>

        {/* Projects grid */}
        <div className="mt-20 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="overline">Your compositions</div>
            <h2 className="serif mt-3 text-4xl" style={{ fontWeight: 400 }}>
              Gallery
            </h2>
          </div>
          <button onClick={() => setShowCreate(true)} data-testid="new-project-btn" className="btn btn-primary self-start md:self-auto">
            <Plus className="h-4 w-4" strokeWidth={1.8} /> New project
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 glass rounded-2xl p-8 mono text-sm text-[var(--text-2)]">Loading<span className="caret"></span></div>
          ) : projects.length === 0 ? (
            <div className="col-span-3 rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-[var(--brand)]" strokeWidth={1.3} />
              <div className="serif mt-4 text-2xl italic-serif">The gallery is empty.</div>
              <div className="mt-2 text-[var(--text-2)] text-sm">Describe your first app above to begin a composition.</div>
            </div>
          ) : (
            projects.map((p, i) => (
              <div
                key={p.project_id}
                data-testid={`project-card-${p.project_id}`}
                className="glass glass-hover rounded-2xl p-6 flex flex-col relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-black/40">
                    <FolderOpen className="h-4 w-4 text-[var(--brand)]" strokeWidth={1.5} />
                  </div>
                  <button
                    onClick={() => deleteProject(p.project_id)}
                    data-testid={`delete-${p.project_id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-[var(--border)] bg-black/40 p-2 hover:border-[var(--brand)]/40"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--text-2)]" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mono text-[10px] text-[var(--text-3)] mt-5 tracking-widest uppercase">Composition {String(i + 1).padStart(2, "0")}</div>
                <h3 className="serif mt-1 text-2xl" style={{ fontWeight: 500 }}>{p.name}</h3>
                <p className="mt-2 text-sm text-[var(--text-2)] line-clamp-2 min-h-[40px]">{p.description || "No description"}</p>
                <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-3)]">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" strokeWidth={1.5} /> {new Date(p.updated_at).toLocaleDateString()}</span>
                  <Link to={`/project/${p.project_id}`} className="flex items-center gap-1 text-[var(--brand)] hover:text-[var(--brand-hover)]">
                    Open <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitForm} className="glass-strong rounded-3xl w-full max-w-md p-8" data-testid="create-modal">
            <div className="overline">New composition</div>
            <h3 className="serif mt-3 text-3xl italic-serif">Name it. Compose it.</h3>
            <label className="overline mt-6 block !text-[var(--text-3)]">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-2" data-testid="project-name-input" placeholder="recipe-sharing-app" />
            <label className="overline mt-4 block !text-[var(--text-3)]">Description / initial prompt</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="input mt-2 resize-none" data-testid="project-desc-input" placeholder="What should this app do?" />
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" data-testid="submit-create-btn">
                <Sparkles className="h-4 w-4" strokeWidth={1.8} /> Compose
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
