import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { hasAuthEntered, markAuthEntered } from "./auth-entrance";

type AuthPageProps = {
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  children?: ReactNode;
};

const COMPONENT_EMBLEMS = [
  { src: "/marca/mppd.png", alt: "MPPD" },
  { src: "/marca/ejercito.png", alt: "Ejército Bolivariano" },
  { src: "/marca/armada.png", alt: "Armada Bolivariana" },
  { src: "/marca/aviacion.png", alt: "Aviación Militar Bolivariana" },
  { src: "/marca/guardia-nacional.png", alt: "Guardia Nacional Bolivariana" },
  { src: "/marca/fanb.png", alt: "FANB" },
] as const;

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
        "min-h-dvh w-full flex flex-col lg:flex-row bg-background text-foreground overflow-y-auto",
        isEntering && "motion-shell-enter",
      )}
    >
      {/* Panel izquierdo institucional estilo SIGEFANB */}
      <section className="hidden lg:flex lg:w-[52%] xl:w-[54%] bg-card border-r border-border p-12 xl:p-16 flex-col justify-between">
        <div className="space-y-7 max-w-xl">
          <img
            src="/marca/mpp-defensa.svg"
            alt="Ministerio del Poder Popular para la Defensa"
            className="w-full max-w-[460px] h-auto dark:hidden"
          />
          <img
            src="/marca/mpp-defensa-oscuro.svg"
            alt="Ministerio del Poder Popular para la Defensa"
            className="hidden w-full max-w-[460px] h-auto dark:block"
          />

          {/* Filete tricolor institucional */}
          <div
            className="flex w-full max-w-[460px] h-1 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <span className="flex-1 bg-[#ffe600]" />
            <span className="flex-1 bg-[#0056a2]" />
            <span className="flex-1 bg-[#ec1651]" />
          </div>

          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/marca/sigefanb.webp"
                alt="SIGEFANB"
                className="h-9 w-auto object-contain dark:hidden"
              />
              <img
                src="/marca/sigefanb-oscuro.png"
                alt="SIGEFANB"
                className="hidden h-9 w-auto object-contain dark:block"
              />
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-3 py-1 font-mono text-xs font-semibold tracking-wider uppercase text-primary">
                {t("auth:institutional.chip", { defaultValue: "AGENDA" })}
              </span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-foreground">
              {t("auth:institutional.portalTitle", {
                defaultValue: "Agenda Ministerial",
              })}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t("auth:institutional.portalSubtitle", {
                defaultValue:
                  "Gestión de agenda, reuniones, acuerdos, compromisos y tareas del despacho del Ministerio del Poder Popular para la Defensa.",
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-caption text-primary font-semibold">
                {t("auth:institutional.feature1Title", {
                  defaultValue: "Seguimiento de acuerdos",
                })}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("auth:institutional.feature1Body", {
                  defaultValue:
                    "Control centralizado de reuniones, minutas, compromisos por responsable y cumplimiento de plazos del despacho.",
                })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <p className="text-caption text-primary font-semibold">
                {t("auth:institutional.feature2Title", {
                  defaultValue: "Trazabilidad",
                })}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("auth:institutional.feature2Body", {
                  defaultValue:
                    "Control de acceso por roles institucionales, resguardo de confidencialidad y bitácora verificable de cada actuación.",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Emblemas de los componentes FANB */}
        <div className="space-y-4 pt-8 border-t border-border">
          <div className="flex flex-wrap items-center gap-4">
            {COMPONENT_EMBLEMS.map((emblem) => (
              <img
                key={emblem.src}
                src={emblem.src}
                alt={emblem.alt}
                title={emblem.alt}
                className="h-9 w-9 object-contain opacity-90"
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
            <span>agenda.mppd.dev</span>
            <span>
              {t("auth:institutional.restrictedNotice", {
                defaultValue: "Uso oficial restringido · No indexable",
              })}
            </span>
          </div>
        </div>
      </section>

      {/* Panel derecho: tarjeta de acceso */}
      <section className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div
          className={cn(
            "w-full max-w-md space-y-6",
            isEntering && "motion-shell-rise",
          )}
        >
          {/* Cabecera compacta móvil/tablet */}
          <div className="lg:hidden space-y-3 pb-3 border-b border-border">
            <img
              src="/marca/mpp-defensa.svg"
              alt="Ministerio del Poder Popular para la Defensa"
              className="w-full max-w-[300px] h-auto dark:hidden"
            />
            <img
              src="/marca/mpp-defensa-oscuro.svg"
              alt="Ministerio del Poder Popular para la Defensa"
              className="hidden w-full max-w-[300px] h-auto dark:block"
            />
            <div
              className="flex w-full max-w-[300px] h-1 rounded-full overflow-hidden"
              aria-hidden="true"
            >
              <span className="flex-1 bg-[#ffe600]" />
              <span className="flex-1 bg-[#0056a2]" />
              <span className="flex-1 bg-[#ec1651]" />
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <img
                src="/marca/sigefanb.webp"
                alt="SIGEFANB"
                className="h-6 w-auto object-contain dark:hidden"
              />
              <img
                src="/marca/sigefanb-oscuro.png"
                alt="SIGEFANB"
                className="hidden h-6 w-auto object-contain dark:block"
              />
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-primary">
                {t("auth:institutional.chip", { defaultValue: "AGENDA" })}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-caption text-primary">
                  {t("auth:institutional.verifiedAccess", {
                    defaultValue: "Acceso verificado",
                  })}
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h2>
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              <img
                src="/marca/mppd.png"
                alt="MPPD"
                className="h-11 w-11 shrink-0 object-contain"
              />
            </div>

            {notice}

            {children ? <div>{children}</div> : null}

            <div className="border-t border-border pt-4 text-xs text-muted-foreground leading-relaxed">
              {t("auth:institutional.auditNotice", {
                defaultValue:
                  "Todo acceso, registro de acuerdos y consulta de documentos queda registrado en la bitácora institucional del despacho.",
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
