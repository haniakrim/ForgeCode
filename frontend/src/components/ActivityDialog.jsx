import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { X, Activity, UserPlus, Share2, Lock, Trash2, MessageSquare, FileCode2, ShieldCheck } from "lucide-react";

const ICONS = {
  "member.invited": UserPlus,
  "member.role_changed": ShieldCheck,
  "member.removed": Trash2,
  "project.made_public": Share2,
  "project.made_private": Lock,
  "message.sent": MessageSquare,
  "file.edited": FileCode2,
};

const LABELS = {
  "member.invited": "invited a collaborator",
  "member.role_changed": "changed a role",
  "member.removed": "removed a collaborator",
  "project.made_public": "made the project public",
  "project.made_private": "made the project private",
  "message.sent": "sent a message",
  "file.edited": "edited a file",
};

const timeAgo = (iso) => {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
};

export const ActivityDialog = ({ projectId, onClose }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${projectId}/activity`)
      .then(({ data }) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong rounded-3xl w-full max-w-lg p-7 max-h-[80vh] overflow-y-auto" data-testid="activity-dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="overline">Activity</div>
            <h3 className="serif mt-2 text-3xl italic-serif">Who did what, when.</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="text-sm text-[var(--text-2)] mono">Loading<span className="caret"></span></div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-2)]">
              <Activity className="mx-auto h-6 w-6 text-[var(--brand)]" strokeWidth={1.5} />
              <div className="mt-2 italic-serif">Nothing yet — activity will appear here.</div>
            </div>
          ) : rows.map((r) => {
            const Icon = ICONS[r.event_type] || Activity;
            return (
              <div key={r.activity_id} data-testid={`activity-${r.activity_id}`} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
                  <Icon className="h-4 w-4 text-[var(--brand)]" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{r.actor_name || r.actor_email || "Someone"}</span>{" "}
                    <span className="text-[var(--text-2)]">{LABELS[r.event_type] || r.event_type}</span>
                  </div>
                  {r.detail && <div className="mt-0.5 text-xs text-[var(--text-3)] truncate mono">{r.detail}</div>}
                </div>
                <div className="text-xs text-[var(--text-3)] shrink-0 mono">{timeAgo(r.created_at)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
