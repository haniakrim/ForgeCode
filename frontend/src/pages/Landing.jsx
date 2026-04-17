import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
import {
  ArrowUpRight, Sparkles, Zap, Code2, Eye, GitBranch, Cpu, Layers,
  CircleDot, Quote, Terminal, ChevronRight
} from "lucide-react";
import { SiReact, SiFastapi, SiMongodb, SiTailwindcss, SiTypescript, SiVercel, SiGithub, SiPython, SiJavascript, SiDocker } from "react-icons/si";

// ---------------------- Hero ----------------------
const Hero = () => {
  const { login } = useAuth();
  return (
    <section className="relative overflow-hidden pt-28 md:pt-36">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="grid grid-cols-12 gap-10 items-start">
          <div className="col-span-12 lg:col-span-7">
            <div className="overline fade-up pulse-dot">Claude Sonnet 4.5 · live</div>
            <h1 className="fade-up d-1 serif mt-6 text-6xl md:text-8xl" style={{ lineHeight: 0.95, fontWeight: 400 }}>
              Your next app,<br />
              <span className="italic-serif gradient-text">authored</span> by an<br />
              <span className="italic-serif">intelligence</span>.
            </h1>
            <p className="fade-up d-2 mt-8 max-w-xl text-lg text-[var(--text-2)] leading-relaxed">
              Forge is a studio where ideas become software. Describe what you
              imagine — in a sentence, in a paragraph, half-formed — and watch
              as React, FastAPI and MongoDB compose themselves into a working product.
            </p>
            <div className="fade-up d-3 mt-10 flex flex-wrap items-center gap-3">
              <button onClick={login} data-testid="hero-start-btn" className="btn btn-primary !px-6 !py-3.5 text-base">
                Begin a composition <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <a href="#demo" className="btn btn-ghost !px-5 !py-3.5 text-base">
                <CircleDot className="h-3.5 w-3.5 text-[var(--emerald)]" strokeWidth={2} />
                Watch the demo
              </a>
            </div>
            <div className="fade-up d-4 mt-12 flex items-center gap-6 text-sm text-[var(--text-3)]">
              <div><span className="serif text-[var(--text)] text-3xl">9,420</span><div className="text-xs">apps forged</div></div>
              <div className="h-8 w-px bg-[var(--border)]" />
              <div><span className="serif text-[var(--text)] text-3xl">42s</span><div className="text-xs">avg. build</div></div>
              <div className="h-8 w-px bg-[var(--border)]" />
              <div><span className="serif text-[var(--text)] text-3xl italic-serif">100%</span><div className="text-xs">code you own</div></div>
            </div>
          </div>

          {/* Floating composition card */}
          <div className="col-span-12 lg:col-span-5 fade-up d-2">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(242,92,5,0.25),transparent_70%)]" />
              <div className="glass rounded-3xl p-1.5 noise">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--emerald)]/80" />
                  </div>
                  <div className="mono text-xs text-[var(--text-3)]">forge.studio / untitled-04</div>
                  <Terminal className="h-3.5 w-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
                </div>
                <div className="rounded-2xl bg-black/50 p-5 mono text-[13px] leading-7 min-h-[340px] border border-white/5">
                  <div className="text-[var(--text-2)]"><span className="text-[var(--brand)]">you</span> — build a recipe-sharing app with social login and a feed</div>
                  <div className="mt-4 text-[var(--text-3)]">forge — thinking<span className="caret"></span></div>
                  <div className="mt-3 text-[var(--text-2)]"><span className="text-[var(--emerald)]">✓</span> scaffolding react + fastapi</div>
                  <div className="text-[var(--text-2)]"><span className="text-[var(--emerald)]">✓</span> models: recipe, user, follow, like</div>
                  <div className="text-[var(--text-2)]"><span className="text-[var(--emerald)]">✓</span> routes: /api/recipes · /api/auth · /api/feed</div>
                  <div className="text-[var(--text-2)]"><span className="text-[var(--emerald)]">✓</span> ui: feed · detail · composer · profile</div>
                  <div className="mt-4 text-[var(--gold)]">→ shipped in 38s · preview → localhost:3000</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between px-2">
                <div className="mono text-xs text-[var(--text-3)]">// composition.archive · 02.2026</div>
                <div className="chip chip-emerald">● running</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------- Marquee ----------------------
const Marquee = () => {
  const logos = [
    { I: SiReact, n: "React 19" }, { I: SiFastapi, n: "FastAPI" },
    { I: SiMongodb, n: "MongoDB" }, { I: SiTailwindcss, n: "Tailwind" },
    { I: SiTypescript, n: "TypeScript" }, { I: SiVercel, n: "Vercel" },
    { I: SiGithub, n: "GitHub" }, { I: SiPython, n: "Python" },
    { I: SiJavascript, n: "JavaScript" }, { I: SiDocker, n: "Docker" },
  ];
  return (
    <section className="mt-28 py-8 border-y border-[var(--border)]">
      <div className="marquee">
        {[0, 1, 2].map((k) => (
          <div className="marquee-track" key={k}>
            {logos.map(({ I, n }, i) => (
              <div key={`${k}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-[var(--text-3)]">
                <I className="h-5 w-5" />
                <span className="text-sm tracking-wide">{n}</span>
                <span className="text-[var(--brand)]/60">/</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

// ---------------------- Features ----------------------
const Features = () => {
  const items = [
    { icon: Zap, title: "Agentic authorship", desc: "Forge plans, writes, tests and iterates — across files, until the preview runs.", accent: true, span: "md:col-span-7 md:row-span-2" },
    { icon: Code2, title: "Code you own", desc: "Every file is yours. Export, fork, deploy anywhere.", span: "md:col-span-5" },
    { icon: Eye, title: "Live preview", desc: "Instant browser sandbox. See your idea as you speak it.", span: "md:col-span-5" },
    { icon: Cpu, title: "Claude Sonnet 4.5", desc: "State-of-the-art reasoning. Multi-file edits. Tool use.", span: "md:col-span-4" },
    { icon: GitBranch, title: "Version machine", desc: "Every conversation branches. Rewind and fork without fear.", span: "md:col-span-4" },
    { icon: Layers, title: "Batteries included", desc: "Auth · DB · storage · payments — scaffolded from day one.", span: "md:col-span-4" },
  ];
  return (
    <section id="features" className="py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div>
            <div className="overline">Chapter 02 · capabilities</div>
            <h2 className="serif mt-4 text-5xl md:text-7xl" style={{ fontWeight: 400 }}>
              The craftsmanship<br /><span className="italic-serif gradient-text">built into every line.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[var(--text-2)] text-base">
            Tools that respect your time, your code, and the fact that you&apos;ve shipped things before.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {items.map((it, i) => (
            <div
              key={i}
              data-testid={`feature-${i}`}
              className={`glass glass-hover rounded-2xl p-7 relative overflow-hidden ${it.span} ${it.accent ? "noise" : ""}`}
            >
              {it.accent && (
                <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[var(--brand)]/20 blur-3xl" />
              )}
              <div className="relative">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-black/40">
                  <it.icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5} />
                </div>
                <h3 className="serif mt-6 text-3xl" style={{ fontWeight: 500 }}>{it.title}</h3>
                <p className="mt-3 text-[var(--text-2)] leading-relaxed">{it.desc}</p>
                {it.accent && (
                  <div className="mt-8 mono text-xs text-[var(--text-3)]">
                    <div className="flex items-center gap-2"><ChevronRight className="h-3 w-3 text-[var(--brand)]" /> plans the architecture</div>
                    <div className="flex items-center gap-2"><ChevronRight className="h-3 w-3 text-[var(--brand)]" /> writes the files</div>
                    <div className="flex items-center gap-2"><ChevronRight className="h-3 w-3 text-[var(--brand)]" /> fixes its own mistakes</div>
                    <div className="flex items-center gap-2"><ChevronRight className="h-3 w-3 text-[var(--brand)]" /> ships the preview</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------- How It Works ----------------------
const HowItWorks = () => {
  const steps = [
    { n: "I", t: "Describe", d: "Plain English. A sentence, a paragraph, a half-thought — it doesn&apos;t matter. Forge asks the right questions." },
    { n: "II", t: "Compose", d: "Claude Sonnet 4.5 plans the stack, writes React + FastAPI, wires Mongo, and tests the happy path." },
    { n: "III", t: "Preview", d: "Your app renders live in the right pane. Iterate in conversation — &ldquo;make it dark&rdquo;, &ldquo;add a search bar&rdquo;, &ldquo;use serif fonts&rdquo;." },
    { n: "IV", t: "Ship", d: "Export to GitHub. Deploy anywhere. Your code, your infrastructure, zero lock-in." },
  ];
  return (
    <section id="demo" className="py-32 border-t border-[var(--border)] dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="overline">Chapter 03 · the method</div>
        <h2 className="serif mt-4 text-5xl md:text-7xl" style={{ fontWeight: 400 }}>
          Four movements.<br /><span className="italic-serif">One composition.</span>
        </h2>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative group">
              <div className="serif text-[var(--brand)] text-6xl italic-serif opacity-40 group-hover:opacity-100 transition-opacity duration-500">{s.n}</div>
              <h3 className="serif mt-2 text-2xl" style={{ fontWeight: 500 }}>{s.t}</h3>
              <p className="mt-2 text-[var(--text-2)] text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: s.d }} />
              {i < 3 && (
                <div className="hidden md:block absolute top-6 right-0 translate-x-1/2 text-[var(--border-strong)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------- Pricing ----------------------
const Pricing = () => {
  const { login } = useAuth();
  const tiers = [
    { name: "Atelier", price: "0", freq: "forever", feats: ["100 credits / month", "Public compositions", "Community support", "Claude Sonnet 4.5"], cta: "Start free", highlight: false },
    { name: "Studio", price: "29", freq: "month", feats: ["2,000 credits / month", "Unlimited private projects", "GitHub export", "Priority compute"], cta: "Choose Studio", highlight: true },
    { name: "Maison", price: "99", freq: "month", feats: ["10,000 credits / month", "Team collaboration", "Custom domains", "Dedicated SLA"], cta: "Choose Maison", highlight: false },
  ];
  return (
    <section id="pricing" className="py-32 border-t border-[var(--border)]">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="overline">Chapter 04 · pricing</div>
          <h2 className="serif mt-4 text-5xl md:text-7xl" style={{ fontWeight: 400 }}>
            Pay for <span className="italic-serif gradient-text">output</span>,<br />not promises.
          </h2>
          <p className="mt-6 text-[var(--text-2)]">Credits convert to real apps. No seat counts, no feature gating theatre.</p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              data-testid={`pricing-${t.name.toLowerCase()}`}
              className={`relative rounded-3xl p-8 ${
                t.highlight
                  ? "bg-[#0C0C0C] border border-[var(--brand)]/30 shadow-[0_30px_80px_-20px_rgba(242,92,5,0.3)]"
                  : "glass"
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 chip chip-brand">
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} /> most chosen
                </div>
              )}
              <div className="serif text-3xl" style={{ fontWeight: 500 }}>{t.name}</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="mono text-[var(--text-3)]">$</span>
                <span className="serif text-6xl" style={{ fontWeight: 500 }}>{t.price}</span>
                <span className="text-[var(--text-3)]"> / {t.freq}</span>
              </div>
              <div className="divider my-6" />
              <ul className="space-y-3 text-sm text-[var(--text-2)]">
                {t.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-[var(--brand)] mt-0.5">◆</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={login}
                className={`mt-8 w-full btn ${t.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                {t.cta} <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------- Manifesto ----------------------
const Manifesto = () => (
  <section id="manifesto" className="py-32 border-t border-[var(--border)]">
    <div className="mx-auto max-w-[1100px] px-6 md:px-10">
      <div className="overline text-center">Chapter 05 · the manifesto</div>
      <h2 className="serif mt-4 text-center text-5xl md:text-6xl italic-serif leading-tight">
        &ldquo;Software should be described<br />like furniture —<br />
        <span className="gradient-text">then delivered assembled.</span>&rdquo;
      </h2>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 text-[var(--text-2)] leading-relaxed">
        <div>
          <p><span className="serif text-3xl text-[var(--text)] italic-serif">I.</span> Every app worth building has been built ten thousand times. You are not meant to assemble flat-pack components. You are meant to place the order.</p>
          <p className="mt-5"><span className="serif text-3xl text-[var(--text)] italic-serif">II.</span> An AI that writes code is only useful if it ships code. We measure ourselves in running applications, not tokens produced.</p>
        </div>
        <div>
          <p><span className="serif text-3xl text-[var(--text)] italic-serif">III.</span> What you build is yours. We don&apos;t hide code. We don&apos;t lock exports. Every generated file exits through the front door.</p>
          <p className="mt-5"><span className="serif text-3xl text-[var(--text)] italic-serif">IV.</span> Taste is not optional. The tool must feel like an instrument, not a vending machine. This is why we chose a serif.</p>
        </div>
      </div>
      <div className="mt-12 text-center mono text-sm text-[var(--text-3)]">— the forge atelier · brooklyn · bangalore · berlin</div>
    </div>
  </section>
);

// ---------------------- Testimonials ----------------------
const Testimonials = () => {
  const quotes = [
    { q: "I shipped three client projects in a weekend. My retainer went up.", n: "Ada Okonkwo", r: "Freelance Engineer", src: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
    { q: "It wrote my internal tool in six minutes. I wrote it in two weeks last time.", n: "Marcus Vela", r: "PM at fintech", src: "https://images.unsplash.com/photo-1769636929388-99eff95d3bf1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
    { q: "The generated code is actually readable. That alone is worth the subscription.", n: "Priya Raman", r: "Staff Engineer", src: "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
  ];
  return (
    <section className="py-32 border-t border-[var(--border)]">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="overline">Chapter 06 · field reports</div>
        <h2 className="serif mt-4 text-5xl md:text-7xl" style={{ fontWeight: 400 }}>
          From the people<br /><span className="italic-serif">who actually ship.</span>
        </h2>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((q, i) => (
            <div key={i} className="glass glass-hover rounded-2xl p-8">
              <Quote className="h-6 w-6 text-[var(--brand)]" strokeWidth={1.3} />
              <p className="serif mt-5 text-xl leading-snug" style={{ fontWeight: 400 }}>&ldquo;{q.q}&rdquo;</p>
              <div className="mt-8 flex items-center gap-3 pt-5 border-t border-[var(--border)]">
                <img src={q.src} alt={q.n} className="h-10 w-10 rounded-full object-cover border border-[var(--border)]" />
                <div>
                  <div className="text-sm font-medium">{q.n}</div>
                  <div className="text-xs text-[var(--text-3)]">{q.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------- CTA ----------------------
const CTA = () => {
  const { login } = useAuth();
  return (
    <section className="py-32 border-t border-[var(--border)]">
      <div className="mx-auto max-w-[1000px] px-6 md:px-10 text-center">
        <div className="overline">Epilogue</div>
        <h2 className="serif mt-6 text-6xl md:text-8xl" style={{ fontWeight: 400, lineHeight: 0.95 }}>
          Stop reading.<br /><span className="italic-serif gradient-text">Start forging.</span>
        </h2>
        <p className="mt-6 text-[var(--text-2)] max-w-xl mx-auto">
          Your first hundred credits are on the house. Bring an idea. Leave with a running application.
        </p>
        <button onClick={login} data-testid="bottom-cta-btn" className="btn btn-primary mt-10 !px-7 !py-4 text-base">
          Open the studio <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
};

// ---------------------- Footer ----------------------
const Footer = () => (
  <footer className="border-t border-[var(--border)] py-16 mt-8">
    <div className="mx-auto max-w-[1400px] px-6 md:px-10 grid grid-cols-2 md:grid-cols-5 gap-10 text-sm">
      <div className="col-span-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]">
            <Sparkles className="h-3.5 w-3.5 text-[#050505]" strokeWidth={2} />
          </div>
          <span className="serif text-2xl">Forge<span className="italic-serif text-[var(--brand)]">.</span></span>
        </div>
        <p className="mt-4 max-w-sm text-[var(--text-2)]">An atelier for software. Designed by developers who&apos;ve already typed <span className="mono text-xs">yarn create</span> more times than they&apos;ve slept.</p>
      </div>
      <div>
        <div className="overline mb-4">Product</div>
        <ul className="space-y-2 text-[var(--text-2)]"><li className="hover:text-[var(--text)] cursor-pointer">Studio</li><li className="hover:text-[var(--text)] cursor-pointer">Templates</li><li className="hover:text-[var(--text)] cursor-pointer">Pricing</li><li className="hover:text-[var(--text)] cursor-pointer">Changelog</li></ul>
      </div>
      <div>
        <div className="overline mb-4">Atelier</div>
        <ul className="space-y-2 text-[var(--text-2)]"><li className="hover:text-[var(--text)] cursor-pointer">Manifesto</li><li className="hover:text-[var(--text)] cursor-pointer">Careers</li><li className="hover:text-[var(--text)] cursor-pointer">Contact</li><li className="hover:text-[var(--text)] cursor-pointer">Press</li></ul>
      </div>
      <div>
        <div className="overline mb-4">Legal</div>
        <ul className="space-y-2 text-[var(--text-2)]"><li className="hover:text-[var(--text)] cursor-pointer">Terms</li><li className="hover:text-[var(--text)] cursor-pointer">Privacy</li><li className="hover:text-[var(--text)] cursor-pointer">Security</li></ul>
      </div>
    </div>
    <div className="mx-auto max-w-[1400px] px-6 md:px-10 mt-12 pt-6 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-[var(--text-3)] mono">
      <div>© 2026 Forge Atelier · all rights composed</div>
      <div className="flex items-center gap-2"><span className="pulse-dot">status: nominal</span></div>
    </div>
  </footer>
);

export default function Landing() {
  return (
    <div className="relative">
      <Navbar variant="landing" />
      <Hero />
      <Marquee />
      <Features />
      <HowItWorks />
      <Pricing />
      <Manifesto />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
