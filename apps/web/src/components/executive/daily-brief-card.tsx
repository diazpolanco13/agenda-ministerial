import { Link } from "@tanstack/react-router";
import { FileText, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyBriefItem } from "@/fetchers/parte-diario";
import {
  useDailyBrief,
  useSendDailyBriefTest,
  useSynthesizeDailyBrief,
} from "@/hooks/queries/executive/use-daily-brief";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { formatCaracasDueStatus } from "./rank-format";

type DailyBriefCardProps = {
  workspaceId: string;
};

type FilterTabKey = "venceHoy" | "vencidas" | "ordenesNuevas" | "agendaDia";

const FILTER_TABS: Array<{
  key: FilterTabKey;
  label: string;
  emptyText: string;
  activeClass: string;
  dotClass: string;
}> = [
  {
    key: "venceHoy",
    label: "Vence hoy",
    emptyText: "Sin tareas con vencimiento hoy.",
    activeClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  {
    key: "vencidas",
    label: "Vencidas",
    emptyText: "Sin tareas vencidas.",
    activeClass:
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    dotClass: "bg-red-500",
  },
  {
    key: "ordenesNuevas",
    label: "Órdenes nuevas",
    emptyText: "Sin órdenes nuevas en las últimas 24 horas.",
    activeClass:
      "border-[#556b2f]/40 bg-[#556b2f]/10 text-[#3f5122] dark:border-[#7fa646]/45 dark:bg-[#7fa646]/15 dark:text-[#b4d67c]",
    dotClass: "bg-[#556b2f] dark:bg-[#7fa646]",
  },
  {
    key: "agendaDia",
    label: "Agenda del día",
    emptyText: "Sin actividades programadas en la agenda de hoy.",
    activeClass:
      "border-[#213368]/40 bg-[#213368]/10 text-[#213368] dark:border-[#4f72c4]/45 dark:bg-[#4f72c4]/15 dark:text-[#93b0f5]",
    dotClass: "bg-[#213368] dark:bg-[#4f72c4]",
  },
];

function getDefaultActiveTab(
  contadores?: Record<FilterTabKey, number>,
): FilterTabKey {
  if (!contadores) return "venceHoy";
  if (contadores.vencidas > 0) return "vencidas";
  if (contadores.venceHoy > 0) return "venceHoy";
  if (contadores.ordenesNuevas > 0) return "ordenesNuevas";
  if (contadores.agendaDia > 0) return "agendaDia";
  return "venceHoy";
}

export function DailyBriefCard({ workspaceId }: DailyBriefCardProps) {
  const briefQuery = useDailyBrief(workspaceId);
  const synthesizeMutation = useSynthesizeDailyBrief(workspaceId);
  const sendMobileMutation = useSendDailyBriefTest(workspaceId);
  const [selectedTab, setSelectedTab] = useState<FilterTabKey | null>(null);

  const brief = briefQuery.data;

  useEffect(() => {
    if (brief && selectedTab === null) {
      setSelectedTab(getDefaultActiveTab(brief.contadores));
    }
  }, [brief, selectedTab]);

  const activeTab = selectedTab ?? "venceHoy";
  const activeTabMeta =
    FILTER_TABS.find((tab) => tab.key === activeTab) ?? FILTER_TABS[0];
  const activeItems: DailyBriefItem[] = brief?.items[activeTab] ?? [];

  async function handleSynthesize() {
    try {
      const updated = await synthesizeMutation.mutateAsync();
      if (updated.motorUsado === "ollama") {
        toast.success("Síntesis actualizada con IA local.");
      } else {
        toast.info(
          "IA local no disponible; se mantuvo la síntesis determinista.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo generar la síntesis con IA.",
      );
    }
  }

  async function handleSendToMobile() {
    try {
      const result = await sendMobileMutation.mutateAsync();
      if (result.sentNtfy) {
        toast.success("Parte diario enviado a tu dispositivo móvil.");
      } else {
        toast.info("No se pudo entregar el parte al canal móvil.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el parte a tu móvil.",
      );
    }
  }

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border/70 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileText
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <h2 className="truncate font-semibold text-[15px] text-foreground">
            Parte de hoy
          </h2>
          {brief ? (
            <>
              <Badge
                size="sm"
                variant={brief.motorUsado === "ollama" ? "info" : "outline"}
              >
                {brief.motorUsado === "ollama" ? "IA local" : "Determinista"}
              </Badge>
              <span className="hidden text-muted-foreground text-xs sm:inline">
                · {brief.fechaLarga}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            loading={synthesizeMutation.isPending}
            disabled={briefQuery.isLoading || !workspaceId}
            onClick={() => void handleSynthesize()}
          >
            <Sparkles />
            <span>Síntesis IA</span>
          </Button>
          <Button
            size="xs"
            variant="outline"
            loading={sendMobileMutation.isPending}
            disabled={briefQuery.isLoading || !workspaceId}
            onClick={() => void handleSendToMobile()}
          >
            <Send />
            <span>Enviar a móvil</span>
          </Button>
        </div>
      </div>

      {briefQuery.isLoading && !brief ? (
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="mt-1 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>
      ) : briefQuery.isError && !brief ? (
        <p
          role="alert"
          className="px-4 py-5 text-muted-foreground text-sm sm:px-5"
        >
          No se pudo cargar el parte diario.
        </p>
      ) : brief ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
            <p className="text-foreground/90 text-sm leading-relaxed">
              {brief.parrafoEjecutivo}
            </p>

            <div
              role="tablist"
              aria-label="Categorías del parte diario"
              className="flex flex-wrap items-center gap-2"
            >
              {FILTER_TABS.map((tab) => {
                const count = brief.contadores[tab.key];
                const isSelected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedTab(tab.key)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-xs transition-colors",
                      isSelected
                        ? tab.activeClass
                        : "border-border/80 bg-muted/40 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        count > 0 ? tab.dotClass : "bg-muted-foreground/40",
                      )}
                    />
                    <span>{tab.label}</span>
                    <span className="tabular-nums opacity-85">{count}</span>
                  </button>
                );
              })}

              {brief.contadores.pendientesVistoBueno > 0 ? (
                <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                  {brief.contadores.pendientesVistoBueno} por visto bueno
                </span>
              ) : null}
            </div>
          </div>

          <div className="border-border/60 border-t">
            {activeItems.length === 0 ? (
              <p className="px-4 py-3.5 text-muted-foreground text-xs sm:px-5">
                {activeTabMeta?.emptyText}
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {activeItems.map((item) => {
                  const ticketCode =
                    item.orderFolio ??
                    (item.number == null
                      ? item.projectSlug
                      : `${item.projectSlug}-${item.number}`);
                  const due = formatCaracasDueStatus(item.dueDate, false);

                  return (
                    <li key={item.id}>
                      <Link
                        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                        params={{
                          workspaceId,
                          projectId: item.projectId,
                          taskId: item.id,
                        }}
                        className="flex min-w-0 items-center gap-2.5 px-4 py-2.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5"
                      >
                        <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
                          {getPriorityIcon(item.priority)}
                        </span>

                        <span className="hidden shrink-0 font-medium text-muted-foreground text-xs sm:inline">
                          {ticketCode}
                        </span>

                        <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
                          {item.title}
                        </span>

                        {item.isOrder ? (
                          <span className="hidden shrink-0 rounded border border-[#556b2f]/30 bg-[#556b2f]/10 px-1.5 py-0.5 font-semibold text-[10px] text-[#3f5122] tracking-wide sm:inline-flex dark:border-[#7fa646]/35 dark:bg-[#7fa646]/15 dark:text-[#b4d67c]">
                            ORDEN
                          </span>
                        ) : null}

                        <span className="hidden max-w-28 truncate text-muted-foreground text-xs md:inline">
                          {item.projectName}
                        </span>

                        <span className="shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                          {due.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
