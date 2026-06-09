"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/settings";
import type { UserProfile } from "@/lib/actions/settings";

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const [name, setName]   = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function touch() { setSuccess(false); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const result = await updateProfile({ name, email });
    setLoading(false);
    if (!result.success) { setError(result.error); } else { setSuccess(true); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Full name</Label>
        <Input
          id="pf-name"
          value={name}
          onChange={(e) => { setName(e.target.value); touch(); }}
          maxLength={100}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-email">Email address</Label>
        <Input
          id="pf-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); touch(); }}
          maxLength={200}
          required
        />
        <p className="text-xs text-slate-400">
          Email changes take effect on your next sign-in.
        </p>
      </div>

      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Profile updated successfully.</p>}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
