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
      toast.success(`Forging ${t.name}...`);
      navigate(`/project/${data.project_id}`);
    } catch { toast.error("Could not start template"); }
  };

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-[1400px] px-6 py-10" data-testid="templates-page">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[blueprints]</div>
        <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          Pre-forged<br />starting points.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[#555]">Skip the blank page. Pick a template, we&apos;ll bootstrap the project and hand it off to the AI.</p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t) => {
            const Icon = Icons[t.icon] || Icons.Sparkles;
            return (
              <div key={t.template_id} className="brut bg-white p-6 flex flex-col" data-testid={`template-${t.template_id}`}>
                <div className="flex h-11 w-11 items-center justify-center border-2 border-black bg-[#0A0A0A]">
                  <Icon className="h-5 w-5 text-[#FF3311]" strokeWidth={2.5} />
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{t.name}</h3>
                <p className="mt-2 flex-1 text-sm text-[#555]">{t.description}</p>
                <button onClick={() => start(t)} className="btn-primary mt-5 self-start" data-testid={`use-${t.template_id}`}>
                  Use template →
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
