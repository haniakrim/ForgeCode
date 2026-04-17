import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Coins, LogOut, Terminal } from "lucide-react";

export const Navbar = ({ variant = "app" }) => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      data-testid="main-navbar"
      className="sticky top-0 z-40 border-b-2 border-black bg-[#F4F4F0]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2" data-testid="nav-logo">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-[#FF3311] text-white">
            <Terminal className="h-4 w-4" strokeWidth={3} />
          </div>
          <span className="text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
            FORGE<span className="text-[#FF3311]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-bold uppercase tracking-widest md:flex">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-[#FF3311]" data-testid="nav-dashboard">Dashboard</Link>
              <Link to="/templates" className="hover:text-[#FF3311]" data-testid="nav-templates">Templates</Link>
              <Link to="/settings" className="hover:text-[#FF3311]" data-testid="nav-settings">Settings</Link>
            </>
          ) : (
            <>
              <a href="#features" className="hover:text-[#FF3311]">Features</a>
              <a href="#pricing" className="hover:text-[#FF3311]">Pricing</a>
              <a href="#manifesto" className="hover:text-[#FF3311]">Manifesto</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div
                data-testid="credits-display"
                className="hidden items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest md:flex"
              >
                <Coins className="h-3.5 w-3.5 text-[#FF3311]" strokeWidth={3} />
                {user.credits} credits
              </div>
              <button
                onClick={logout}
                data-testid="logout-btn"
                className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-[#0A0A0A] hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={3} />
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={login} data-testid="nav-login-btn" className="text-xs font-bold uppercase tracking-widest hover:text-[#FF3311]">
                Sign in
              </button>
              <button onClick={login} data-testid="nav-cta-btn" className="btn-primary !py-2 !px-4 !text-xs">
                Start Building
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
