import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Globe2,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  ScanSearch,
  Banknote,
  Newspaper,
  Layers,
  Route,
  TrendingDown,
  ShieldAlert,
} from "lucide-react";
import { FadeIn } from "@/components/landing/fade-in";

export const metadata = {
  title: "Suppliq: AI-powered operations for wholesale and retail",
  description:
    "A complete ERP foundation with an AI layer that turns your data into forecasts, alerts, and decisions. Start free for 14 days.",
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-1 { animation: fadeSlideUp 0.7s ease-out 0.05s both; }
        .anim-2 { animation: fadeSlideUp 0.7s ease-out 0.2s  both; }
        .anim-3 { animation: fadeSlideUp 0.7s ease-out 0.35s both; }
        .anim-4 { animation: fadeSlideUp 0.7s ease-out 0.5s  both; }
        .anim-5 { animation: fadeSlideUp 0.7s ease-out 0.65s both; }
        .anim-6 { animation: fadeSlideUp 0.7s ease-out 0.85s both; }
      `}</style>
      <div className="min-h-screen bg-white text-gray-900 antialiased">
        <Navbar />
        <Hero />
        <StatsBar />
        <Features />
        <Pricing />
        <CtaBanner />
        <Footer />
      </div>
    </>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Suppliq</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Features
          </a>
          <a href="#pricing" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Pricing
          </a>
          <a href="#pricing" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Enterprise
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-400"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-slate-950 px-6 pb-24 pt-20"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="anim-1 mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/60">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
          AI-first operations platform
        </div>

        <h1 className="anim-2 mb-6 text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-7xl">
          Not just another ERP.{" "}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            An AI built on your own business data.
          </span>
        </h1>

        <p className="anim-3 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/50">
          Suppliq captures every sale, purchase, and stock movement, then sits
          Claude AI on top of that data to deliver demand forecasts, anomaly
          alerts, cash flow projections, and a weekly briefing written in plain
          English. Starts at €29/month.
        </p>

        <div className="anim-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-400 hover:shadow-xl hover:shadow-blue-500/30"
          >
            Start 14-day free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login?demo=true"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-base font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" />
            View live demo
          </Link>
        </div>

        <p className="anim-5 mt-4 text-sm text-white/25">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </div>

      {/* Dashboard preview */}
      <div className="anim-6 relative mx-auto mt-16 max-w-5xl">
        <div className="absolute -bottom-8 left-1/2 h-28 w-3/4 -translate-x-1/2 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
            <div className="h-3 w-3 rounded-full bg-green-400/60" />
            <span className="ml-3 text-xs text-white/25">app.suppliq.com/dashboard</span>
          </div>

          <div className="bg-slate-900 px-6 py-8">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Revenue (30d)", value: "£84,230", change: "+12.4%", color: "text-emerald-400" },
                { label: "Active Items", value: "1,284", change: "+3 today", color: "text-blue-400" },
                { label: "Customers", value: "347", change: "+8 this week", color: "text-violet-400" },
                { label: "Pending POs", value: "12", change: "£23,400 value", color: "text-amber-400" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/5 bg-slate-800/80 p-4">
                  <p className="mb-1 text-[11px] text-slate-400">{stat.label}</p>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className={`mt-1 text-xs font-medium ${stat.color}`}>{stat.change}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-xl border border-white/5 bg-slate-800/80 p-4">
                <p className="mb-3 text-[11px] font-medium text-slate-400">Revenue, last 30 days</p>
                <div className="flex h-20 items-end gap-0.5">
                  {[40,65,45,80,55,90,70,85,60,95,75,88,65,100,78,92,68,84,72,96,80,88,74,90,82,95,86,98,88,100].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: `rgba(59,130,246,${0.25 + (h / 100) * 0.55})`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-800/80 p-4">
                <p className="mb-3 text-[11px] font-medium text-slate-400">AI alerts</p>
                <div className="space-y-2.5">
                  {[
                    ["3 items critical reorder", "text-red-400"],
                    ["Overstock: 8 SKUs", "text-amber-400"],
                    ["Sales spike: CAT6 +240%", "text-violet-400"],
                    ["Cash flow positive 30d", "text-emerald-400"],
                  ].map(([label, color]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
                      <p className={`truncate text-[11px] ${color}`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: "500+", label: "Businesses on Suppliq", sub: "across 30+ countries" },
    { value: "€2B+", label: "Stock tracked", sub: "total inventory value" },
    { value: "2M+", label: "Transactions", sub: "processed last year" },
    { value: "99.9%", label: "Uptime SLA", sub: "guaranteed" },
  ];

  return (
    <section className="border-y border-gray-100 bg-white py-14">
      <div className="mx-auto max-w-5xl px-6">
        <FadeIn>
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-bold tracking-tight text-gray-900">{s.value}</p>
                <p className="mt-1.5 text-sm font-semibold text-gray-700">{s.label}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────

const AI_CAPABILITIES = [
  {
    icon: TrendingUp,
    iconBg: "bg-violet-600 text-white",
    tag: "Demand forecasting",
    title: "Know what to order before you run out",
    description:
      "AI-driven reorder alerts ranked by priority with suggested quantities, estimated days until stockout, and full Claude reasoning. Growth plan shows your top 5 risks; Enterprise unlocks every SKU.",
  },
  {
    icon: ScanSearch,
    iconBg: "bg-red-600 text-white",
    tag: "Anomaly detection",
    title: "Catch problems before they escalate",
    description:
      "Unusual sales spikes, sudden stock drops, expense outliers, and shrinkage surface the moment they appear with severity scoring and a plain-language explanation. You find out straight away, not at month-end.",
  },
  {
    icon: TrendingDown,
    iconBg: "bg-amber-600 text-white",
    tag: "Overstock analysis",
    title: "Free up capital tied in slow stock",
    description:
      "Identifies excess inventory with days-of-cover calculations, capital-tied values, and markdown or inter-branch transfer suggestions to move stock where it will actually sell.",
  },
  {
    icon: Route,
    iconBg: "bg-emerald-600 text-white",
    tag: "Transfer recommendations",
    title: "Balance stock across all your locations",
    description:
      "Pinpoints which items should move between branches to prevent stockouts at one site while clearing overstock at another. Capital freed and reorder savings calculated for every suggestion.",
  },
  {
    icon: Layers,
    iconBg: "bg-indigo-600 text-white",
    tag: "ABC / XYZ classification",
    title: "Know which inventory actually drives revenue",
    description:
      "Pareto-ranks every SKU by revenue contribution (A/B/C) and demand volatility (X/Y/Z). See your high-value, high-risk items at a glance and apply the right replenishment strategy to each class.",
  },
  {
    icon: Banknote,
    iconBg: "bg-teal-600 text-white",
    tag: "Cash flow projection",
    title: "30-day cash flow before it happens",
    description:
      "Combines demand forecasts, upcoming reorder commitments, and expense run rates into a daily projection with a Claude CFO commentary. Know your net cash position 30 days out.",
  },
  {
    icon: Newspaper,
    iconBg: "bg-blue-600 text-white",
    tag: "Weekly AI briefing",
    title: "Monday morning digest, written by AI",
    description:
      "Every Monday, Claude writes a plain-prose briefing for your admin: top stockout risks, the biggest anomaly from last week, your supplier to watch, and one operational recommendation. Delivered in-app.",
  },
  {
    icon: Sparkles,
    iconBg: "bg-fuchsia-600 text-white",
    tag: "Market intelligence",
    title: "Supply chain news scored for your business",
    description:
      "Curated supply chain news enriched by Claude for relevance to your industry and region. Live commodity prices and FX rates for your supplier currencies alongside disruption, pricing, and logistics tags.",
  },
];

const FOUNDATION_FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Multi-branch dashboard",
    description: "Real-time view across every location. Filter by branch, product, or date range and catch issues before they become expensive.",
  },
  {
    icon: ShoppingCart,
    title: "Inventory & point of sale",
    description: "Live stock levels, low-stock alerts, and a POS that handles retail, wholesale, and credit sales all in one flow.",
  },
  {
    icon: Zap,
    title: "Purchase orders",
    description: "Raise POs, track deliveries, match supplier invoices against received stock, and keep a clean audit trail throughout.",
  },
  {
    icon: Users,
    title: "Customer & supplier CRM",
    description: "Credit balances, payment history, and overdue invoice reminders all in one place. No chasing records across three systems.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Sales report on every plan. Growth and above adds Profit & Loss and Stock Movements with full filtering and CSV export.",
  },
  {
    icon: Globe2,
    title: "Multi-currency & multi-locale",
    description: "EUR, GBP, USD and 15+ currencies. Regional supply chain keywords, commodity prices, and FX rates tuned to your country.",
  },
  {
    icon: Building2,
    title: "Role-based access",
    description: "Admins, managers, and cashiers each see exactly what they need. Permissions go down to branch level.",
  },
  {
    icon: ShieldAlert,
    title: "Audit log",
    description: "Immutable record of every create, update, void, and login across your whole organisation. Know who did what and when.",
  },
];

function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="mb-16 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
            The AI layer
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Eight AI capabilities, one platform.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
            Every insight below runs on your actual transaction history, not
            industry benchmarks or demo data. The longer you use Suppliq, the
            sharper they get.
          </p>
        </FadeIn>

        <div className="mb-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {AI_CAPABILITIES.map(({ icon: Icon, iconBg, tag, title, description }, i) => (
            <FadeIn key={title} delay={i * 55}>
              <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{tag}</p>
                <h3 className="mb-2 text-base font-bold leading-snug text-gray-900">{title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-gray-500">{description}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <p className="mb-16 text-center text-sm text-gray-400">
            All AI features are available on the Enterprise plan. Reorder Alerts (top 5) are included in Growth.
          </p>
        </FadeIn>

        <FadeIn>
          <div className="mb-10 flex items-center gap-5">
            <div className="flex-1 border-t border-gray-100" />
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                The foundation layer
              </p>
              <p className="mt-1 text-sm text-gray-400">
                The AI is only as good as the data it runs on. This is what feeds it.
              </p>
            </div>
            <div className="flex-1 border-t border-gray-100" />
          </div>
        </FadeIn>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FOUNDATION_FEATURES.map(({ icon: Icon, title, description }, i) => (
            <FadeIn key={title} delay={i * 40}>
              <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-5 transition-all hover:bg-white hover:shadow-sm">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{description}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Starter",
    price: "€29",
    period: "/month",
    description: "One location, getting started.",
    badge: null,
    highlighted: false,
    features: [
      "1 branch · up to 3 users · 100 items",
      "Inventory & stock management",
      "Point of sale (retail, wholesale, credit)",
      "Customer & supplier records",
      "Purchase orders & expense tracking",
      "Sales reports & CSV export",
      "Email support",
    ],
    locked: [],
    cta: "Start free trial",
    ctaHref: "/signup",
  },
  {
    name: "Growth",
    price: "€79",
    period: "/month",
    description: "Multiple sites, growing fast.",
    badge: "Most popular",
    highlighted: true,
    features: [
      "Up to 3 branches · 10 users · 1,000 items",
      "Everything in Starter",
      "P&L and Stock Movement reports",
      "Multi-branch stock transfers",
      "Reorder Alerts (top 5 items, AI-driven)",
      "Priority support",
    ],
    locked: [],
    cta: "Start free trial",
    ctaHref: "/signup",
  },
  {
    name: "Enterprise",
    price: "€199",
    period: "/month",
    description: "Unlimited scale, full AI suite.",
    badge: null,
    highlighted: false,
    features: [
      "Unlimited branches, users, and items",
      "Everything in Growth",
      "Full AI reorder (all items + reasoning)",
      "Overstock analysis & transfer hints",
      "ABC / XYZ inventory classification",
      "Anomaly detection",
      "30-day cash flow projection",
      "Weekly AI briefing",
      "Market intelligence & news feed",
      "Dedicated account manager · 99.9% SLA",
    ],
    locked: [],
    cta: "Start free trial",
    ctaHref: "/signup",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="mb-16 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
            Pricing
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Simple, predictable pricing.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            14-day free trial on every plan. No credit card needed to start.
          </p>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 80}>
              <div
                className={`relative flex h-full flex-col rounded-2xl p-8 ${
                  plan.highlighted
                    ? "bg-slate-900 shadow-2xl shadow-slate-900/25 ring-1 ring-slate-700"
                    : "border border-gray-200 bg-white shadow-sm"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-4 py-1 text-xs font-bold text-white">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-bold ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-1 text-sm ${plan.highlighted ? "text-slate-400" : "text-gray-500"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8 flex items-baseline gap-1">
                  <span className={`text-5xl font-bold tracking-tight ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? "text-slate-400" : "text-gray-400"}`}>
                    {plan.period}
                  </span>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.highlighted ? "text-blue-400" : "text-blue-600"
                        }`}
                      />
                      <span className={`text-sm ${plan.highlighted ? "text-slate-300" : "text-gray-600"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-blue-500 text-white hover:bg-blue-400"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={200}>
          <p className="mt-8 text-center text-sm text-gray-400">
            All prices in EUR · Billed monthly · Annual billing saves ~17%
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section
      className="relative overflow-hidden bg-slate-950 px-6 py-28"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl text-center">
        <FadeIn>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
            Get started
          </p>
          <h2 className="mb-5 text-4xl font-bold leading-tight text-white md:text-5xl">
            Ready to put your business data to work?
          </h2>
          <p className="mb-10 text-lg text-white/45">
            Get set up in under 10 minutes. The more you use Suppliq, the more
            the AI understands your business. Start the free trial now and it
            only gets better from here.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-blue-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-400 hover:shadow-xl hover:shadow-blue-500/30"
            >
              Start free, no card needed
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login?demo=true"
              className="rounded-xl border border-white/15 px-8 py-3.5 text-base font-semibold text-white/60 transition-all hover:border-white/25 hover:text-white"
            >
              Try the live demo
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white px-6 py-14">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <Link href="/" className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gray-900">Suppliq</span>
            </Link>
            <p className="text-sm text-gray-400">
              A complete ERP with an AI layer that forecasts demand, detects
              anomalies, and briefs you every Monday. Built for wholesale and
              retail teams.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Product</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-gray-700">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-700">Pricing</a></li>
                <li><Link href="/login?demo=true" className="hover:text-gray-700">Live demo</Link></li>
                <li><Link href="/signup" className="hover:text-gray-700">Start free trial</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Company</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-gray-700">About</a></li>
                <li><a href="mailto:hello@suppliq.com" className="hover:text-gray-700">Contact</a></li>
                <li><a href="mailto:sales@suppliq.com" className="hover:text-gray-700">Enterprise sales</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Legal</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-gray-700">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-700">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-8 sm:flex-row">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Suppliq. All rights reserved.
          </p>
          <p className="text-sm text-gray-400">Built for supply chain teams worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
