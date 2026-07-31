import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Plan, PLAN_NAMES } from "@/lib/plans";

interface Props {
  feature: string;
  requiredPlan: Plan;
  currentPlan?: string;
  description?: string;
}

export function UpgradePrompt({ feature, requiredPlan, currentPlan, description }: Props) {
  const planName = PLAN_NAMES[requiredPlan];

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto space-y-5">
      <div className="rounded-full bg-slate-100 border border-slate-200 p-5">
        <Lock className="h-8 w-8 text-slate-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-800">{feature}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {description ??
            `This feature is available on the ${planName} plan and above.`}
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <Button asChild className="gap-1.5">
          <Link href="/settings/billing">
            Upgrade to {planName}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {currentPlan && (
        <p className="text-[11px] text-slate-400">
          Your current plan:{" "}
          <span className="font-semibold">
            {PLAN_NAMES[currentPlan as Plan] ?? currentPlan}
          </span>
        </p>
      )}
    </div>
  );
}
