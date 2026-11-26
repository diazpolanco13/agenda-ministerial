import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Mic,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Stamp,
} from "lucide-react";
import { useState } from "react";
import {
  ConfidentialityBadge,
  type ConfidentialityLevel,
} from "@/components/confidentiality/confidentiality-badge";
import { VoiceOrderModal } from "@/components/despacho/voice-order-modal";
import {
  abbreviateMilitaryRank,
  formatCaracasDueStatus,
  formatCaracasLongDate,
  formatCaracasTime,
  getCaracasGreeting,
  stripRankPrefix,
} from "@/components/executive/rank-format";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { DespachoUsuario, OrderItem } from "@/fetchers/ordenes";
import {
  useApproveOrder,
  useDespacho,
  useReturnOrder,
} from "@/hooks/queries/ordenes/use-ordenes";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

type DespachoPageProps = {
  workspaceId: string;
};

function buildGreetingName(usuario: DespachoUsuario): string {
  const cleanName = stripRankPrefix(usuario.name);
  const tokens = cleanName.split(/\s+/).filter(Boolean);
  const shortPerson =
    tokens.length <= 2
      ? cleanName
      : `${tokens[0]} ${tokens[tokens.length - 2]}`;
  const rank =
    usuario.gradoCorto ?? abbreviateMilitaryRank(usuario.grado) ?? null;

  if (rank && shortPerson) return `${rank} ${shortPerson}`;
  if (shortPerson) return shortPerson;
  return usuario.name;
}

function formatResponsableShort(item: OrderItem): string | null {
  const resp = item.responsable;
  if (!resp) return null;
  const rank = resp.gradoCorto ?? abbreviateMilitaryRank(resp.grado) ?? null;
  const cleanName = stripRankPrefix(resp.name) || resp.name;
  return rank ? `${rank} ${cleanName}` : cleanName;
}

function isRestrictedConfidentiality(
  level: string,
): level is ConfidentialityLevel {
  return level === "reservada" || level === "confidencial";
}

function DespachoItemCard({
  workspaceId,
  item,
  tone,
  onOpenSheet,
}: {
  workspaceId: string;
  item: OrderItem;
  tone: "today" | "critical";
  onOpenSheet: (item: OrderItem) => void;
}) {
  const due = formatCaracasDueStatus(
    item.dueDate,
    item.isFinal || item.orderClosureStatus === "aprobada",
  );
  const hora = formatCaracasTime(item.dueDate ?? item.startDate);
  const respLabel = formatResponsableShort(item);

  return (
    <div className="space-y-2.5 rounded-xl border border-border/80 bg-background p-3.5 transition-colors hover:border-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.orderFolio ? (
            <Badge variant="outline" size="sm" className="font-mono">
              {item.orderFolio}
            </Badge>
          ) : null}
          {isRestrictedConfidentiality(item.confidentialityLevel) ? (
            <ConfidentialityBadge level={item.confidentialityLevel} size="sm" />
          ) : null}
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs tabular-nums",
            item.semaforo === "rojo"
              ? "font-medium text-red-600 dark:text-red-400"
              : item.semaforo === "amarillo" || tone === "today"
                ? "font-medium text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              item.semaforo === "rojo"
                ? "bg-red-500"
                : item.semaforo === "amarillo"
                  ? "bg-amber-500"
                  : item.semaforo === "completada"
                    ? "bg-[#4B5D3A]"
                    : "bg-emerald-500",
            )}
          />
          {hora && tone === "today" ? `${due.label} · ${hora}` : due.label}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-1 flex shrink-0 items-center [&_svg]:size-3.5">
          {getPriorityIcon(item.priority)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground leading-snug">
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.projectName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {item.responsable ? (
          <div className="flex min-w-0 items-center gap-2">
            <ResponsableAvatar
              assigned
              userId={item.responsable.userId}
              name={item.responsable.name}
              image={item.responsable.fotoUrl}
              cedula={item.responsable.cedula}
              grado={item.responsable.grado}
              componente={item.responsable.componente}
              unidad={item.responsable.unidad}
              size="sm"
            />
            <span className="truncate text-xs text-foreground/85">
              {respLabel}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin asignar</span>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 px-3.5 text-sm"
            onClick={() => onOpenSheet(item)}
          >
            Abrir
          </Button>
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{
              workspaceId,
              projectId: item.projectId,
              taskId: item.id,
            }}
            aria-label={`Ir a tarea ${item.title}`}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-input bg-popover text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DespachoPage({ workspaceId }: DespachoPageProps) {
  const navigate = useNavigate();
  const despachoQuery = useDespacho(workspaceId);
  const approveMutation = useApproveOrder();
  const returnMutation = useReturnOrder();

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [returningTaskId, setReturningTaskId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [activeDetailTask, setActiveDetailTask] = useState<{
    id: string;
    projectId: string;
  } | null>(null);

  const data = despachoQuery.data;
  const greeting = getCaracasGreeting();
  const rawDate = formatCaracasLongDate();
  const dateLabel =
    rawDate.charAt(0).toLocaleUpperCase("es-VE") + rawDate.slice(1);

  const handleOneTapApprove = (item: OrderItem) => {
    approveMutation.mutate(
      { taskId: item.id },
      {
        onSuccess: () => {
          toast.success(
            item.orderFolio
              ? `Visto bueno otorgado a ${item.orderFolio}.`
              : "Visto bueno otorgado.",
          );
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo otorgar el visto bueno.",
          );
        },
      },
    );
  };

  const handleConfirmReturn = (item: OrderItem) => {
    const clean = returnReason.trim();
    if (clean.length < 3) {
      toast.error("Ingresa un motivo breve (mínimo 3 caracteres).");
      return;
    }

    returnMutation.mutate(
      { taskId: item.id, comment: clean },
      {
        onSuccess: () => {
          setReturningTaskId(null);
          setReturnReason("");
          toast.success("Orden devuelta para corrección.");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo devolver la orden.",
          );
        },
      },
    );
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-background">
      <header className="sticky top-0 z-20 border-border/80 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/marca/mppd.png"
              alt="MPPD"
              className="size-10 shrink-0 object-contain sm:size-11"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-semibold text-lg text-foreground tracking-tight sm:text-xl">
                  Modo Despacho
                </h1>
                {data?.workspaceName ? (
                  <Badge variant="outline" size="sm">
                    {data.workspaceName}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {data?.usuario
                  ? `${greeting}, ${buildGreetingName(data.usuario)} · ${dateLabel}`
                  : `${greeting} · ${dateLabel}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="min-h-12 flex-1 bg-[#4B5D3A] border-[#4B5D3A] px-4 text-white hover:bg-[#3F4E30] sm:flex-none"
              onClick={() => setVoiceOpen(true)}
            >
              <Mic className="size-4" />
              Nueva orden por voz
            </Button>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 px-4"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId/ordenes",
                  params: { workspaceId },
                })
              }
            >
              <Stamp className="size-4" />
              Órdenes
            </Button>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 px-4"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId",
                  params: { workspaceId },
                })
              }
            >
              <ArrowLeft className="size-4" />
              Salir al panel
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        {despachoQuery.isError && !data ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <span>No se pudo cargar la bandeja de Modo Despacho.</span>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 px-4"
              onClick={() => void despachoQuery.refetch()}
            >
              <RefreshCw className="size-4" />
              Reintentar
            </Button>
          </div>
        ) : despachoQuery.isLoading && !data ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((col) => (
              <div
                key={col}
                className="space-y-3 rounded-2xl border border-border/80 bg-card p-4"
              >
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <section className="flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card">
              <div className="flex items-center justify-between gap-2 border-border/70 border-b px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4.5 text-[#1E3A5F] dark:text-[#6B95CC]" />
                  <h2 className="font-semibold text-base text-foreground">
                    Hoy
                  </h2>
                </div>
                <Badge variant="secondary">{data?.counts.hoy ?? 0}</Badge>
              </div>

              <div className="flex-1 space-y-3 p-3.5">
                {!data?.hoy.length ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-muted-foreground">
                    <ClipboardList className="size-5 opacity-70" />
                    <p className="text-sm">
                      Sin compromisos pautados para hoy.
                    </p>
                  </div>
                ) : (
                  data.hoy.map((item) => (
                    <DespachoItemCard
                      key={item.id}
                      workspaceId={workspaceId}
                      item={item}
                      tone="today"
                      onOpenSheet={(selected) =>
                        setActiveDetailTask({
                          id: selected.id,
                          projectId: selected.projectId,
                        })
                      }
                    />
                  ))
                )}
              </div>
            </section>

            <section className="flex min-w-0 flex-col rounded-2xl border border-amber-500/35 bg-card">
              <div className="flex items-center justify-between gap-2 border-border/70 border-b px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4.5 text-[#4B5D3A]" />
                  <h2 className="font-semibold text-base text-foreground">
                    Requiere mi visto bueno
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                >
                  {data?.counts.requiereVistoBueno ?? 0}
                </Badge>
              </div>

              <div className="flex-1 space-y-3 p-3.5">
                {!data?.requiereVistoBueno.length ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="size-5 opacity-70" />
                    <p className="text-sm">
                      No hay órdenes pendientes por revisión.
                    </p>
                  </div>
                ) : (
                  data.requiereVistoBueno.map((item) => {
                    const respLabel = formatResponsableShort(item);
                    const isReturningThis = returningTaskId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="space-y-3 rounded-xl border border-border/80 bg-background p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.orderFolio ? (
                              <Badge
                                variant="outline"
                                size="sm"
                                className="font-mono"
                              >
                                {item.orderFolio}
                              </Badge>
                            ) : null}
                            {isRestrictedConfidentiality(
                              item.confidentialityLevel,
                            ) ? (
                              <ConfidentialityBadge
                                level={item.confidentialityLevel}
                                size="sm"
                              />
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setActiveDetailTask({
                                id: item.id,
                                projectId: item.projectId,
                              })
                            }
                            className="min-h-12 px-3 font-medium text-xs text-muted-foreground hover:text-foreground"
                          >
                            Ver detalle
                          </Button>
                        </div>

                        <div>
                          <p className="font-medium text-sm text-foreground leading-snug">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.projectName}
                            {respLabel ? ` · ${respLabel}` : ""}
                          </p>
                        </div>

                        {item.orderEvidenceText ? (
                          <p className="line-clamp-3 rounded-lg bg-muted/35 px-2.5 py-2 text-xs text-foreground/90">
                            {item.orderEvidenceText}
                          </p>
                        ) : null}

                        {data.canApprove ? (
                          <div className="space-y-2.5 pt-1">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                className="min-h-12 bg-[#4B5D3A] border-[#4B5D3A] text-white hover:bg-[#3F4E30]"
                                loading={
                                  approveMutation.isPending &&
                                  approveMutation.variables?.taskId === item.id
                                }
                                disabled={returnMutation.isPending}
                                onClick={() => handleOneTapApprove(item)}
                              >
                                <CheckCircle2 className="size-4" />
                                Visto bueno
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-12 border-red-600/30 text-red-700 hover:bg-red-500/10 dark:text-red-300"
                                disabled={approveMutation.isPending}
                                onClick={() => {
                                  if (isReturningThis) {
                                    setReturningTaskId(null);
                                    setReturnReason("");
                                  } else {
                                    setReturningTaskId(item.id);
                                    setReturnReason("");
                                  }
                                }}
                              >
                                <RotateCcw className="size-4" />
                                Devolver
                              </Button>
                            </div>

                            {isReturningThis ? (
                              <div className="space-y-2 rounded-lg border border-border/80 bg-muted/25 p-2.5">
                                <Textarea
                                  rows={2}
                                  value={returnReason}
                                  onChange={(event) =>
                                    setReturnReason(event.target.value)
                                  }
                                  placeholder="Motivo rápido de devolución (mín. 3 caracteres)..."
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="min-h-12"
                                    disabled={returnMutation.isPending}
                                    onClick={() => {
                                      setReturningTaskId(null);
                                      setReturnReason("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    className="min-h-12"
                                    loading={
                                      returnMutation.isPending &&
                                      returnMutation.variables?.taskId ===
                                        item.id
                                    }
                                    onClick={() => handleConfirmReturn(item)}
                                  >
                                    Confirmar
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-12 w-full"
                            onClick={() =>
                              setActiveDetailTask({
                                id: item.id,
                                projectId: item.projectId,
                              })
                            }
                          >
                            Ver soporte enviado
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="flex min-w-0 flex-col rounded-2xl border border-red-500/30 bg-card md:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between gap-2 border-border/70 border-b px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4.5 text-red-600 dark:text-red-400" />
                  <h2 className="font-semibold text-base text-foreground">
                    Críticas / vencidas
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className="border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-300"
                >
                  {data?.counts.criticasVencidas ?? 0}
                </Badge>
              </div>

              <div className="flex-1 space-y-3 p-3.5">
                {!data?.criticasVencidas.length ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-muted-foreground">
                    <AlertTriangle className="size-5 opacity-70" />
                    <p className="text-sm">
                      Sin tareas críticas ni órdenes vencidas.
                    </p>
                  </div>
                ) : (
                  data.criticasVencidas.map((item) => (
                    <DespachoItemCard
                      key={item.id}
                      workspaceId={workspaceId}
                      item={item}
                      tone="critical"
                      onOpenSheet={(selected) =>
                        setActiveDetailTask({
                          id: selected.id,
                          projectId: selected.projectId,
                        })
                      }
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <VoiceOrderModal
        open={voiceOpen}
        workspaceId={workspaceId}
        onOpenChange={setVoiceOpen}
      />

      <TaskDetailsSheet
        taskId={activeDetailTask?.id}
        projectId={activeDetailTask?.projectId ?? ""}
        workspaceId={workspaceId}
        onClose={() => setActiveDetailTask(null)}
      />
    </div>
  );
}
