"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Check, Loader2 } from "lucide-react";
import { registerOrganization } from "@/lib/actions/onboarding";
import { COUNTRIES } from "@/lib/constants/countries";

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

interface Step1 {
  orgName: string;
  industry: string;
  country: string;
  branchName: string;
}

interface Step2 {
  adminName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Organisation", "Admin account"];
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-400"}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px ml-1 ${step > n ? "bg-blue-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1>({
    orgName: "",
    industry: "",
    country: "GB",
    branchName: "Head Office",
  });
  const [step2, setStep2] = useState<Step2>({
    adminName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.code === step1.country);

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (step1.orgName.trim().length < 2)
      e.orgName = "Company name must be at least 2 characters.";
    if (!step1.country) e.country = "Please select a country.";
    if (step1.branchName.trim().length < 2)
      e.branchName = "Branch name must be at least 2 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    if (step2.adminName.trim().length < 2)
      e.adminName = "Your name must be at least 2 characters.";
    if (!step2.email.includes("@")) e.email = "Enter a valid email address.";
    if (step2.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (step2.password !== step2.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep1()) return;
    setErrors({});
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    setPending(true);
    setServerError(null);

    const fd = new FormData();
    fd.append("orgName", step1.orgName);
    fd.append("industry", step1.industry);
    fd.append("country", step1.country);
    fd.append("branchName", step1.branchName);
    fd.append("adminName", step2.adminName);
    fd.append("email", step2.email);
    fd.append("password", step2.password);
    fd.append("confirmPassword", step2.confirmPassword);

    const result = await registerOrganization(fd);

    if ("error" in result) {
      setServerError(result.error as string);
      setPending(false);
      return;
    }

    const res = await signIn("credentials", {
      email: step2.email,
      password: step2.password,
      redirect: false,
    });

    if (res?.error) {
      setPending(false);
      router.push("/login");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const inputBase =
    "w-full px-3 py-2.5 text-sm border rounded-lg placeholder:text-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
    "disabled:bg-gray-50 disabled:text-gray-400 transition-colors bg-white";
  const inputNormal = `${inputBase} border-gray-300`;
  const inputError = `${inputBase} border-red-400 bg-red-50/40`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Wordmark */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">Suppliq</span>
          </Link>
          <p className="text-sm text-gray-500">Create your organisation - free for 14 days</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <StepIndicator step={step} />

          {/* Server error */}
          {serverError && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="mt-0.5 shrink-0">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </span>
              {serverError}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  id="orgName"
                  type="text"
                  autoFocus
                  placeholder="Acme Distributors Ltd"
                  value={step1.orgName}
                  onChange={(e) => setStep1((p) => ({ ...p, orgName: e.target.value }))}
                  className={errors.orgName ? inputError : inputNormal}
                />
                <FieldError message={errors.orgName} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                  Industry <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <select
                  id="industry"
                  value={step1.industry}
                  onChange={(e) => setStep1((p) => ({ ...p, industry: e.target.value }))}
                  className={inputNormal}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  id="country"
                  value={step1.country}
                  onChange={(e) => setStep1((p) => ({ ...p, country: e.target.value }))}
                  className={errors.country ? inputError : inputNormal}
                >
                  <option value="">Select country...</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <FieldError message={errors.country} />
                {selectedCountry && (
                  <p className="text-xs text-gray-400 mt-1">
                    Currency: <span className="font-medium text-gray-600">{selectedCountry.currency}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="branchName" className="block text-sm font-medium text-gray-700">
                  Main branch name <span className="text-red-500">*</span>
                </label>
                <input
                  id="branchName"
                  type="text"
                  placeholder="Head Office"
                  value={step1.branchName}
                  onChange={(e) => setStep1((p) => ({ ...p, branchName: e.target.value }))}
                  className={errors.branchName ? inputError : inputNormal}
                />
                <FieldError message={errors.branchName} />
                <p className="text-xs text-gray-400">You can add more branches after signing up.</p>
              </div>

              <button
                type="submit"
                className="w-full mt-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="adminName" className="block text-sm font-medium text-gray-700">
                  Your full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="adminName"
                  type="text"
                  autoFocus
                  placeholder="Jane Doe"
                  value={step2.adminName}
                  onChange={(e) => setStep2((p) => ({ ...p, adminName: e.target.value }))}
                  className={errors.adminName ? inputError : inputNormal}
                />
                <FieldError message={errors.adminName} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Work email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@acme.co"
                  value={step2.email}
                  onChange={(e) => setStep2((p) => ({ ...p, email: e.target.value }))}
                  className={errors.email ? inputError : inputNormal}
                />
                <FieldError message={errors.email} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={step2.password}
                  onChange={(e) => setStep2((p) => ({ ...p, password: e.target.value }))}
                  className={errors.password ? inputError : inputNormal}
                />
                <FieldError message={errors.password} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={step2.confirmPassword}
                  onChange={(e) => setStep2((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className={errors.confirmPassword ? inputError : inputNormal}
                />
                <FieldError message={errors.confirmPassword} />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setErrors({}); setServerError(null); setStep(1); }}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending ? "Creating..." : "Create account"}
                </button>
              </div>

              <p className="text-xs text-center text-gray-400 pt-1">
                By continuing, you agree to our{" "}
                <span className="text-gray-600">Terms of Service</span> and{" "}
                <span className="text-gray-600">Privacy Policy</span>.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-3">
          Suppliq &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
