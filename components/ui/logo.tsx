import { Package } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
  variant?: "light" | "dark";
}

export function Logo({
  className,
  iconSize = 28,
  textSize = "text-2xl",
  variant = "light",
}: LogoProps) {
  const textColor = variant === "dark" ? "text-white" : "text-gray-900";
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-blue-600"
        style={{ width: iconSize + 12, height: iconSize + 12 }}
      >
        <Package style={{ width: iconSize, height: iconSize }} className="text-white" />
      </div>
      <span className={`font-bold tracking-tight ${textColor} ${textSize}`}>Suppliq</span>
    </div>
  );
}
