import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  Mail, User2, Coins, Shield, ArrowUpRight, Cpu, Github, Cloud,
  Check, Loader2, Plug, KeyRound, Sparkles, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const TABS = [
  { id: "profile",      label: "Profile",      icon: User2 },
  { id: "ai",           label: "AI engine",    icon: Cpu },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const initialTab = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    return TABS.find((t) => t.id === p)?.id || "profile";
  }, []);
  const [tab, setTab] = useState(initialTab);

  if (!user) return null;
  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="mx-auto max-w-[1080px] px-6 md:px-10 py-12" data-testid="settings-page">
        <div className="fade-up">
          <div className="overline">Workbench</div>
          <h1 className="serif mt-4 text-5xl md:text-6xl" style={{ fontWeight: 400 }}>
            Settings &<br /><span className="italic-serif gradient-text">preferences.</span>
          </h1>
        </div>

        <div className="mt-10 flex gap-2 border-b border-[var(--border)]" data-testid="settings-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => { setTab(t.id); window.history.replaceState(null, "", `/settings?tab=${t.id}`); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2 -mb-px ${
                  active
                    ? "border-[var(--brand)] text-[var(--text)]"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 fade-up">
          {tab === "profile" && <ProfileTab user={user} logout={logout} />}
          {tab === "ai" && <AITab />}
          {tab === "integrations" && <IntegrationsTab />}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Profile ----------------------------- */
function ProfileTab({ user, logout }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass rounded-2xl p-7 md:col-span-2">
        <div className="overline">Profile</div>
        <div className="mt-5 flex items-center gap-5">
          {user.picture ? (
            <img src={user.picture} alt="" className="h-20 w-20 rounded-full object-cover border border-[var(--border)]" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)]" />
          )}
          <div>
            <div className="serif text-3xl" style={{ fontWeight: 500 }}>{user.name}</div>
            <div className="text-[var(--text-2)]">{user.email}</div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4">
            <div className="flex items-center gap-1.5 overline !text-[var(--text-3)]"><User2 className="h-3 w-3" strokeWidth={1.5} /> user id</div>
            <div className="mt-2 mono text-xs truncate">{user.user_id}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4">
            <div className="flex items-center gap-1.5 overline !text-[var(--text-3)]"><Mail className="h-3 w-3" strokeWidth={1.5} /> email</div>
            <div className="mt-2 mono text-xs truncate">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-7 noise relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--brand)]/20 blur-3xl" />
        <div className="relative">
          <div className="overline">Credits</div>
          <div className="mt-3 flex items-baseline gap-3">
            <Coins className="h-8 w-8 text-[var(--brand)]" strokeWidth={1.3} />
            <div className="serif text-6xl gradient-text" style={{ fontWeight: 500 }}>{user.credits}</div>
          </div>
          <div className="mt-2 text-sm text-[var(--text-2)]">Each message ≈ 1 credit. Refills reset monthly on paid plans.</div>
          <button onClick={() => window.location.assign("/billing")} className="btn btn-primary mt-5 w-full" data-testid="upgrade-btn">
            Buy credits <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-7 md:col-span-3">
        <div className="overline">Session</div>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl border border-[var(--border)] bg-black/40 flex items-center justify-center">
              <Shield className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5} />
            </div>
            <div>
              <div className="serif text-lg" style={{ fontWeight: 500 }}>Sign out of this device</div>
              <div className="text-sm text-[var(--text-2)]">Your session cookie will be cleared.</div>
            </div>
          </div>
          <button onClick={logout} className="btn btn-ghost" data-testid="settings-logout-btn">Sign out</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- AI engine ----------------------------- */
function AITab() {
  const [models, setModels] = useState([]);
  const [settings, setSettings] = useState(null);
  const [modelId, setModelId] = useState("");
  const [sysPrompt, setSysPrompt] = useState("");
  const [byoKeys, setByoKeys] = useState({ openai: "", anthropic: "", gemini: "" });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [m, s] = await Promise.all([
      axios.get(`${API}/api/models`, { withCredentials: true }),
      axios.get(`${API}/api/settings`, { withCredentials: true }),
    ]);
    setModels(m.data);
    setSettings(s.data);
    setModelId(s.data.model_id);
    setSysPrompt(s.data.system_prompt || "");
  };

  useEffect(() => { refresh().catch(() => toast.error("Failed to load settings")); }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/api/settings`, patch, { withCredentials: true });
      setSettings(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  if (!settings) return <div className="text-[var(--text-2)]">Loading…</div>;

  const currentModel = models.find((m) => m.id === modelId);
  const byProvider = models.reduce((a, m) => { (a[m.provider] ||= []).push(m); return a; }, {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="glass rounded-2xl p-7 lg:col-span-3" data-testid="model-picker-card">
        <div className="overline flex items-center gap-2"><Cpu className="h-3 w-3" strokeWidth={1.8} /> Default model</div>
        <div className="mt-2 text-sm text-[var(--text-2)]">The model Forge uses for chat & code generation on new messages.</div>

        <div className="mt-5 space-y-5">
          {Object.entries(byProvider).map(([provider, list]) => (
            <div key={provider}>
              <div className="overline !text-[var(--text-3)]">{provider}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map((m) => {
                  const active = m.id === modelId;
                  return (
                    <button
                      key={m.id}
                      data-testid={`model-${m.id}`}
                      onClick={() => setModelId(m.id)}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        active
                          ? "border-[var(--brand)] bg-[var(--brand)]/8"
                          : "border-[var(--border)] hover:border-[var(--text-3)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm" style={{ fontWeight: 500 }}>{m.label}</div>
                        {active && <Check className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={2} />}
                      </div>
                      <div className="mt-1 mono text-[11px] text-[var(--text-3)] truncate">{m.id}</div>
                      {m.recommended && <span className="chip chip-emerald mt-2 !text-[10px]">recommended</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-[var(--text-3)]">
            {currentModel ? <>Current: <span className="mono">{currentModel.label}</span></> : null}
          </div>
          <button
            data-testid="save-model-btn"
            disabled={saving || modelId === settings.model_id}
            onClick={() => save({ model_id: modelId })}
            className="btn btn-primary !py-2 !px-4 !text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Save model
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-7 lg:col-span-2" data-testid="system-prompt-card">
        <div className="overline">Custom system prompt</div>
        <div className="mt-2 text-sm text-[var(--text-2)]">
          Override FORGE's default persona. Leave blank to keep the built-in senior-engineer prompt.
        </div>
        <textarea
          data-testid="system-prompt-input"
          value={sysPrompt}
          onChange={(e) => setSysPrompt(e.target.value)}
          rows={10}
          maxLength={8000}
          placeholder="You are an expert … write in tight, declarative voice. Prefer TypeScript. Always …"
          className="mt-4 w-full rounded-xl border border-[var(--border)] bg-black/30 p-3 text-sm mono focus:outline-none focus:border-[var(--brand)]/50 resize-none"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-3)]">
          <span>{sysPrompt.length} / 8000</span>
          <button
            data-testid="save-prompt-btn"
            disabled={saving || sysPrompt === settings.system_prompt}
            onClick={() => save({ system_prompt: sysPrompt })}
            className="btn btn-ghost !py-1.5 !px-3 !text-xs"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={2} />}
            Save prompt
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-7 lg:col-span-5" data-testid="byo-keys-card">
        <div className="overline flex items-center gap-2"><KeyRound className="h-3 w-3" strokeWidth={1.8} /> Bring your own API keys</div>
        <div className="mt-2 text-sm text-[var(--text-2)]">
          Optional. By default Forge uses its managed key (your credits). Paste a provider key below to bill that provider directly instead — used whenever you select a model from that family.
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {["openai", "anthropic", "gemini"].map((p) => (
            <BYORow
              key={p}
              provider={p}
              hasKey={settings.byo_keys?.[p]}
              value={byoKeys[p]}
              setValue={(v) => setByoKeys((s) => ({ ...s, [p]: v }))}
              onSave={() => save({ byo_keys: { [p]: byoKeys[p] } }).then(() => setByoKeys((s) => ({ ...s, [p]: "" })))}
              onClear={() => save({ byo_keys: { [p]: "" } })}
              saving={saving}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BYORow({ provider, hasKey, value, setValue, onSave, onClear, saving }) {
  const label = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini" }[provider];
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ fontWeight: 500 }}>{label}</div>
        {hasKey ? <span className="chip chip-emerald !text-[10px]">key stored</span> : <span className="chip !text-[10px]">default</span>}
      </div>
      <input
        data-testid={`byo-${provider}`}
        type="password"
        placeholder={hasKey ? "•••• (stored — paste new key to rotate)" : "sk-... / paste key"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-xs mono focus:outline-none focus:border-[var(--brand)]/50"
      />
      <div className="mt-2 flex gap-2">
        <button
          data-testid={`byo-save-${provider}`}
          disabled={saving || !value}
          onClick={onSave}
          className="btn btn-primary !py-1.5 !px-3 !text-xs flex-1"
        >
          Save
        </button>
        {hasKey && (
          <button
            data-testid={`byo-clear-${provider}`}
            disabled={saving}
            onClick={onClear}
            className="btn btn-ghost !py-1.5 !px-3 !text-xs"
            title="Remove stored key"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Integrations ----------------------------- */
function IntegrationsTab() {
  const [data, setData] = useState(null);

  const refresh = async () => {
    const r = await axios.get(`${API}/api/settings`, { withCredentials: true });
    setData(r.data);
  };
  useEffect(() => { refresh().catch(() => toast.error("Failed to load integrations")); }, []);
  if (!data) return <div className="text-[var(--text-2)]">Loading…</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <IntegrationCard
        provider="github"
        label="GitHub"
        Icon={Github}
        state={data.integrations.github}
        onChange={refresh}
        description="Push projects to your own repositories. Create a token at github.com/settings/tokens with the 'repo' scope."
        tokenUrl="https://github.com/settings/tokens/new?scopes=repo&description=FORGE"
      />
      <IntegrationCard
        provider="vercel"
        label="Vercel"
        Icon={Cloud}
        state={data.integrations.vercel}
        onChange={refresh}
        description="One-click deploy generated code. Create a token at vercel.com/account/tokens (full account scope)."
        tokenUrl="https://vercel.com/account/tokens"
      />
      <IntegrationCard
        provider="netlify"
        label="Netlify"
        Icon={Cloud}
        state={data.integrations.netlify}
        onChange={refresh}
        description="Ship static/SPA output to a live URL. Create a token at app.netlify.com/user/applications."
        tokenUrl="https://app.netlify.com/user/applications#personal-access-tokens"
      />
    </div>
  );
}

function IntegrationCard({ provider, label, Icon, state, onChange, description, tokenUrl }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = !!state?.connected;

  const connect = async () => {
    if (!token.trim()) return toast.error("Paste your token first");
    setBusy(true);
    try {
      await axios.post(`${API}/api/integrations/${provider}/connect`, { token }, { withCredentials: true });
      toast.success(`${label} connected`);
      setToken(""); await onChange();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Connection failed");
    } finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await axios.delete(`${API}/api/integrations/${provider}`, { withCredentials: true });
      toast.success(`${label} disconnected`);
      await onChange();
    } catch { toast.error("Disconnect failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-6" data-testid={`integration-${provider}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-[var(--border)] bg-black/40 flex items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--text)]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="serif text-lg" style={{ fontWeight: 500 }}>{label}</div>
            <div className="text-[11px] text-[var(--text-3)]">
              {connected
                ? <>connected · <span className="mono">{state.identity}</span></>
                : "not connected"}
            </div>
          </div>
        </div>
        {connected && <span className="chip chip-emerald !text-[10px]">live</span>}
      </div>

      <p className="mt-4 text-xs text-[var(--text-2)] leading-relaxed">{description}</p>
      <a
        href={tokenUrl} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 mt-2 text-[11px] text-[var(--brand)] hover:underline"
        data-testid={`${provider}-token-link`}
      >
        Create token <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2} />
      </a>

      {!connected ? (
        <div className="mt-4 space-y-2">
          <input
            data-testid={`${provider}-token-input`}
            type="password"
            placeholder="paste token here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-xs mono focus:outline-none focus:border-[var(--brand)]/50"
          />
          <button
            data-testid={`${provider}-connect-btn`}
            onClick={connect}
            disabled={busy}
            className="btn btn-primary !py-2 !text-xs w-full"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Connect {label}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            data-testid={`${provider}-disconnect-btn`}
            onClick={disconnect}
            disabled={busy}
            className="btn btn-ghost !py-2 !text-xs flex-1"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
