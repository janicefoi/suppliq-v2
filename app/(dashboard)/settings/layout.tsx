import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata = { title: "Settings | SUPPLIQ" };

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your profile and organization
        </p>
      </div>
      <div className="flex gap-8 items-start">
        <SettingsNav role={session.user.role} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
