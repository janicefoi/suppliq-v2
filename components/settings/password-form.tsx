"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/settings";

export function PasswordForm() {
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);

  function touch() { setSuccess(false); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const result = await changePassword({
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); touch(); }}
          autoComplete="current-password"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pw-new">New password</Label>
        <Input
          id="pw-new"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); touch(); }}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <Input
          id="pw-confirm"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); touch(); }}
          autoComplete="new-password"
          required
        />
      </div>

      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Password updated. You may be asked to sign in again.</p>}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
