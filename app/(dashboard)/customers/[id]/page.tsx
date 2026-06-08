import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCustomerDetail } from "@/lib/actions/customers";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  return { title: customer ? `${customer.name} — JSH ERP` : "Customer — JSH ERP" };
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [session, customer] = await Promise.all([auth(), getCustomerDetail(id)]);
  if (!customer) notFound();
  return <CustomerDetailClient customer={customer} role={session?.user?.role ?? "CASHIER"} />;
}
