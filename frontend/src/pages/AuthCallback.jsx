// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/", { replace: true }); return; }
    const sessionId = match[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        setUser(data.user);
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (e) {
        console.error("Auth exchange failed", e);
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
      <div className="glass rounded-2xl p-12 text-center">
        <div className="overline">authenticating</div>
        <div className="serif mt-3 text-3xl">
          Exchanging tokens<span className="caret"></span>
        </div>
        <div className="mt-2 text-sm text-[var(--text-2)]">One second. Setting your workspace up.</div>
      </div>
    </div>
  );
}
