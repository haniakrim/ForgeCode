import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Share2, Copy, CheckCheck, X, UserPlus, Globe, Lock, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export const ShareDialog = ({ project, members = [], onClose, onUpdate }) => {
  const [isPublic, setIsPublic] = useState(project.public || false);
  const [memberList, setMemberList] = useState(members);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/${project.project_id}`;

  useEffect(() => {
    setIsPublic(project.public || false);
  }, [project.public]);

  const togglePublic = async () => {
    const next = !isPublic;
    setIsPublic(next);
    try {
      const { data } = await api.patch(`/projects/${project.project_id}`, { public: next });
      onUpdate?.(data);
      toast.success(next ? "Project is now public" : "Project is now private");
    } catch {
      toast.error("Failed to update");
      setIsPublic(!next);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data } = await api.post(`/projects/${project.project_id}/invite`, { email: email.trim().toLowerCase() });
      if (data.already_invited) {
        toast.info("Already invited");
      } else {
        setMemberList((m) => [...m, data]);
        toast.success(`Invited ${email}`);
      }
      setEmail("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const remove = async (memberId) => {
    try {
      await api.delete(`/projects/${project.project_id}/members/${memberId}`);
      setMemberList((m) => m.filter((x) => x.member_id !== memberId));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl w-full max-w-lg p-7"
        data-testid="share-dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="overline">Share</div>
            <h3 className="serif mt-2 text-3xl italic-serif">Invite the world.</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Public toggle */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
            {isPublic ? (
              <Globe className="h-4.5 w-4.5 text-[var(--brand)]" strokeWidth={1.8} />
            ) : (
              <Lock className="h-4.5 w-4.5 text-[var(--text-2)]" strokeWidth={1.8} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              {isPublic ? "Public" : "Private"}
              {isPublic && <span className="chip chip-emerald !py-0.5">live</span>}
            </div>
            <div className="text-sm text-[var(--text-2)] mt-0.5">
              {isPublic ? "Anyone with the link can view this project read-only." : "Only you and collaborators can see this project."}
            </div>
          </div>
          <button
            onClick={togglePublic}
            data-testid="toggle-public"
            role="switch"
            aria-checked={isPublic}
            className={`shrink-0 h-6 w-11 rounded-full border border-[var(--border)] relative transition-colors ${isPublic ? "bg-[var(--brand)]" : "bg-[var(--surface)]"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isPublic ? "left-6" : "left-0.5"}`} />
          </button>
        </div>

        {isPublic && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 mono text-xs truncate">{shareUrl}</div>
            <button onClick={copyLink} data-testid="copy-link-btn" className="btn btn-ghost !py-2 !px-3">
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-[var(--emerald)]" /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
            </button>
          </div>
        )}

        {/* Collaborators */}
        <div className="mt-7">
          <div className="overline">Collaborators</div>
          <div className="mt-1 text-sm text-[var(--text-2)]">Invite by email. They can chat, but only you can delete.</div>
          <form onSubmit={invite} className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="input"
              data-testid="invite-email-input"
            />
            <button type="submit" disabled={inviting || !email.trim()} data-testid="invite-btn" className="btn btn-primary !px-4">
              <UserPlus className="h-4 w-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">Invite</span>
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {memberList.length === 0 ? (
              <div className="text-xs text-[var(--text-3)] italic-serif">No collaborators yet.</div>
            ) : (
              memberList.map((m) => (
                <div key={m.member_id} data-testid={`member-${m.member_id}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)] flex items-center justify-center text-xs text-white font-bold">
                      {m.email[0]?.toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm truncate">
                      <Mail className="h-3 w-3 text-[var(--text-3)] shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{m.email}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(m.member_id)} data-testid={`remove-${m.member_id}`} className="rounded-full border border-[var(--border)] p-1.5 hover:border-[var(--brand)]" aria-label="Remove">
                    <Trash2 className="h-3 w-3 text-[var(--text-2)]" strokeWidth={1.8} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-[var(--text-3)] text-center mono">
          <Share2 className="inline h-3 w-3 mr-1" strokeWidth={1.8} /> share links show read-only view · collaborators can chat
        </div>
      </div>
    </div>
  );
};
