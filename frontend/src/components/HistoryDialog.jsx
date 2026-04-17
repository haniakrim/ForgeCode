import { useEffect, useState } from "react";
import { X, History, RotateCcw, FileCode2, Loader2, Clock, User } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * File history + diff + rollback dialog.
 * Props:
 *   projectId, onClose, initialPath (optional)
 */
export function HistoryDialog({ projectId, onClose, initialPath = null }) {
  const [versions, setVersions] = useState([]);
  const [paths, setPaths] = useState([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [compareA, setCompareA] = useState(null); // version_id of older
  const [compareB, setCompareB] = useState(null); // version_id of newer (null = current)

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
      setDiff(r.data.diff || "(no differences)");
    } catch (e) {
      setDiff(`# error: ${e?.response?.data?.detail || e.message}`);
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

  return (
    <div
      data-testid="history-dialog"
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-stretch p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1200px] h-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <div className="overline !text-[var(--text-3)]">Point-in-time history</div>
            <div className="serif text-2xl mt-1" style={{ fontWeight: 500 }}>
              <History className="h-5 w-5 inline-block mr-2 text-[var(--brand)]" strokeWidth={1.8} />
              File versions & rollback
            </div>
          </div>
          <button onClick={onClose} data-testid="history-close" className="rounded-full border border-[var(--border)] p-2 hover:border-[var(--brand)]/40 transition-colors">
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-[280px_260px_1fr] overflow-hidden">
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
            <div className="p-3 overline !text-[var(--text-3)] sticky top-0 bg-[var(--bg)]">
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
                        >
                          {isA ? "A ✓" : "As A"}
                        </button>
                        <button
                          data-testid={`history-pick-b-${v.version_id}`}
                          onClick={() => setCompareB(isB ? null : v.version_id)}
                          className={`flex-1 text-[10px] rounded-md border px-2 py-1 transition-colors ${isB ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}
                        >
                          {isB ? "B ✓" : "As B"}
                        </button>
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
            <div className="sticky top-0 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
              <div className="overline !text-[var(--text-3)]">
                Unified diff {compareA || compareB ? <span className="mono normal-case ml-1">· A={compareA?.slice(-6) || "prev"} → B={compareB?.slice(-6) || "current"}</span> : <span className="italic-serif normal-case ml-1 text-[var(--text-3)]">default: previous → current</span>}
              </div>
            </div>
            {!selectedPath ? (
              <div className="p-8 text-center text-[var(--text-3)] italic-serif">Select a file to see changes.</div>
            ) : (
              <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                {diff.split("\n").map((line, i) => {
                  let cls = "text-[var(--text-2)]";
                  if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-[var(--emerald)] bg-[var(--emerald)]/8 px-1";
                  else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-[#ff6a6a] bg-[#ff6a6a]/8 px-1";
                  else if (line.startsWith("@@")) cls = "text-[var(--gold)]";
                  else if (line.startsWith("+++") || line.startsWith("---")) cls = "text-[var(--text-3)]";
                  return <div key={i} className={cls}>{line || " "}</div>;
                })}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
