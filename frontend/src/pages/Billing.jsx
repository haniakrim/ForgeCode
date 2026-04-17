import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowUpRight, Sparkles, Check, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

const tierMeta = {
  studio: {
    highlight: true,
    tagline: "For indie builders shipping weekly.",
    perks: ["2,000 credits / month", "Unlimited private projects", "GitHub ZIP export", "Priority compute"],
  },
  maison: {
    highlight: false,
    tagline: "For studios and small teams.",
    perks: ["10,000 credits / month", "Team collaboration (soon)", "Custom domains", "Dedicated SLA"],
  },
  topup_small: {
    highlight: false,
    tagline: "One-time top-up.",
    perks: ["500 credits", "Never expires", "Stacks with your plan"],
  },
  topup_large: {
    highlight: false,
    tagline: "One-time top-up, best value.",
    perks: ["2,000 credits", "Never expires", "Stacks with your plan"],
  },
};

export default function Billing() {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/payments/packages").then(({ data }) => setPackages(data)).catch(() => {});
  }, []);

  const checkout = async (pkg) => {
    setLoadingId(pkg.package_id);
    try {
      const { data } = await api.post("/payments/checkout", {
        package_id: pkg.package_id,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Checkout failed");
      setLoadingId(null);
    }
  };

  const plans = packages.filter((p) => p.package_id === "studio" || p.package_id === "maison");
  const packs = packages.filter((p) => p.package_id.startsWith("topup_"));

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-14" data-testid="billing-page">
        <div className="fade-up">
          <div className="overline">Billing</div>
          <h1 className="serif mt-4 text-5xl md:text-6xl" style={{ fontWeight: 400 }}>
            Choose your<br /><span className="italic-serif gradient-text">instrument.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[var(--text-2)]">
            Current tier: <span className="chip chip-brand ml-1">{user?.tier || "atelier"}</span> ·
            <span className="ml-2">{user?.credits ?? 0} credits remaining</span>
          </p>
        </div>

        {/* Subscription tiers */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-3xl p-8">
            <div className="serif text-3xl" style={{ fontWeight: 500 }}>Atelier</div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="mono text-[var(--text-3)]">$</span>
              <span className="serif text-6xl" style={{ fontWeight: 500 }}>0</span>
              <span className="text-[var(--text-3)]"> / forever</span>
            </div>
            <div className="divider my-6" />
            <ul className="space-y-3 text-sm text-[var(--text-2)]">
              {["100 credits / month", "Public projects", "Community support", "Claude Sonnet 4.5"].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-[var(--brand)] mt-0.5" strokeWidth={2} /> <span>{f}</span></li>
              ))}
            </ul>
            <div className="mt-8 text-center text-sm text-[var(--text-3)]">Current free tier</div>
          </div>

          {plans.map((pkg) => {
            const meta = tierMeta[pkg.package_id] || {};
            return (
              <div
                key={pkg.package_id}
                data-testid={`plan-${pkg.package_id}`}
                className={`relative rounded-3xl p-8 ${
                  meta.highlight
                    ? "bg-[var(--surface)] border border-[var(--brand)]/30 shadow-[0_30px_80px_-20px_rgba(242,92,5,0.3)]"
                    : "glass"
                }`}
              >
                {meta.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 chip chip-brand">
                    <Sparkles className="h-3 w-3" strokeWidth={1.5} /> most chosen
                  </div>
                )}
                <div className="serif text-3xl" style={{ fontWeight: 500 }}>{pkg.name}</div>
                <div className="mt-1 text-sm text-[var(--text-3)]">{meta.tagline}</div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="mono text-[var(--text-3)]">$</span>
                  <span className="serif text-6xl" style={{ fontWeight: 500 }}>{pkg.amount}</span>
                  <span className="text-[var(--text-3)]"> / month</span>
                </div>
                <div className="divider my-6" />
                <ul className="space-y-3 text-sm text-[var(--text-2)]">
                  {(meta.perks || []).map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-[var(--brand)] mt-0.5" strokeWidth={2} /> <span>{f}</span></li>
                  ))}
                </ul>
                <button
                  onClick={() => checkout(pkg)}
                  disabled={loadingId === pkg.package_id}
                  data-testid={`checkout-${pkg.package_id}`}
                  className={`mt-8 w-full btn ${meta.highlight ? "btn-primary" : "btn-ghost"}`}
                >
                  {loadingId === pkg.package_id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting...</>
                  ) : (
                    <>Choose {pkg.name} <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Top-up packs */}
        <div className="mt-20">
          <div className="overline">One-time top-ups</div>
          <h2 className="serif mt-3 text-3xl md:text-4xl" style={{ fontWeight: 400 }}>Need more <span className="italic-serif">credits</span>?</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {packs.map((pkg) => (
              <div key={pkg.package_id} data-testid={`pack-${pkg.package_id}`} className="glass glass-hover rounded-2xl p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl border border-[var(--border)] bg-black/40 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="serif text-xl" style={{ fontWeight: 500 }}>{pkg.label}</div>
                    <div className="text-sm text-[var(--text-3)]">${pkg.amount} · one-time</div>
                  </div>
                </div>
                <button
                  onClick={() => checkout(pkg)}
                  disabled={loadingId === pkg.package_id}
                  data-testid={`checkout-${pkg.package_id}`}
                  className="btn btn-primary !py-2 !px-4 !text-sm"
                >
                  {loadingId === pkg.package_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-[var(--text-3)] mono">
          Payments powered by Stripe · test mode · no real cards charged
        </div>
      </div>
    </div>
  );
}
