"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { registerOrganization } from "@/lib/actions/onboarding";

interface Step1 {
  orgName: string;
  industry: string;
  branchName: string;
}

interface Step2 {
  adminName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const INDUSTRIES = [
  "Retail",
  "Wholesale & Distribution",
  "Manufacturing",
  "Agriculture",
  "Food & Beverage",
  "Pharmaceuticals",
  "Construction & Hardware",
  "Electronics",
  "Fashion & Apparel",
  "Other",
];

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3"
    >
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1>({
    orgName: "",
    industry: "",
    branchName: "Head Office",
  });
  const [step2, setStep2] = useState<Step2>({
    adminName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (step1.orgName.trim().length < 2) {
      setError("Company name must be at least 2 characters.");
      return;
    }
    if (step1.branchName.trim().length < 2) {
      setError("Branch name must be at least 2 characters.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    if (step2.adminName.trim().length < 2) {
      setError("Your name must be at least 2 characters.");
      return;
    }
    if (step2.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (step2.password !== step2.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.append("orgName", step1.orgName);
    fd.append("industry", step1.industry);
    fd.append("branchName", step1.branchName);
    fd.append("adminName", step2.adminName);
    fd.append("email", step2.email);
    fd.append("password", step2.password);
    fd.append("confirmPassword", step2.confirmPassword);

    const result = await registerOrganization(fd);

    if ("error" in result) {
      setError(result.error as string);
      setPending(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: step2.email,
      password: step2.password,
      redirect: false,
    });

    if (signInResult?.error) {
      setError("Account created! Please sign in.");
      setPending(false);
      router.push("/login");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg placeholder:text-slate-400 " +
    "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent " +
    "disabled:bg-slate-50 disabled:text-slate-400 transition-colors";

  const labelClass = "block text-sm font-medium text-slate-700";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-sky-500 rounded-2xl px-5 py-3 mb-4">
            <Logo width={230} height={80} />
          </div>
          <p className="text-sm text-slate-500">Create your organization account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  s < step
                    ? "bg-sky-500 text-white"
                    : s === step
                    ? "bg-sky-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {s < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span className={`text-xs font-medium ${s === step ? "text-slate-700" : "text-slate-400"}`}>
                {s === 1 ? "Company" : "Account"}
              </span>
              {s < 2 && <div className={`flex-1 h-px ${step > s ? "bg-sky-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {error && <ErrorBanner message={error} />}

          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="orgName" className={labelClass}>
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  id="orgName"
                  type="text"
                  required
                  autoFocus
                  placeholder="Acme Distributors Ltd"
                  value={step1.orgName}
                  onChange={(e) => setStep1((p) => ({ ...p, orgName: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="industry" className={labelClass}>
                  Industry <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  id="industry"
                  value={step1.industry}
                  onChange={(e) => setStep1((p) => ({ ...p, industry: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="branchName" className={labelClass}>
                  Main branch / location <span className="text-red-500">*</span>
                </label>
                <input
                  id="branchName"
                  type="text"
                  required
                  placeholder="Head Office"
                  value={step1.branchName}
                  onChange={(e) => setStep1((p) => ({ ...p, branchName: e.target.value }))}
                  className={inputClass}
                />
                <p className="text-xs text-slate-400">You can add more branches later.</p>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-sky-500 hover:bg-sky-600 active:bg-sky-700
                           text-white text-sm font-semibold py-2.5 px-4 rounded-lg
                           transition-colors"
              >
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2Submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="adminName" className={labelClass}>
                  Your full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="adminName"
                  type="text"
                  required
                  autoFocus
                  placeholder="Jane Doe"
                  value={step2.adminName}
                  onChange={(e) => setStep2((p) => ({ ...p, adminName: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className={labelClass}>
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="jane@acme.co"
                  value={step2.email}
                  onChange={(e) => setStep2((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className={labelClass}>
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={step2.password}
                  onChange={(e) => setStep2((p) => ({ ...p, password: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirm password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={step2.confirmPassword}
                  onChange={(e) => setStep2((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setError(null); setStep(1); }}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium
                             py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-sky-500 hover:bg-sky-600 active:bg-sky-700
                             text-white text-sm font-semibold py-2.5 px-4 rounded-lg
                             transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {pending ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-slate-400 mt-3">
          SUPPLIQ &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
