import { useEffect, useMemo, useState } from "react";
import { X, History, RotateCcw, FileCode2, Loader2, Clock, User, Camera, Trash2, Columns, SplitSquareHorizontal } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const TABS = [
  { id: "versions",  label: "Versions" },
  { id: "snapshots", label: "Snapshots" },
];

export function HistoryDialog({ projectId, onClose, initialPath = null }) {
  const [tab, setTab] = useState("versions");
  return (
    <div
      data-testid="history-dialog"
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-stretch p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1280px] h-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <div className="overline !text-[var(--text-3)]">Time travel</div>
            <div className="serif text-2xl mt-1" style={{ fontWeight: 500 }}>
              <History className="h-5 w-5 inline-block mr-2 text-[var(--brand)]" strokeWidth={1.8} />
              History &amp; snapshots
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 border border-[var(--border)] rounded-full p-1" data-testid="history-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  data-testid={`history-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${tab === t.id ? "bg-[var(--brand)] text-[#050505] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} data-testid="history-close" className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]/40 transition-colors">
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === "versions"  && <VersionsTab projectId={projectId} initialPath={initialPath} />}
          {tab === "snapshots" && <SnapshotsTab projectId={projectId} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

/* ================== Versions tab (per-file) ================== */
function VersionsTab({ projectId, initialPath }) {
  const [versions, setVersions] = useState([]);
  const [paths, setPaths] = useState([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [diffText, setDiffText] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [diffMode, setDiffMode] = useState("side"); // "side" | "unified"

  const loadVersions = async (path) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/projects/${projectId}/files/history${path ? `?path=${encodeURIComponent(path)}` : ""}`, { withCredentials: true });
      setVersions(r.data);
      if (!path) {
        const uniq = Array.from(new Set(r.data.map((v) => v.path))).sort();
        setPaths(uniq);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load history");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadVersions(selectedPath); /* eslint-disable-next-line */ }, [selectedPath]);

  const loadDiff = async (a, b) => {
    if (!selectedPath) return;
    try {
      const params = new URLSearchParams({ path: selectedPath });
      if (a) params.set("a", a);
      if (b) params.set("b", b);
      const r = await axios.get(`${API}/api/projects/${projectId}/files/diff?${params.toString()}`, { withCredentials: true });
      setDiffText(r.data.diff || "");
    } catch (e) {
      setDiffText(`# error: ${e?.response?.data?.detail || e.message}`);
    }
  };

  useEffect(() => {
    if (selectedPath) loadDiff(compareA, compareB);
  }, [compareA, compareB, selectedPath]); // eslint-disable-line

  const restore = async (versionId) => {
    setRestoring(versionId);
    try {
      await axios.post(`${API}/api/projects/${projectId}/files/restore`, { version_id: versionId }, { withCredentials: true });
      toast.success("File restored");
      await loadVersions(selectedPath);
      setCompareA(null); setCompareB(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Restore failed");
    } finally { setRestoring(null); }
  };

  const { sideRows } = useMemo(() => parseDiffToSideBySide(diffText), [diffText]);

  return (
    <div className="h-full grid grid-cols-[260px_260px_1fr]">
      {/* Files column */}
      <div className="border-r border-[var(--border)] overflow-y-auto" data-testid="history-paths">
        <div className="p-3 overline !text-[var(--text-3)] sticky top-0 bg-[var(--bg)]">Files</div>
        {paths.length === 0 && !selectedPath && (
          <div className="px-3 text-xs italic-serif text-[var(--text-3)]">No versioned files yet.</div>
        )}
        {paths.map((p) => (
          <button
            key={p}
            data-testid={`history-path-${p}`}
            onClick={() => { setSelectedPath(p); setCompareA(null); setCompareB(null); }}
            className={`w-full text-left px-3 py-2 text-xs mono border-l-2 transition-colors ${selectedPath === p ? "border-[var(--brand)] bg-[var(--brand)]/8 text-[var(--text)]" : "border-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)]"}`}
          >
            <FileCode2 className="h-3 w-3 inline-block mr-2 text-[var(--text-3)]" strokeWidth={1.5} />
            {p}
          </button>
        ))}
      </div>

      {/* Versions column */}
      <div className="border-r border-[var(--border)] overflow-y-auto">
        <div className="p-3 overline !text-[var(--text-3)] sticky top-0 bg-[var(--bg)] z-10">
          Versions {selectedPath && <span className="mono text-[10px] text-[var(--text-3)] normal-case">· {selectedPath}</span>}
        </div>
        {loading && <div className="px-3 text-xs text-[var(--text-3)]"><Loader2 className="h-3 w-3 inline-block animate-spin mr-1" />loading…</div>}
        {!loading && versions.length === 0 && (
          <div className="px-3 text-xs italic-serif text-[var(--text-3)]">
            {selectedPath ? "No history for this file." : "Pick a file on the left."}
          </div>
        )}
        <ul>
          {versions.map((v, i) => {
            const isA = compareA === v.version_id;
            const isB = compareB === v.version_id;
            return (
              <li key={v.version_id} className="border-b border-[var(--border)] last:border-b-0">
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`chip !text-[9px] ${i === 0 ? "chip-emerald" : ""}`}>
                      {i === 0 ? "latest" : `#${versions.length - i}`}
                    </span>
                    <span className="chip !text-[9px] !px-1.5">{v.source}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                    <Clock className="h-2.5 w-2.5" strokeWidth={1.8} />
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                    <User className="h-2.5 w-2.5" strokeWidth={1.8} />
                    {v.changed_by_name || "—"} · {v.bytes}B
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      data-testid={`history-pick-a-${v.version_id}`}
                      onClick={() => setCompareA(isA ? null : v.version_id)}
                      className={`flex-1 text-[10px] rounded-md border px-2 py-1 transition-colors ${isA ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}
                    >{isA ? "A ✓" : "As A"}</button>
                    <button
                      data-testid={`history-pick-b-${v.version_id}`}
                      onClick={() => setCompareB(isB ? null : v.version_id)}
                      className={`flex-1 text-[10px] rounded-md border px-2 py-1 transition-colors ${isB ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}
                    >{isB ? "B ✓" : "As B"}</button>
                    <button
                      data-testid={`history-restore-${v.version_id}`}
                      onClick={() => restore(v.version_id)}
                      disabled={restoring === v.version_id || i === 0}
                      title={i === 0 ? "Already latest" : "Restore this version"}
                      className="flex-1 text-[10px] btn btn-primary !py-1 !px-2 disabled:opacity-40"
                    >
                      {restoring === v.version_id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5" strokeWidth={2} />}
                      Restore
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Diff column */}
      <div className="overflow-auto" data-testid="history-diff">
        <div className="sticky top-0 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between z-10">
          <div className="overline !text-[var(--text-3)]">
            {diffMode === "unified" ? "Unified diff" : "Side-by-side"} {compareA || compareB ? <span className="mono normal-case ml-1">· A={compareA?.slice(-6) || "prev"} → B={compareB?.slice(-6) || "current"}</span> : <span className="italic-serif normal-case ml-1 text-[var(--text-3)]">previous → current</span>}
          </div>
          <div className="flex gap-1 border border-[var(--border)] rounded-full p-1">
            <button
              data-testid="diff-mode-side"
              onClick={() => setDiffMode("side")}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-colors flex items-center gap-1 ${diffMode === "side" ? "bg-[var(--brand)] text-[#050505] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
              title="Side-by-side"
            ><Columns className="h-2.5 w-2.5" strokeWidth={2} />Side-by-side</button>
            <button
              data-testid="diff-mode-unified"
              onClick={() => setDiffMode("unified")}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-colors flex items-center gap-1 ${diffMode === "unified" ? "bg-[var(--brand)] text-[#050505] font-semibold" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
              title="Unified"
            ><SplitSquareHorizontal className="h-2.5 w-2.5" strokeWidth={2} />Unified</button>
          </div>
        </div>
        {!selectedPath ? (
          <div className="p-8 text-center text-[var(--text-3)] italic-serif">Select a file to see changes.</div>
        ) : diffMode === "unified" ? (
          <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap" data-testid="diff-unified">
            {(diffText || "(no differences)").split("\n").map((line, i) => {
              let cls = "text-[var(--text-2)]";
              if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-[var(--emerald)] bg-[var(--emerald)]/8 px-1";
              else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-[#ff6a6a] bg-[#ff6a6a]/8 px-1";
              else if (line.startsWith("@@")) cls = "text-[var(--gold)]";
              else if (line.startsWith("+++") || line.startsWith("---")) cls = "text-[var(--text-3)]";
              return <div key={i} className={cls}>{line || " "}</div>;
            })}
          </pre>
        ) : (
          <SideBySideDiff rows={sideRows} />
        )}
      </div>
    </div>
  );
}

/* ----- side-by-side renderer ----- */
function SideBySideDiff({ rows }) {
  if (!rows.length) {
    return <div className="p-8 text-center text-[var(--text-3)] italic-serif">(no differences)</div>;
  }
  return (
    <div className="text-[11px] font-mono leading-relaxed" data-testid="diff-side">
      <div className="grid grid-cols-2 sticky top-[37px] bg-[var(--surface-2)] border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--text-3)]">
        <div className="px-3 py-1.5 border-r border-[var(--border)]">A (before)</div>
        <div className="px-3 py-1.5">B (after)</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2">
          <DiffCell side="left"  line={r.left}  kind={r.leftKind} />
          <DiffCell side="right" line={r.right} kind={r.rightKind} />
        </div>
      ))}
    </div>
  );
}

function DiffCell({ line, kind }) {
  const bg =
    kind === "del"    ? "bg-[#ff6a6a]/10" :
    kind === "ins"    ? "bg-[var(--emerald)]/10" :
    kind === "change" ? "bg-[var(--gold)]/8"     : "";
  const text =
    kind === "del"    ? "text-[#ff6a6a]"     :
    kind === "ins"    ? "text-[var(--emerald)]" :
    kind === "change" ? "text-[var(--gold)]"    : "text-[var(--text-2)]";
  return (
    <div className={`px-3 py-0.5 border-r last:border-r-0 border-[var(--border)] ${bg}`}>
      <span className={`whitespace-pre-wrap break-all ${text}`}>{line ?? " "}</span>
    </div>
  );
}

/** Parse a unified-diff string into aligned side-by-side rows. */
function parseDiffToSideBySide(diff) {
  const sideRows = [];
  if (!diff || !diff.trim()) return { sideRows };
  const lines = diff.split("\n");
  let hunk = { del: [], add: [] };
  const flush = () => {
    const n = Math.max(hunk.del.length, hunk.add.length);
    for (let i = 0; i < n; i++) {
      const L = hunk.del[i]; const R = hunk.add[i];
      const leftKind  = L !== undefined ? (R !== undefined ? "change" : "del") : null;
      const rightKind = R !== undefined ? (L !== undefined ? "change" : "ins") : null;
      sideRows.push({ left: L ?? "", leftKind, right: R ?? "", rightKind });
    }
    hunk = { del: [], add: [] };
  };
  for (const raw of lines) {
    if (raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("@@")) {
      flush();
      continue;
    }
    if (raw.startsWith("-")) hunk.del.push(raw.slice(1));
    else if (raw.startsWith("+")) hunk.add.push(raw.slice(1));
    else {
      flush();
      const ctx = raw.startsWith(" ") ? raw.slice(1) : raw;
      sideRows.push({ left: ctx, leftKind: null, right: ctx, rightKind: null });
    }
  }
  flush();
  return { sideRows };
}

/* ================== Snapshots tab (whole-project) ================== */
function SnapshotsTab({ projectId, onClose }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/projects/${projectId}/snapshots`, { withCredentials: true });
      setSnaps(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load snapshots");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const create = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/api/projects/${projectId}/snapshots`,
        { label: label.trim() || null, description: description.trim() || "" },
        { withCredentials: true });
      setLabel(""); setDescription("");
      toast.success("Snapshot taken");
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Snapshot failed");
    } finally { setBusy(false); }
  };

  const restore = async (sid, snapLabel) => {
    if (!window.confirm(`Restore "${snapLabel}"? Your current files will be overwritten (a safety snapshot is taken automatically).`)) return;
    setRestoring(sid);
    try {
      await axios.post(`${API}/api/projects/${projectId}/snapshots/${sid}/restore`, {}, { withCredentials: true });
      toast.success("Project restored from snapshot");
      await refresh();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Restore failed");
    } finally { setRestoring(null); }
  };

  const del = async (sid) => {
    if (!window.confirm("Delete this snapshot permanently?")) return;
    try {
      await axios.delete(`${API}/api/projects/${projectId}/snapshots/${sid}`, { withCredentials: true });
      toast.success("Snapshot deleted");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };

  return (
    <div className="h-full overflow-y-auto p-6" data-testid="snapshots-tab">
      <div className="max-w-[840px] mx-auto space-y-6">
        <div className="glass rounded-2xl p-6">
          <div className="overline !text-[var(--text-3)] flex items-center gap-2">
            <Camera className="h-3 w-3" strokeWidth={1.8} /> Take a snapshot
          </div>
          <div className="mt-3 text-sm text-[var(--text-2)]">
            Captures <span className="mono">all project files</span> in their current state. One-click restore any time.
          </div>
          <input
            data-testid="snapshot-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional — defaults to timestamp)"
            className="mt-4 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]/50"
          />
          <textarea
            data-testid="snapshot-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="What's in this snapshot? (optional)"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]/50 resize-none"
          />
          <button
            data-testid="snapshot-create"
            onClick={create}
            disabled={busy}
            className="btn btn-primary mt-3 !py-2 !px-5 !text-sm"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Capture snapshot
          </button>
        </div>

        <div>
          <div className="overline !text-[var(--text-3)] mb-3">Saved snapshots · {snaps.length}</div>
          {loading && <div className="text-sm text-[var(--text-3)]"><Loader2 className="h-3.5 w-3.5 inline-block animate-spin mr-1" />loading…</div>}
          {!loading && snaps.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <Camera className="h-5 w-5 mx-auto text-[var(--text-3)] mb-2" strokeWidth={1.5} />
              <div className="serif text-lg" style={{ fontWeight: 500 }}>No snapshots yet</div>
              <div className="text-xs text-[var(--text-3)] mt-1 italic-serif">Capture one above to freeze the project state.</div>
            </div>
          )}
          <div className="space-y-3">
            {snaps.map((s) => (
              <div key={s.snapshot_id} className="glass rounded-xl p-4 flex items-center gap-4" data-testid={`snapshot-${s.snapshot_id}`}>
                <div className="h-11 w-11 rounded-lg border border-[var(--border)] bg-black/40 flex items-center justify-center shrink-0">
                  <Camera className="h-4 w-4 text-[var(--brand)]" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="serif text-base truncate" style={{ fontWeight: 500 }}>{s.label}</div>
                    <span className="chip !text-[9px]">{s.file_count} files</span>
                    <span className="chip !text-[9px]">{(s.total_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                  {s.description && <div className="text-xs text-[var(--text-2)] mt-0.5 line-clamp-1">{s.description}</div>}
                  <div className="text-[10px] text-[var(--text-3)] mono mt-1">
                    {new Date(s.created_at).toLocaleString()} · {s.created_by_name}
                  </div>
                </div>
                <button
                  data-testid={`snapshot-restore-${s.snapshot_id}`}
                  onClick={() => restore(s.snapshot_id, s.label)}
                  disabled={restoring === s.snapshot_id}
                  className="btn btn-primary !py-1.5 !px-3 !text-xs"
                >
                  {restoring === s.snapshot_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" strokeWidth={2} />}
                  Restore
                </button>
                <button
                  data-testid={`snapshot-delete-${s.snapshot_id}`}
                  onClick={() => del(s.snapshot_id)}
                  className="rounded-lg border border-[var(--border)] p-2 hover:border-[#ff6a6a]/50 hover:text-[#ff6a6a] transition-colors"
                  title="Delete snapshot"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
