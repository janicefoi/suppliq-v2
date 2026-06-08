import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { POSClient } from "@/components/pos/pos-client";

export const metadata = { title: "Point of Sale | JSH ERP" };

export default async function POSPage() {
  const session = await auth();
  if (session?.user?.role === "ADMIN") redirect("/dashboard");
  return <POSClient />;
}

