"use client";

import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Loader2, AlertCircle, KeyRound } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetEmployeePassword } from "@/lib/actions/employees";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!";

function generatePassword(length = 12) {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
}

type Step = "confirm" | "success";

export function ResetPasswordDialog({
  open,
  onClose,
  employeeId,
  employeeName,
}: ResetPasswordDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setPassword(generatePassword());
      setCopied(false);
      setError(null);
    }
  }, [open]);

  function regenerate() {
    setPassword(generatePassword());
    setCopied(false);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    const result = await resetEmployeePassword(employeeId, password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setStep("success");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-500" />
            Reset password
          </DialogTitle>
          <DialogDescription>
            {step === "confirm"
              ? `Set a new temporary password for ${employeeName}.`
              : `Password has been reset for ${employeeName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Generated password field */}
          <div className="space-y-1.5">
            <Label>
              {step === "success" ? "Temporary password (save this now)" : "New temporary password"}
            </Label>
            <div className="flex gap-2">
              <Input
                value={password}
                readOnly
                className="font-mono text-sm flex-1 bg-slate-50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                title="Copy to clipboard"
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {step === "confirm" && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={regenerate}
                  title="Generate new password"
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {step === "success" && (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
              Password reset successfully. Share the temporary password with the employee — it won&apos;t be shown again.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              {step === "success" ? "Close" : "Cancel"}
            </Button>
            {step === "confirm" && (
              <Button onClick={handleConfirm} disabled={isLoading} className="gap-1.5">
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm reset
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
