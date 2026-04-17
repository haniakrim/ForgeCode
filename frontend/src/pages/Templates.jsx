import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import * as Icons from "lucide-react";
import { toast } from "sonner";

export default function Templates() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/templates").then(({ data }) => setItems(data)).catch(() => {});
  }, []);

  const start = async (t) => {
    try {
      const { data } = await api.post("/projects", { name: t.name, description: t.description });
      await api.post(`/projects/${data.project_id}/chat`, { content: t.prompt });
      toast.success(`Composing ${t.name}...`);
      navigate(`/project/${data.project_id}`);
    } catch { toast.error("Could not start template"); }
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-14" data-testid="templates-page">
        <div className="max-w-3xl fade-up">
          <div className="overline">Library</div>
          <h1 className="serif mt-4 text-5xl md:text-7xl" style={{ fontWeight: 400 }}>
            Pre-composed<br /><span className="italic-serif gradient-text">starting points.</span>
          </h1>
          <p className="mt-6 text-[var(--text-2)] text-lg">
            Skip the blank page. Pick a blueprint — we&apos;ll bootstrap the project and hand it off
            to Forge so it can finish the details.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t, i) => {
            const Icon = Icons[t.icon] || Icons.Sparkles;
            return (
              <div key={t.template_id} data-testid={`template-${t.template_id}`} className={`glass glass-hover rounded-2xl p-7 flex flex-col fade-up d-${Math.min(i + 1, 5)}`}>
                <div className="mono text-[10px] tracking-widest uppercase text-[var(--text-3)]">Blueprint {String(i + 1).padStart(2, "0")}</div>
                <div className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-black/40">
                  <Icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5} />
                </div>
                <h3 className="serif mt-5 text-3xl" style={{ fontWeight: 500 }}>{t.name}</h3>
                <p className="mt-2 flex-1 text-sm text-[var(--text-2)]">{t.description}</p>
                <button onClick={() => start(t)} className="btn btn-primary mt-6 self-start" data-testid={`use-${t.template_id}`}>
                  Use blueprint <Icons.ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
