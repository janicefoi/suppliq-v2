import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe2,
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Suppliq - AI-powered supply chain ERP",
  description:
    "Manage inventory, sales, purchases, and suppliers across multiple branches. Built for modern wholesale and retail businesses.",
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <Pricing />
      <CtaBanner />
      <Footer />
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Suppliq</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Features
          </a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Pricing
          </a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Enterprise
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 to-white px-6 pb-24 pt-20">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
          <Zap className="h-3.5 w-3.5" />
          Now with AI-powered demand forecasting
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-gray-900 md:text-6xl">
          The ERP your supply chain{" "}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            actually deserves
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-gray-500">
          Manage inventory, sales, purchases, and suppliers across multiple branches - all in one
          place. Built for wholesale and retail businesses that are serious about growth.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200"
          >
            Start for free
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login?demo=true"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50"
          >
            <LayoutDashboard className="h-4 w-4" />
            View live demo
          </Link>
        </div>

        <p className="mt-5 text-sm text-gray-400">
          No credit card required · 14-day free trial · Cancel anytime
        </p>
      </div>

      {/* Dashboard preview */}
      <div className="relative mx-auto mt-16 max-w-5xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/80">
          <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-gray-400">app.suppliq.com/dashboard</span>
          </div>
          <div className="bg-gray-900 px-6 py-10">
            {/* Mini dashboard mockup */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Revenue", value: "£84,230", change: "+12.4%" },
                { label: "Active Items", value: "1,284", change: "+3 today" },
                { label: "Customers", value: "347", change: "+8 this week" },
                { label: "Pending POs", value: "12", change: "£23,400 value" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-gray-800 p-4">
                  <p className="mb-1 text-xs text-gray-400">{stat.label}</p>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium text-green-400">{stat.change}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-xl bg-gray-800 p-4">
                <p className="mb-3 text-xs font-medium text-gray-400">Revenue - last 30 days</p>
                <div className="flex h-24 items-end gap-1">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 65, 100, 78, 92, 68, 84, 72, 96, 80, 88, 74, 90, 82, 95, 86, 98, 88, 100].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-blue-500/70"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-gray-800 p-4">
                <p className="mb-3 text-xs font-medium text-gray-400">Top items</p>
                <div className="space-y-2">
                  {["Storage Unit Pro", "LED Panel 60x60", "Packing Tape 48mm", "Ergo Desk Chair"].map(
                    (item, i) => (
                      <div key={item} className="flex items-center justify-between">
                        <p className="text-xs text-gray-300 truncate">{item}</p>
                        <p className="ml-2 shrink-0 text-xs font-medium text-blue-400">
                          {[142, 98, 76, 64][i]}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Reflection / glow */}
        <div className="absolute -bottom-8 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-full bg-blue-300/20 blur-2xl" />
      </div>
    </section>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: "500+", label: "Businesses" },
    { value: "30+", label: "Countries" },
    { value: "2M+", label: "Transactions processed" },
    { value: "99.9%", label: "Uptime SLA" },
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50/50 py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Multi-branch Dashboard",
    description:
      "Get a consolidated view across all your locations. Drill down by branch, date range, or product category in seconds.",
  },
  {
    icon: Box,
    title: "Inventory Management",
    description:
      "Track stock levels in real-time. Set low-stock alerts, manage reorder points, and reconcile across warehouses.",
  },
  {
    icon: ShoppingCart,
    title: "Point of Sale",
    description:
      "Fast, offline-capable POS with thermal receipt printing. Handles retail, wholesale, and credit sales in one flow.",
  },
  {
    icon: Users,
    title: "Customer & Supplier CRM",
    description:
      "Manage credit balances, payment history, and outstanding invoices. Automated reminders for overdue accounts.",
  },
  {
    icon: TrendingUp,
    title: "Reports & Analytics",
    description:
      "Profit & loss, stock movement, and branch comparison reports. Export to CSV for your accountant in one click.",
  },
  {
    icon: Zap,
    title: "AI Demand Forecasting",
    description:
      "Claude-powered predictions tell you what to reorder, when, and how much - before you run out of stock.",
  },
  {
    icon: Globe2,
    title: "Multi-currency & Global",
    description:
      "Full support for GBP, EUR, USD, and 15+ currencies. Locale-aware formatting. Works anywhere in the world.",
  },
  {
    icon: Building2,
    title: "Role-based Access",
    description:
      "Admins, managers, and cashiers each see exactly what they need. Granular permissions down to branch level.",
  },
  {
    icon: BarChart3,
    title: "Purchase Orders",
    description:
      "Raise POs, track deliveries, and reconcile received stock automatically. Full audit trail on every transaction.",
  },
];

function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Everything you need
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            One platform. Every workflow.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            From the POS terminal to the boardroom dashboard - Suppliq covers the full supply chain
            without stitching together five different tools.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{description}</p>
            </div>
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
    price: "£29",
    period: "/mo",
    description: "Perfect for a single location just getting started.",
    badge: null,
    features: [
      "1 branch",
      "Up to 5 users",
      "Inventory management",
      "Point of sale",
      "Basic reports & CSV export",
      "Customer & supplier records",
      "Email support",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "£79",
    period: "/mo",
    description: "For growing businesses operating across multiple sites.",
    badge: "Most popular",
    features: [
      "Up to 5 branches",
      "Up to 20 users",
      "Everything in Starter",
      "Multi-branch dashboard",
      "Purchase orders",
      "Expense tracking",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "£199",
    period: "/mo",
    description: "Unlimited scale with AI intelligence built in.",
    badge: null,
    features: [
      "Unlimited branches",
      "Unlimited users",
      "Everything in Growth",
      "AI demand forecasting",
      "Anomaly detection",
      "Market intelligence feed",
      "API access",
      "Dedicated account manager",
      "99.9% uptime SLA",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50/60 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Simple pricing
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            Pay for what you use
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-200"
                  : "border-gray-200 bg-white shadow-sm"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-900 px-4 py-1 text-xs font-semibold text-white">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`mb-1 text-lg font-bold ${
                    plan.highlighted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm ${plan.highlighted ? "text-blue-200" : "text-gray-500"}`}
                >
                  {plan.description}
                </p>
              </div>

              <div className="mb-8 flex items-end gap-1">
                <span
                  className={`text-5xl font-bold ${
                    plan.highlighted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {plan.price}
                </span>
                <span
                  className={`mb-1 text-sm ${
                    plan.highlighted ? "text-blue-200" : "text-gray-500"
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.highlighted ? "text-blue-200" : "text-blue-600"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.highlighted ? "text-blue-100" : "text-gray-600"
                      }`}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta === "Contact sales" ? "mailto:sales@suppliq.com" : "/register"}
                className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          All prices in GBP. Billed monthly. Annual billing available at 20% discount.
        </p>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="bg-blue-600 px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-4xl font-bold text-white">
          Ready to take control of your supply chain?
        </h2>
        <p className="mb-10 text-lg text-blue-200">
          Join hundreds of businesses that trust Suppliq to run their operations. Set up in under 10
          minutes.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-blue-600 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl"
          >
            Get started free
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-blue-400 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-white hover:bg-blue-700"
          >
            Sign in to your account
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div>
            <Link href="/" className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gray-900">Suppliq</span>
            </Link>
            <p className="max-w-xs text-sm text-gray-400">
              AI-powered supply chain ERP for modern wholesale and retail businesses.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Product
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-gray-700">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-700">Pricing</a></li>
                <li><Link href="/login?demo=true" className="hover:text-gray-700">Live demo</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Company
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-gray-700">About</a></li>
                <li><a href="mailto:hello@suppliq.com" className="hover:text-gray-700">Contact</a></li>
                <li><a href="mailto:sales@suppliq.com" className="hover:text-gray-700">Sales</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Legal
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-gray-700">Privacy policy</a></li>
                <li><a href="#" className="hover:text-gray-700">Terms of service</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-8 sm:flex-row">
          <p className="text-sm text-gray-400">© {new Date().getFullYear()} Suppliq. All rights reserved.</p>
          <p className="text-sm text-gray-400">Built with ❤️ for supply chain teams worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
