import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrgDetail } from "@/lib/actions/settings";
import { BillingCard } from "@/components/settings/billing-card";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const org = await getOrgDetail();
  if (!org) redirect("/login");

  const params = await searchParams;
  const showSuccess = params.success === "1";
  const showCanceled = params.canceled === "1";

  return (
    <div className="max-w-lg space-y-4">
      {showSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Subscription activated</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your plan has been upgraded. New limits take effect immediately.
            </p>
          </div>
        </div>
      )}
      {showCanceled && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <XCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Checkout canceled</p>
            <p className="text-sm text-slate-500 mt-0.5">
              No changes were made. You can upgrade any time from this page.
            </p>
          </div>
        </div>
      )}
      <BillingCard org={org} />
    </div>
  );
}
