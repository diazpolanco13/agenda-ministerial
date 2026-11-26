import { Lock, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type ConfidentialityLevel =
  | "publica_interna"
  | "reservada"
  | "confidencial";

export const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  publica_interna: "Pública interna",
  reservada: "Reservada",
  confidencial: "Confidencial",
};

export interface ConfidentialityBadgeProps {
  level: ConfidentialityLevel;
  showPublic?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const LEVEL_STYLES: Record<ConfidentialityLevel, string> = {
  publica_interna:
    "border-border bg-muted/60 text-muted-foreground dark:bg-muted/40",
  reservada:
    "border-amber-600/25 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300",
  confidencial:
    "border-red-800/25 bg-red-800/10 text-red-900 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300",
};

const SIZE_STYLES: Record<"sm" | "md", string> = {
  sm: "px-1.5 py-0.5 text-[11px] leading-none gap-1",
  md: "px-2 py-1 text-xs leading-none gap-1.5",
};

export function ConfidentialityBadge({
  level,
  showPublic = false,
  size = "sm",
  className,
}: ConfidentialityBadgeProps) {
  if (level === "publica_interna" && !showPublic) {
    return null;
  }

  const label = CONFIDENTIALITY_LABELS[level];
  const iconClass = size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0";

  return (
    <span
      data-slot="confidentiality-badge"
      data-level={level}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border font-medium select-none",
        SIZE_STYLES[size],
        LEVEL_STYLES[level],
        className,
      )}
    >
      {level === "confidencial" ? (
        <Lock className={iconClass} aria-hidden="true" />
      ) : level === "reservada" ? (
        <ShieldAlert className={iconClass} aria-hidden="true" />
      ) : (
        <Shield className={iconClass} aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
