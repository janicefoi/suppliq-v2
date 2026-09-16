import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCustomerDetail } from "@/lib/actions/customers";
import { getOrgDetail } from "@/lib/actions/settings";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  return { title: customer ? `${customer.name} — Suppliq` : "Customer — Suppliq" };
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  // The printable statement has to name the business issuing it.
  const [session, customer, org] = await Promise.all([
    auth(),
    getCustomerDetail(id),
    getOrgDetail(),
  ]);
  if (!customer) notFound();
  return (
    <CustomerDetailClient
      customer={customer}
      role={session?.user?.role ?? "CASHIER"}
      currency={session?.user?.currency ?? "EUR"}
      orgName={org?.name ?? "Suppliq"}
    />
  );
}
