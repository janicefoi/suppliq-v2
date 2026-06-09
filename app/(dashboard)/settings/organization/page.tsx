import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrgDetail } from "@/lib/actions/settings";
import { OrgForm } from "@/components/settings/org-form";

export default async function OrganizationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const org = await getOrgDetail();
  if (!org) redirect("/login");

  return (
    <div className="max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Organization details</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Update your organization name, industry, and regional settings.
          </p>
        </div>
        <OrgForm org={org} />
      </div>
    </div>
  );
}
