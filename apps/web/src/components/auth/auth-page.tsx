import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TricolorBar } from "@/components/common/brand-mark";
import { cn } from "@/lib/cn";
import { hasAuthEntered, markAuthEntered } from "./auth-entrance";

type AuthPageProps = {
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  children?: ReactNode;
};

export function AuthPage({
  title,
  description,
  notice,
  children,
}: AuthPageProps) {
  const { t } = useTranslation();
  const [isEntering] = useState(() => !hasAuthEntered());

  useEffect(markAuthEntered, []);

  return (
    <main
      className={cn(
        "min-h-dvh w-full flex flex-col items-center justify-center bg-background text-foreground px-5 py-10 overflow-y-auto",
        isEntering && "motion-shell-enter",
      )}
    >
      <div
        className={cn(
          "w-full max-w-[380px] space-y-6",
          isEntering && "motion-shell-rise",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <img
            src="/marca/mppd.png"
            alt="Ministerio del Poder Popular para la Defensa"
            className="h-9 w-auto object-contain"
          />
          <TricolorBar className="w-12" />
        </div>

        <div className="rounded-xl border border-border/60 bg-card px-6 py-7 sm:px-7 sm:py-8 space-y-5">
          <div className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>

          {notice}

          {children ? <div>{children}</div> : null}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/75">
          {t("auth:institutional.footerLine", {
            defaultValue: "Ministerio del Poder Popular para la Defensa · Uso oficial",
          })}
        </p>
      </div>
    </main>
  );
}
