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
    if (!match) {
      navigate("/", { replace: true });
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        setUser(data.user);
        // Clear fragment and redirect
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (e) {
        console.error("Auth exchange failed", e);
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#F4F4F0]">
      <div className="brut bg-white p-10">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[authenticating]</div>
        <div className="mt-3 text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          Exchanging tokens<span className="caret"></span>
        </div>
      </div>
    </div>
  );
}
