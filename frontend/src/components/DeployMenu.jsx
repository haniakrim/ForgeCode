import { useEffect, useRef, useState } from "react";
import { Rocket, ChevronDown, Github, Cloud, Loader2, ExternalLink, PlugZap } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

/**
 * Toolbar button with dropdown offering:
 *   · Push to GitHub
 *   · Deploy to Vercel
 *   · Deploy to Netlify
 * Shows connection status inline; if a provider is disconnected, the row links to /settings.
 */
export function DeployMenu({ projectId }) {
  const API = process.env.REACT_APP_BACKEND_URL;
  const [open, setOpen] = useState(false);
  const [integrations, setIntegrations] = useState({
    github: { connected: false },
    vercel: { connected: false },
    netlify: { connected: false },
  });
  const [busy, setBusy] = useState(null); // "github" | "vercel" | "netlify" | null
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/api/settings`, { withCredentials: true })
      .then((r) => setIntegrations(r.data.integrations || {}))
      .catch(() => {});
  }, [open, API]);

  const run = async (provider, endpoint) => {
    setBusy(provider);
    try {
      const { data } = await axios.post(`${API}/api/projects/${projectId}/${endpoint}`,
        {}, { withCredentials: true });
      const url = data.repo_url || data.url;
      toast.success(`${provider[0].toUpperCase() + provider.slice(1)}: ${data.files_deployed || data.files_pushed} files · done`, {
        action: url ? { label: "Open", onClick: () => window.open(url, "_blank") } : undefined,
        duration: 8000,
      });
      setOpen(false);
    } catch (e) {
      const detail = e?.response?.data?.detail || e.message;
      toast.error(`${provider}: ${detail}`);
    } finally {
      setBusy(null);
    }
  };

  const row = (provider, label, Icon, endpoint) => {
    const connected = integrations[provider]?.connected;
    const identity = integrations[provider]?.identity;
    return (
      <button
        key={provider}
        data-testid={`deploy-${provider}`}
        disabled={busy !== null}
        onClick={() => connected ? run(provider, endpoint) : window.location.assign(`/settings?tab=integrations`)}
        className="w-full text-left px-4 py-3 hover:bg-[var(--surface-2)] disabled:opacity-60 flex items-center gap-3 border-b border-[var(--border)] last:border-b-0 transition-colors"
      >
        <Icon className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.6} />
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ fontWeight: 500 }}>{label}</div>
          <div className="text-[11px] text-[var(--text-3)] mono truncate">
            {connected ? `connected · ${identity || "ready"}` : "not connected — click to link"}
          </div>
        </div>
        {busy === provider ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand)]" strokeWidth={2} />
        ) : connected ? (
          <ExternalLink className="h-3.5 w-3.5 text-[var(--text-3)]" strokeWidth={1.6} />
        ) : (
          <PlugZap className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.6} />
        )}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        data-testid="deploy-menu-btn"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost !py-1.5 !px-3 !text-xs"
        title="Deploy or push to GitHub"
      >
        <Rocket className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span className="hidden md:inline">Deploy</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>
      {open && (
        <div
          data-testid="deploy-menu"
          className="absolute right-0 mt-2 w-[320px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-[var(--border)] overline !text-[var(--text-3)]">
            Ship this composition
          </div>
          {row("github",  "Push to GitHub",    Github, "github/push")}
          {row("vercel",  "Deploy to Vercel",  Cloud,  "vercel/deploy")}
          {row("netlify", "Deploy to Netlify", Cloud,  "netlify/deploy")}
        </div>
      )}
    </div>
  );
}
