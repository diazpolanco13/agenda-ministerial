import { cn } from "@/lib/cn";

type BrandMarkProps = {
  size?: "sm" | "md";
  collapsibleIcon?: boolean;
  className?: string;
};

export function BrandMark({
  size = "sm",
  collapsibleIcon = false,
  className,
}: BrandMarkProps) {
  const isMd = size === "md";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/marca/fanb.png"
        alt=""
        aria-hidden="true"
        className={cn(
          "shrink-0 object-contain",
          isMd ? "size-8" : "size-7",
        )}
      />
      <span
        className={cn(
          "flex flex-col leading-none",
          collapsibleIcon && "group-data-[collapsible=icon]:hidden",
        )}
      >
        <span
          className={cn(
            "font-sans font-semibold tracking-tight text-foreground",
            isMd ? "text-sm" : "text-[13px]",
          )}
        >
          SIGEFANB
        </span>
        <span
          className={cn(
            "mt-0.5 font-sans font-normal text-muted-foreground",
            isMd ? "text-xs" : "text-[11px]",
          )}
        >
          Agenda Ministerial
        </span>
      </span>
    </span>
  );
}

type TricolorBarProps = {
  className?: string;
};

export function TricolorBar({ className }: TricolorBarProps) {
  return (
    <div
      className={cn("flex h-[2px] overflow-hidden rounded-full opacity-90", className)}
      aria-hidden="true"
    >
      <span className="flex-1 bg-[#ffe600]" />
      <span className="flex-1 bg-[#0056a2]" />
      <span className="flex-1 bg-[#ec1651]" />
    </div>
  );
}
