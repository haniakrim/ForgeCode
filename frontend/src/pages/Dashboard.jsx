import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Folder, Trash2, ArrowUpRight, Sparkles } from "lucide-react";
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
    } catch { toast.error("Failed to load projects"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createProject = async (name, description, initialPrompt) => {
    try {
      const { data } = await api.post("/projects", { name, description });
      if (initialPrompt) {
        await api.post(`/projects/${data.project_id}/chat`, { content: initialPrompt });
      }
      toast.success("Project forged");
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
    if (!window.confirm("Delete this project?")) return;
    await api.delete(`/projects/${id}`);
    setProjects((p) => p.filter((x) => x.project_id !== id));
    toast.success("Deleted");
  };

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-10" data-testid="dashboard-page">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[workspace]</div>
            <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              What are we building<br />today, <span className="text-[#FF3311]">{user?.name?.split(" ")[0] || "friend"}</span>?
            </h1>

            <div className="brut-accent mt-8 bg-white p-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Describe an app</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                data-testid="quick-prompt-input"
                rows={3}
                placeholder="A habit tracker with streaks, dark mode, and a daily summary email..."
                className="input-brut mt-2 border-0 p-0 !shadow-none focus:!shadow-none resize-none"
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {["Todo app", "AI summarizer", "Portfolio", "CRM", "Kanban"].map((p) => (
                    <button key={p} onClick={() => setPrompt(`Build a ${p.toLowerCase()} with a clean UI.`)} className="tag-chip hover:bg-[#FF3311] hover:text-white">
                      {p}
                    </button>
                  ))}
                </div>
                <button onClick={quickCreate} disabled={!prompt.trim()} data-testid="quick-create-btn" className="btn-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4" strokeWidth={3} /> Forge
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="brut bg-[#0A0A0A] text-white p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF3311]">// your profile</div>
              <div className="mt-3 flex items-center gap-3">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="h-12 w-12 border-2 border-white" />
                ) : (
                  <div className="h-12 w-12 border-2 border-white bg-[#FF3311]"></div>
                )}
                <div>
                  <div className="font-bold">{user?.name}</div>
                  <div className="text-xs text-[#999]">{user?.email}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="border-2 border-white p-3">
                  <div className="text-2xl font-black" style={{ fontFamily: "Cabinet Grotesk" }}>{user?.credits ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#999]">credits</div>
                </div>
                <div className="border-2 border-white p-3">
                  <div className="text-2xl font-black" style={{ fontFamily: "Cabinet Grotesk" }}>{projects.length}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#999]">projects</div>
                </div>
              </div>
              <Link to="/templates" className="mt-4 flex items-center justify-between border-2 border-white bg-[#FF3311] px-3 py-2 text-xs font-bold uppercase tracking-widest">
                Browse templates <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={3} />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#555]">[projects]</div>
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Your forge output
            </h2>
          </div>
          <button onClick={() => setShowCreate(true)} data-testid="new-project-btn" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" strokeWidth={3} /> New
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 border-2 border-black bg-white p-8 font-mono text-sm">Loading<span className="caret"></span></div>
          ) : projects.length === 0 ? (
            <div className="col-span-3 border-2 border-dashed border-black bg-white p-12 text-center">
              <Folder className="mx-auto h-10 w-10 text-[#FF3311]" strokeWidth={2} />
              <div className="mt-3 text-sm font-bold uppercase tracking-widest">No projects yet</div>
              <div className="mt-1 text-xs text-[#555]">Describe an app above to forge your first one.</div>
            </div>
          ) : (
            projects.map((p) => (
              <div key={p.project_id} data-testid={`project-card-${p.project_id}`} className="brut bg-white p-5 flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#FF3311]">
                    <Folder className="h-4 w-4 text-white" strokeWidth={3} />
                  </div>
                  <button onClick={() => deleteProject(p.project_id)} className="border-2 border-black bg-white p-1.5 hover:bg-[#FF3311] hover:text-white" data-testid={`delete-${p.project_id}`}>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
                <h3 className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{p.name}</h3>
                <p className="mt-1 text-xs text-[#555] line-clamp-2 min-h-[32px]">{p.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between border-t-2 border-black pt-3 text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-[#555]">{new Date(p.updated_at).toLocaleDateString()}</span>
                  <Link to={`/project/${p.project_id}`} className="flex items-center gap-1 text-[#FF3311]">
                    Open <ArrowUpRight className="h-3 w-3" strokeWidth={3} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitForm} className="brut w-full max-w-md bg-white p-6" data-testid="create-modal">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[new project]</div>
            <h3 className="mt-2 text-3xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>Name it. Forge it.</h3>
            <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-brut mt-1" data-testid="project-name-input" placeholder="ex: recipe-sharing-app" />
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Description / initial prompt</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="input-brut mt-1 resize-none" data-testid="project-desc-input" placeholder="What should this app do?" />
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" data-testid="submit-create-btn">Forge</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
