import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrgDetail } from "@/lib/actions/settings";
import { BillingCard } from "@/components/settings/billing-card";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const org = await getOrgDetail();
  if (!org) redirect("/login");

  return (
    <div className="max-w-lg">
      <BillingCard org={org} />
    </div>
  );
}
