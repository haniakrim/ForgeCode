import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles, ChevronUp, Check, Loader2, Star, Search,
  Wand2, Plus, X, Tag, TrendingUp, Clock,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Prompts() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [tagFilter, setTagFilter] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const [upvotingId, setUpvotingId] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [appliedPromptId, setAppliedPromptId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (query.trim()) params.set("q", query.trim());
      if (tagFilter) params.set("tag", tagFilter);
      const r = await axios.get(`${API}/api/prompts?${params.toString()}`);
      setPrompts(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load prompts");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    // Read current user's active prompt (for Applied badge)
    if (user) {
      axios.get(`${API}/api/settings`, { withCredentials: true })
        .then((r) => setAppliedPromptId(r.data.applied_prompt_id || null))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [sort, tagFilter]);

  const onSearch = (e) => { e.preventDefault(); refresh(); };

  const apply = async (p) => {
    if (!user) { window.location.assign("/"); return; }
    setApplyingId(p.prompt_id);
    try {
      await axios.post(`${API}/api/prompts/${p.prompt_id}/apply`, {}, { withCredentials: true });
      setAppliedPromptId(p.prompt_id);
      toast.success(`"${p.title}" is now your active system prompt`, {
        action: { label: "Tweak in Settings", onClick: () => window.location.assign("/settings?tab=ai") },
      });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Apply failed");
    } finally { setApplyingId(null); }
  };

  const upvote = async (p) => {
    if (!user) { window.location.assign("/"); return; }
    setUpvotingId(p.prompt_id);
    try {
      const r = await axios.post(`${API}/api/prompts/${p.prompt_id}/upvote`, {}, { withCredentials: true });
      // Optimistic — bump count locally; full refresh from server anyway
      setPrompts((ps) => ps.map((x) => x.prompt_id === p.prompt_id
        ? { ...x, upvotes: (x.upvotes || 0) + (r.data.upvoted ? 1 : -1) } : x));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upvote failed");
    } finally { setUpvotingId(null); }
  };

  const allTags = useMemo(() => {
    const s = new Set();
    prompts.forEach((p) => (p.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [prompts]);

  return (
    <div className="min-h-screen pb-24" data-testid="prompts-page">
      <Navbar />
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
        <div className="fade-up max-w-[720px]">
          <div className="overline flex items-center gap-2">
            <Wand2 className="h-3 w-3 text-[var(--brand)]" strokeWidth={2} />
            prompt marketplace
          </div>
          <h1 className="serif mt-4 text-5xl md:text-6xl lg:text-7xl leading-[0.95]" style={{ fontWeight: 400 }}>
            Borrow a <span className="italic-serif gradient-text">brain.</span>
          </h1>
          <p className="mt-6 text-lg text-[var(--text-2)] leading-relaxed">
            Curated system prompts that shape how FORGE thinks. One click to apply — revert any time.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mt-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 flex-wrap">
          <form onSubmit={onSearch} className="flex-1 min-w-[240px] max-w-[420px] relative" data-testid="prompts-search-form">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" strokeWidth={1.8} />
            <input
              data-testid="prompts-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, tag, or style…"
              className="w-full rounded-full border border-[var(--border)] bg-black/30 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand)]/50"
            />
          </form>
          <div className="flex gap-1 border border-[var(--border)] rounded-full p-1" data-testid="prompts-sort">
            {[
              { id: "featured", label: "Featured", Icon: Star },
              { id: "popular",  label: "Popular",  Icon: TrendingUp },
              { id: "recent",   label: "Recent",   Icon: Clock },
            ].map(({ id, label, Icon }) => {
              const active = sort === id;
              return (
                <button
                  key={id}
                  data-testid={`prompts-sort-${id}`}
                  onClick={() => setSort(id)}
                  className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition-colors ${active ? "bg-[var(--brand)] text-[#050505] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.8} />{label}
                </button>
              );
            })}
          </div>
          <button
            data-testid="prompts-submit-open"
            onClick={() => setSubmitOpen(true)}
            disabled={!user}
            className="btn btn-primary !py-2 !text-xs"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Submit prompt
          </button>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2" data-testid="prompts-tags">
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="chip !text-[10px]"
                data-testid="prompts-tag-clear"
              >
                <X className="h-2.5 w-2.5 mr-0.5" strokeWidth={2} /> clear
              </button>
            )}
            {allTags.map((t) => (
              <button
                key={t}
                data-testid={`prompts-tag-${t}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`chip !text-[10px] ${tagFilter === t ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}
              >
                <Tag className="h-2.5 w-2.5 mr-0.5" strokeWidth={2} />{t}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-sm text-[var(--text-2)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" strokeWidth={1.8} />
            <span className="italic-serif">loading prompts…</span>
          </div>
        ) : prompts.length === 0 ? (
          <div className="mt-16 text-center glass rounded-2xl p-12">
            <Sparkles className="h-6 w-6 mx-auto text-[var(--text-3)] mb-3" strokeWidth={1.5} />
            <div className="serif text-xl" style={{ fontWeight: 500 }}>No prompts match.</div>
            <div className="text-sm text-[var(--text-3)] mt-1 italic-serif">Try a different search or clear filters.</div>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {prompts.map((p, idx) => {
              const applied = appliedPromptId === p.prompt_id;
              return (
                <li
                  key={p.prompt_id}
                  className={`glass rounded-2xl p-6 flex flex-col gap-4 fade-up transition-colors hover:border-[var(--brand)]/40 ${applied ? "!border-[var(--brand)]/60 ring-1 ring-[var(--brand)]/30" : ""}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  data-testid={`prompt-card-${p.prompt_id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {p.curated ? (
                        <span className="chip chip-emerald !text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5" strokeWidth={2} />curated
                        </span>
                      ) : (
                        <span className="chip !text-[10px]">community</span>
                      )}
                      {p.featured && <span className="chip !text-[10px] !border-[var(--gold)]/40 !text-[var(--gold)]">featured</span>}
                    </div>
                    <button
                      data-testid={`prompt-upvote-${p.prompt_id}`}
                      onClick={() => upvote(p)}
                      disabled={upvotingId === p.prompt_id || !user}
                      className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--border)] px-2 py-1 hover:border-[var(--brand)]/40 transition-colors disabled:opacity-50"
                      title={user ? "Upvote" : "Sign in to vote"}
                    >
                      <ChevronUp className="h-3 w-3 text-[var(--brand)]" strokeWidth={2.5} />
                      <span className="text-[10px] mono">{p.upvotes || 0}</span>
                    </button>
                  </div>

                  <div>
                    <div className="serif text-xl leading-tight" style={{ fontWeight: 500 }}>{p.title}</div>
                    {p.description && (
                      <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed line-clamp-3">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(p.tags || []).slice(0, 4).map((t) => (
                      <span key={t} className="chip !text-[9px]">{t}</span>
                    ))}
                  </div>

                  <div className="flex-1" />

                  <div className="flex items-center justify-between text-[10px] text-[var(--text-3)] mono pt-2 border-t border-[var(--border)]">
                    <span>by {p.author_name}</span>
                    <span>used {p.usage_count || 0}×</span>
                  </div>

                  <button
                    data-testid={`prompt-apply-${p.prompt_id}`}
                    onClick={() => apply(p)}
                    disabled={applyingId === p.prompt_id || applied}
                    className={`btn !py-2 !text-xs ${applied ? "btn-ghost !cursor-default !opacity-100" : "btn-primary"}`}
                  >
                    {applyingId === p.prompt_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                     applied                    ? <Check className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={2} /> :
                                                  <Wand2 className="h-3.5 w-3.5" strokeWidth={2} />}
                    {applied ? "Applied" : "Apply prompt"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {submitOpen && <SubmitDialog onClose={() => setSubmitOpen(false)} onSubmitted={refresh} />}
    </div>
  );
}

/* -------- submit prompt dialog -------- */
function SubmitDialog({ onClose, onSubmitted }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/api/prompts`,
        { title: title.trim(), description: description.trim(), body: body.trim(),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean) },
        { withCredentials: true });
      toast.success("Prompt submitted — live in the marketplace");
      onSubmitted?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submit failed");
    } finally { setBusy(false); }
  };

  return (
    <div
      data-testid="prompt-submit-dialog"
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-end"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[620px] h-full bg-[var(--bg)] border-l border-[var(--border)] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl">
          <div>
            <div className="overline !text-[var(--text-3)]">Add to the marketplace</div>
            <div className="serif text-2xl mt-1" style={{ fontWeight: 500 }}>Submit a prompt</div>
          </div>
          <button onClick={onClose} data-testid="prompt-submit-close" className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]/40 transition-colors">
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Title *" hint="Max 80 chars. Sharp and memorable.">
            <input
              data-testid="prompt-submit-title"
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]/50"
            />
          </Field>
          <Field label="Description" hint="Max 300 chars. One sentence pitch.">
            <input
              data-testid="prompt-submit-description"
              value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]/50"
            />
          </Field>
          <Field label="Prompt body *" hint="Max 8000 chars. This replaces FORGE's default persona for users who apply it.">
            <textarea
              data-testid="prompt-submit-body"
              value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={8000}
              placeholder="You are a senior …"
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm mono focus:outline-none focus:border-[var(--brand)]/50 resize-none"
            />
            <div className="text-right text-[10px] text-[var(--text-3)] mt-1">{body.length} / 8000</div>
          </Field>
          <Field label="Tags" hint="Comma-separated, max 6.">
            <input
              data-testid="prompt-submit-tags"
              value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. security, frontend, rust"
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]/50"
            />
          </Field>
          <button
            data-testid="prompt-submit-go"
            onClick={submit}
            disabled={busy || !title.trim() || !body.trim()}
            className="btn btn-primary w-full !py-2.5 !text-sm"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2} />}
            Submit to marketplace
          </button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, hint, children }) {
  return (
    <div>
      <div className="overline !text-[var(--text-3)]">{label}</div>
      <div className="mt-2">{children}</div>
      {hint && <div className="text-[10px] text-[var(--text-3)] mt-1 italic-serif">{hint}</div>}
    </div>
  );
}
