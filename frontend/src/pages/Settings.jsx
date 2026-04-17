import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Mail, User2, Coins, Shield } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-[900px] px-6 py-10" data-testid="settings-page">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[settings]</div>
        <h1 className="mt-2 text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          Your workbench.
        </h1>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="brut bg-white p-6 md:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">// profile</div>
            <div className="mt-4 flex items-center gap-4">
              {user.picture ? (
                <img src={user.picture} alt="" className="h-16 w-16 border-2 border-black object-cover" />
              ) : (
                <div className="h-16 w-16 border-2 border-black bg-[#FF3311]"></div>
              )}
              <div>
                <div className="text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{user.name}</div>
                <div className="text-sm text-[#555]">{user.email}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="border-2 border-black p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555]"><User2 className="h-3 w-3" /> user id</div>
                <div className="mt-1 font-mono text-xs truncate">{user.user_id}</div>
              </div>
              <div className="border-2 border-black p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555]"><Mail className="h-3 w-3" /> email</div>
                <div className="mt-1 font-mono text-xs truncate">{user.email}</div>
              </div>
            </div>
          </div>

          <div className="brut bg-[#0A0A0A] text-white p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF3311]">// credits</div>
            <div className="mt-2 flex items-center gap-2">
              <Coins className="h-7 w-7 text-[#FF3311]" strokeWidth={2.5} />
              <div className="text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{user.credits}</div>
            </div>
            <div className="mt-2 text-xs text-[#aaa]">Each message ≈ 1 credit. Upgrade anytime.</div>
            <button className="mt-4 w-full border-2 border-white bg-[#FF3311] px-3 py-2 text-xs font-bold uppercase tracking-widest" data-testid="upgrade-btn">Buy more</button>
          </div>

          <div className="brut bg-white p-6 md:col-span-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">// danger zone</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[#FF3311]" strokeWidth={2.5} />
                <div>
                  <div className="text-sm font-bold">Sign out of this device</div>
                  <div className="text-xs text-[#555]">Your session cookie will be cleared.</div>
                </div>
              </div>
              <button onClick={logout} className="btn-secondary" data-testid="settings-logout-btn">Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
