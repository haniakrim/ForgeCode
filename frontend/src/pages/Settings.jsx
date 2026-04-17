import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Mail, User2, Coins, Shield, ArrowUpRight } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="mx-auto max-w-[1000px] px-6 md:px-10 py-14" data-testid="settings-page">
        <div className="fade-up">
          <div className="overline">Workbench</div>
          <h1 className="serif mt-4 text-5xl md:text-6xl" style={{ fontWeight: 400 }}>
            Settings &<br /><span className="italic-serif gradient-text">preferences.</span>
          </h1>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="glass rounded-2xl p-7 md:col-span-2">
            <div className="overline">Profile</div>
            <div className="mt-5 flex items-center gap-5">
              {user.picture ? (
                <img src={user.picture} alt="" className="h-20 w-20 rounded-full object-cover border border-[var(--border)]" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--gold)]"></div>
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

          {/* Credits */}
          <div className="glass rounded-2xl p-7 noise relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--brand)]/20 blur-3xl" />
            <div className="relative">
              <div className="overline">Credits</div>
              <div className="mt-3 flex items-baseline gap-3">
                <Coins className="h-8 w-8 text-[var(--brand)]" strokeWidth={1.3} />
                <div className="serif text-6xl gradient-text" style={{ fontWeight: 500 }}>{user.credits}</div>
              </div>
              <div className="mt-2 text-sm text-[var(--text-2)]">Each message ≈ 1 credit. Refills reset monthly on paid plans.</div>
              <button className="btn btn-primary mt-5 w-full" data-testid="upgrade-btn">
                Buy credits <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Danger zone */}
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
      </div>
    </div>
  );
}
