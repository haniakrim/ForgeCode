import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Coins, LogOut, Sparkles, Moon, Sun } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

export const Navbar = ({ variant = "app" }) => {
  const { user, logout, login } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header
      data-testid="main-navbar"
      className="sticky top-0 z-50 w-full"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 pt-5 md:px-10">
        <div className="glass flex w-full items-center justify-between rounded-full px-5 py-2.5">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" data-testid="nav-logo">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]">
              <Sparkles className="h-3.5 w-3.5 text-[#050505]" strokeWidth={2} />
            </div>
            <span className="serif text-xl" style={{ fontWeight: 500 }}>
              Forge<span className="italic-serif text-[var(--brand)]">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            {user ? (
              <>
                <Link to="/dashboard" className="link" data-testid="nav-dashboard">Dashboard</Link>
                <Link to="/templates" className="link" data-testid="nav-templates">Templates</Link>
                <Link to="/billing" className="link" data-testid="nav-billing">Billing</Link>
                <Link to="/settings" className="link" data-testid="nav-settings">Settings</Link>
              </>
            ) : (
              <>
                <a href="#features" className="link">Features</a>
                <a href="#pricing" className="link">Pricing</a>
                <a href="#manifesto" className="link">Manifesto</a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              data-testid="theme-toggle"
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-2 hover:border-[var(--brand)] transition-colors"
              title={theme === "noir" ? "Switch to Daylight" : "Switch to Noir"}
              aria-label="Toggle theme"
            >
              {theme === "noir" ? (
                <Sun className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.8} />
              ) : (
                <Moon className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.8} />
              )}
            </button>
            {user ? (
              <>
                <div
                  data-testid="credits-display"
                  className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-black/40 px-3 py-1 text-xs md:flex"
                >
                  <Coins className="h-3.5 w-3.5 text-[var(--brand)]" strokeWidth={1.8} />
                  <span className="mono">{user.credits}</span>
                </div>
                <NotificationBell />
                <button onClick={logout} data-testid="logout-btn" className="btn btn-ghost !py-1.5 !px-3">
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={login} data-testid="nav-login-btn" className="hidden text-sm text-[var(--text-2)] hover:text-[var(--text)] md:inline">
                  Sign in
                </button>
                <button onClick={login} data-testid="nav-cta-btn" className="btn btn-primary !py-2 !px-4">
                  Start building
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
