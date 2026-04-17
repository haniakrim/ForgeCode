import { useEffect, useRef, useState } from "react";
import { Bell, Check, ExternalLink, GitBranch, Cloud, ClipboardCheck, UserPlus, Inbox } from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const KIND_META = {
  invite:   { label: "Invite",   Icon: UserPlus },
  review:   { label: "Review",   Icon: ClipboardCheck },
  deploy:   { label: "Deploy",   Icon: Cloud },
  push:     { label: "GitHub",   Icon: GitBranch },
  role:     { label: "Role",     Icon: UserPlus },
  restored: { label: "Restore",  Icon: GitBranch },
  system:   { label: "System",   Icon: Inbox },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const rootRef = useRef(null);

  const refresh = async () => {
    try {
      const r = await axios.get(`${API}/api/notifications`, { withCredentials: true });
      setUnread(r.data.unread ?? 0);
      setItems(r.data.notifications ?? []);
    } catch { /* silent — user likely not logged in */ }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30000);
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => { clearInterval(iv); document.removeEventListener("mousedown", onDoc); };
  }, []);

  const markAllRead = async () => {
    try {
      await axios.post(`${API}/api/notifications/read`, { ids: null }, { withCredentials: true });
      await refresh();
    } catch { /* ignore */ }
  };

  const openItem = async (n) => {
    try {
      await axios.post(`${API}/api/notifications/read`, { ids: [n.notification_id] }, { withCredentials: true });
    } catch { /* ignore */ }
    if (n.link) {
      if (n.link.startsWith("http")) window.open(n.link, "_blank");
      else window.location.assign(n.link);
    }
    await refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        data-testid="notifications-btn"
        onClick={() => { setOpen((v) => !v); if (!open) refresh(); }}
        className="relative rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-2 hover:border-[var(--brand)] transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.8} />
        {unread > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[var(--brand)] text-[10px] font-bold text-[#050505] flex items-center justify-center pulse-dot"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          data-testid="notifications-panel"
          className="absolute right-0 mt-2 w-[380px] max-h-[480px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div>
              <div className="overline !text-[var(--text-3)]">Your feed</div>
              <div className="serif text-lg mt-0.5" style={{ fontWeight: 500 }}>
                Notifications {unread > 0 && <span className="text-[var(--brand)] text-sm italic-serif ml-1">· {unread} new</span>}
              </div>
            </div>
            {items.length > 0 && (
              <button
                data-testid="notifications-mark-all"
                onClick={markAllRead}
                className="text-[10px] uppercase tracking-widest text-[var(--text-3)] hover:text-[var(--brand)]"
              >
                mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-6 w-6 mx-auto text-[var(--text-3)] mb-3" strokeWidth={1.5} />
              <div className="serif text-base" style={{ fontWeight: 500 }}>Inbox empty</div>
              <div className="text-xs text-[var(--text-3)] mt-1 italic-serif">Activity — invites, reviews, deploys — will surface here.</div>
            </div>
          ) : (
            <ul>
              {items.map((n) => {
                const meta = KIND_META[n.kind] || KIND_META.system;
                const Icon = meta.Icon;
                return (
                  <li key={n.notification_id}>
                    <button
                      data-testid={`notif-${n.notification_id}`}
                      onClick={() => openItem(n)}
                      className={`w-full text-left px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors flex gap-3 ${n.read ? "opacity-70" : ""}`}
                    >
                      <div className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center ${n.read ? "border-[var(--border)] text-[var(--text-3)]" : "border-[var(--brand)]/40 text-[var(--brand)] bg-[var(--brand)]/8"}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="overline !text-[var(--text-3)]">{meta.label}</span>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />}
                        </div>
                        <div className="text-sm mt-0.5 truncate" style={{ fontWeight: 500 }}>{n.title}</div>
                        {n.body && <div className="text-xs text-[var(--text-3)] mt-0.5 line-clamp-2">{n.body}</div>}
                        <div className="text-[10px] text-[var(--text-3)] mono mt-1">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      {n.link && <ExternalLink className="h-3 w-3 text-[var(--text-3)] shrink-0" strokeWidth={1.6} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
