import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
import {
  Zap, Code2, Eye, GitBranch, Cpu, Layers,
  ArrowUpRight, Terminal, Sparkles, CircleDot
} from "lucide-react";
import { SiReact, SiFastapi, SiMongodb, SiTailwindcss, SiTypescript, SiVercel, SiGithub, SiPython, SiJavascript, SiDocker } from "react-icons/si";

const Hero = () => {
  const { login } = useAuth();
  return (
    <section className="relative overflow-hidden border-b-2 border-black">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-8 px-6 py-16 md:py-24">
        <div className="col-span-12 lg:col-span-7 fade-up">
          <div className="mb-5 flex items-center gap-2">
            <span className="tag-chip bg-[#FF3311] text-white"><CircleDot className="h-3 w-3" strokeWidth={3} /> Live · v0.9 beta</span>
            <span className="tag-chip">Claude Sonnet 4.5</span>
          </div>
          <h1
            className="text-5xl font-black tracking-tighter md:text-7xl lg:text-8xl"
            style={{ fontFamily: "Cabinet Grotesk", lineHeight: 0.9 }}
          >
            Describe it.<br />
            We&nbsp;<span className="bg-[#FF3311] px-2 text-white">forge</span> it.<br />
            Ship it.<span className="text-[#FF3311]">_</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed md:text-base">
            FORGE is an AI full-stack engineer. React + FastAPI + Mongo, written in minutes,
            previewed in your browser. No boilerplate, no bullshit — just working software.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={login} data-testid="hero-start-btn" className="btn-primary">
              Start Forging →
            </button>
            <a href="#demo" className="btn-secondary">View the Terminal</a>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
            {[
              { n: "42s", l: "avg build" },
              { n: "9K+", l: "apps forged" },
              { n: "0", l: "purple gradients" },
            ].map((s) => (
              <div key={s.l} className="border-2 border-black bg-white p-3">
                <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{s.n}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 fade-up delay-200">
          <div className="brut-accent bg-[#0A0A0A] text-[#E0E0E0] p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-[#333] bg-[#141414] px-4 py-2">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 bg-[#FF3311] border border-black"></div>
                <div className="h-3 w-3 bg-[#FFD700] border border-black"></div>
                <div className="h-3 w-3 bg-[#00FF00] border border-black"></div>
              </div>
              <div className="text-xs font-mono text-[#999]">forge@terminal:~</div>
            </div>
            <div className="p-5 font-mono text-xs leading-relaxed min-h-[320px]">
              <div><span className="text-[#FF3311]">$</span> forge init "recipe sharing app"</div>
              <div className="text-[#888]"># spinning up workspace...</div>
              <div className="mt-2"><span className="text-[#0033FF]">[planning]</span> scaffolding React + FastAPI</div>
              <div><span className="text-[#0033FF]">[db]</span> mongo collection: recipes, users</div>
              <div><span className="text-[#0033FF]">[routes]</span> /api/recipes, /api/auth</div>
              <div><span className="text-[#00FF00]">[ok]</span> frontend/src/App.js — 142 lines</div>
              <div><span className="text-[#00FF00]">[ok]</span> backend/server.py — 89 lines</div>
              <div><span className="text-[#00FF00]">[ok]</span> preview running at :3000</div>
              <div className="mt-3 text-[#FFD700]">→ shipped in 38s <span className="caret"></span></div>
            </div>
          </div>
          <div className="mt-4 text-[10px] font-mono text-[#555] uppercase tracking-widest">
            // terminal.archive / feb.2026
          </div>
        </div>
      </div>
    </section>
  );
};

const Marquee = () => {
  const logos = [
    { I: SiReact, n: "React 19" },
    { I: SiFastapi, n: "FastAPI" },
    { I: SiMongodb, n: "MongoDB" },
    { I: SiTailwindcss, n: "Tailwind" },
    { I: SiTypescript, n: "TypeScript" },
    { I: SiVercel, n: "Vercel" },
    { I: SiGithub, n: "GitHub" },
    { I: SiPython, n: "Python" },
    { I: SiJavascript, n: "JavaScript" },
    { I: SiDocker, n: "Docker" },
  ];
  return (
    <section className="border-b-2 border-black bg-[#0A0A0A] text-white py-6">
      <div className="marquee">
        {[0, 1].map((k) => (
          <div className="marquee-track" key={k}>
            {logos.map(({ I, n }, i) => (
              <div key={`${k}-${i}`} className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap">
                <I className="h-5 w-5" />
                <span>{n}</span>
                <span className="text-[#FF3311]">/</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

const Features = () => {
  const items = [
    { icon: Zap, title: "Agentic Builder", desc: "Describe it in plain English. FORGE plans, writes, tests, iterates — end-to-end.", color: "#FF3311", span: "md:col-span-5" },
    { icon: Code2, title: "Code You Own", desc: "Every file is yours. Export to GitHub, deploy anywhere. No lock-in, no vendor tax.", color: "#0033FF", span: "md:col-span-4" },
    { icon: Eye, title: "Live Preview", desc: "Instant browser sandbox. See what you said before you finished saying it.", color: "#0A0A0A", span: "md:col-span-3" },
    { icon: GitBranch, title: "Version Machine", desc: "Every conversation is a branch. Rewind, fork, compare without fear.", color: "#00AA00", span: "md:col-span-4" },
    { icon: Cpu, title: "Claude Sonnet 4.5", desc: "State-of-the-art code model. Multi-file edits, tool use, reasoning.", color: "#FF3311", span: "md:col-span-4" },
    { icon: Layers, title: "Batteries Included", desc: "Auth, DB, storage, payments — scaffolded from day one.", color: "#0033FF", span: "md:col-span-4" },
  ];
  return (
    <section id="features" className="border-b-2 border-black py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[02] capabilities</div>
            <h2 className="mt-2 text-4xl font-black tracking-tighter md:text-6xl" style={{ fontFamily: "Cabinet Grotesk" }}>
              What it does<br />better than you.
            </h2>
          </div>
          <div className="hidden md:block max-w-xs text-sm text-[#555]">
            Built by developers tired of scaffolding the same login page for the 400th time.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {items.map((it, i) => (
            <div key={i} className={`brut bg-white p-6 md:p-8 ${it.span}`} data-testid={`feature-${i}`}>
              <div className="flex h-11 w-11 items-center justify-center border-2 border-black" style={{ background: it.color }}>
                <it.icon className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="mt-5 text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{it.title}</h3>
              <p className="mt-2 text-sm text-[#333] leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    { n: "01", t: "Describe", d: "Type what you want to build. Plain English. Get specific or vague — we handle both." },
    { n: "02", t: "Forge", d: "Claude Sonnet 4.5 plans the stack, writes React + FastAPI code, wires up MongoDB." },
    { n: "03", t: "Preview", d: "App renders live in the right pane. Iterate with follow-up messages in real time." },
    { n: "04", t: "Ship", d: "Export to GitHub. Deploy to Vercel, Fly, or wherever. Your code, your infra." },
  ];
  return (
    <section id="demo" className="border-b-2 border-black bg-[#F4F4F0] py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[03] the assembly line</div>
        <h2 className="mt-2 text-4xl font-black tracking-tighter md:text-6xl" style={{ fontFamily: "Cabinet Grotesk" }}>
          Four steps. One app.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-0 border-2 border-black">
          {steps.map((s, i) => (
            <div key={s.n} className={`bg-white p-8 ${i < 3 ? "md:border-r-2" : ""} border-black ${i < steps.length - 1 ? "border-b-2 md:border-b-0" : ""}`}>
              <div className="text-5xl font-black tracking-tighter text-[#FF3311]" style={{ fontFamily: "Cabinet Grotesk" }}>{s.n}</div>
              <h3 className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{s.t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#555]">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const { login } = useAuth();
  const tiers = [
    { name: "Hacker", price: "$0", freq: "forever", feats: ["100 credits / mo", "Public projects", "Community support", "Claude Sonnet 4.5"], cta: "Start free", highlight: false },
    { name: "Builder", price: "$29", freq: "/month", feats: ["2,000 credits / mo", "Unlimited private projects", "GitHub export", "Priority queue"], cta: "Go Builder", highlight: true },
    { name: "Studio", price: "$99", freq: "/month", feats: ["10,000 credits / mo", "Team collaboration", "Custom domains", "SLA & priority support"], cta: "Go Studio", highlight: false },
  ];
  return (
    <section id="pricing" className="border-b-2 border-black py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[04] pricing</div>
        <h2 className="mt-2 text-4xl font-black tracking-tighter md:text-6xl" style={{ fontFamily: "Cabinet Grotesk" }}>
          Pay for output.<br />Not promises.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative border-2 border-black p-8 ${t.highlight ? "bg-[#0A0A0A] text-white shadow-[8px_8px_0px_#FF3311]" : "bg-white shadow-[4px_4px_0px_#0A0A0A]"}`}
              data-testid={`pricing-${t.name.toLowerCase()}`}
            >
              {t.highlight && (
                <div className="absolute -top-4 left-6 border-2 border-black bg-[#FF3311] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  Most picked
                </div>
              )}
              <div className="text-sm font-bold uppercase tracking-widest">{t.name}</div>
              <div className="mt-4 flex items-end gap-1">
                <div className="text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{t.price}</div>
                <div className="pb-2 text-xs opacity-70">{t.freq}</div>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2"><span className="text-[#FF3311]">▸</span> {f}</li>
                ))}
              </ul>
              <button
                onClick={login}
                className={`mt-6 w-full border-2 border-black px-4 py-3 text-xs font-bold uppercase tracking-widest ${t.highlight ? "bg-[#FF3311] text-white" : "bg-white text-black"}`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Manifesto = () => (
  <section id="manifesto" className="border-b-2 border-black bg-[#0A0A0A] text-white py-20">
    <div className="mx-auto max-w-[1400px] px-6 grid grid-cols-12 gap-8">
      <div className="col-span-12 md:col-span-4">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[05] manifesto</div>
        <h2 className="mt-2 text-4xl font-black tracking-tighter md:text-6xl" style={{ fontFamily: "Cabinet Grotesk" }}>
          Software as<br />furniture.
        </h2>
      </div>
      <div className="col-span-12 md:col-span-8 space-y-5 text-sm md:text-base leading-relaxed">
        <p>→ Every app worth building has already been built 10,000 times. Stop typing <code className="bg-[#222] px-1">yarn create</code>.</p>
        <p>→ You should describe furniture, not assemble it from raw lumber. FORGE is the IKEA of software — flat-packed, assembled in front of you.</p>
        <p>→ We don&apos;t hide code. We don&apos;t lock it up. We don&apos;t charge you for exports. What you build is yours.</p>
        <p>→ AI that writes code is only useful if it ships code. We measure in running applications, not tokens.</p>
        <p className="text-[#FF3311] font-bold">— the forge team</p>
      </div>
    </div>
  </section>
);

const Testimonials = () => {
  const quotes = [
    { q: "I shipped three client projects in a weekend. My retainer went up.", n: "Ada Okonkwo", r: "Freelance Engineer", src: "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
    { q: "It wrote my internal tool in 6 minutes. I wrote it in 2 weeks last time.", n: "Marcus Vela", r: "PM at fintech", src: "https://images.unsplash.com/photo-1769636929388-99eff95d3bf1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
    { q: "The generated code is actually readable. That alone is worth the subscription.", n: "Priya Raman", r: "Staff Engineer", src: "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NjQwOTM4NHww&ixlib=rb-4.1.0&q=85" },
  ];
  return (
    <section className="border-b-2 border-black py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF3311]">[06] field reports</div>
        <h2 className="mt-2 text-4xl font-black tracking-tighter md:text-6xl" style={{ fontFamily: "Cabinet Grotesk" }}>
          From the people<br />who actually ship.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((q, i) => (
            <div key={i} className="brut bg-white p-6">
              <Sparkles className="h-5 w-5 text-[#FF3311]" strokeWidth={2.5} />
              <p className="mt-4 text-base leading-relaxed">&ldquo;{q.q}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3 border-t-2 border-black pt-4">
                <img src={q.src} alt={q.n} className="h-10 w-10 border-2 border-black object-cover" />
                <div>
                  <div className="text-sm font-bold">{q.n}</div>
                  <div className="text-xs text-[#555]">{q.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTA = () => {
  const { login } = useAuth();
  return (
    <section className="border-b-2 border-black bg-[#FF3311] text-white py-20">
      <div className="mx-auto max-w-[1400px] px-6 text-center">
        <h2 className="text-5xl font-black tracking-tighter md:text-7xl" style={{ fontFamily: "Cabinet Grotesk" }}>
          Stop reading.<br />Start forging.
        </h2>
        <button onClick={login} data-testid="bottom-cta-btn" className="mt-8 border-2 border-black bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-black shadow-[6px_6px_0px_#0A0A0A] hover:shadow-[8px_8px_0px_#0A0A0A] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
          Open the terminal <ArrowUpRight className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-[#0A0A0A] text-white py-10">
    <div className="mx-auto max-w-[1400px] px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
      <div className="col-span-2 md:col-span-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-white bg-[#FF3311]">
            <Terminal className="h-4 w-4" strokeWidth={3} />
          </div>
          <span className="text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>FORGE.</span>
        </div>
        <p className="mt-3 max-w-xs text-[#999]">AI that ships software. Built in Brooklyn, Bangalore, and Berlin.</p>
      </div>
      <div>
        <div className="font-bold uppercase tracking-widest mb-3">Product</div>
        <ul className="space-y-1 text-[#999]"><li>Dashboard</li><li>Templates</li><li>Pricing</li><li>Changelog</li></ul>
      </div>
      <div>
        <div className="font-bold uppercase tracking-widest mb-3">Company</div>
        <ul className="space-y-1 text-[#999]"><li>Manifesto</li><li>Careers</li><li>Contact</li><li>Press</li></ul>
      </div>
    </div>
    <div className="mt-8 border-t-2 border-[#333] pt-4 text-center text-[10px] font-mono uppercase tracking-widest text-[#555]">
      © 2026 Forge Systems · all rights forged
    </div>
  </footer>
);

export default function Landing() {
  return (
    <div>
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
