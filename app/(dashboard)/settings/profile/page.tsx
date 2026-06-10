import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfile } from "@/lib/actions/settings";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/components/layout/nav-items";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-lg">
      {/* Profile info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Profile</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Update your display name and email address.
            </p>
          </div>
          <Badge className="shrink-0 bg-slate-100 text-slate-600 border-slate-200 text-xs font-semibold">
            {roleLabel}
          </Badge>
        </div>

        <p className="text-xs text-slate-400">
          Member since {memberSince}
        </p>

        <ProfileForm profile={profile} />
      </div>

      {/* Password */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Change password</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>
        <PasswordForm />
      </div>
    </div>
  );
}
