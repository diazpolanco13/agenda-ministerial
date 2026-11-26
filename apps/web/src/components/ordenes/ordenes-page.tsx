import { Link, useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  ExternalLink,
  FileAudio2,
  Search,
  Stamp,
  Tablet,
} from "lucide-react";
import { useState } from "react";
import {
  ConfidentialityBadge,
  type ConfidentialityLevel,
} from "@/components/confidentiality/confidentiality-badge";
import {
  abbreviateMilitaryRank,
  formatCaracasDueStatus,
  stripRankPrefix,
} from "@/components/executive/rank-format";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OrderClosureStatus,
  OrderItem,
  OrderOrigin,
  OrderSemaforo,
} from "@/fetchers/ordenes";
import { useOrdenes } from "@/hooks/queries/ordenes/use-ordenes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";

type OrdenesPageProps = {
  workspaceId: string;
};

const CLOSURE_STATUS_LABELS: Record<OrderClosureStatus, string> = {
  abierta: "Abierta",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  devuelta: "Devuelta",
};

const CLOSURE_STATUS_CLASSES: Record<OrderClosureStatus, string> = {
  abierta: "border-border bg-muted/60 text-foreground dark:bg-muted/40",
  en_revision:
    "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300",
  aprobada:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  devuelta:
    "border-red-600/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300",
};

const ORIGIN_LABELS: Record<OrderOrigin, string> = {
  discurso: "Discurso",
  audiencia: "Audiencia",
  verbal: "Verbal",
  escrita: "Escrita",
};

const SEMAFORO_CLASSES: Record<OrderSemaforo, { dot: string; text: string }> = {
  verde: {
    dot: "bg-emerald-500",
    text: "text-muted-foreground",
  },
  amarillo: {
    dot: "bg-amber-500",
    text: "font-medium text-amber-700 dark:text-amber-400",
  },
  rojo: {
    dot: "bg-red-500",
    text: "font-medium text-red-600 dark:text-red-400",
  },
  completada: {
    dot: "bg-[#4B5D3A]",
    text: "text-emerald-700 dark:text-emerald-400",
  },
};

function getClosureMeta(status: string) {
  if (
    status === "abierta" ||
    status === "en_revision" ||
    status === "aprobada" ||
    status === "devuelta"
  ) {
    return {
      label: CLOSURE_STATUS_LABELS[status],
      className: CLOSURE_STATUS_CLASSES[status],
    };
  }
  return {
    label: CLOSURE_STATUS_LABELS.abierta,
    className: CLOSURE_STATUS_CLASSES.abierta,
  };
}

function isRestrictedConfidentiality(
  level: string,
): level is ConfidentialityLevel {
  return level === "reservada" || level === "confidencial";
}

function formatResponsableDisplay(order: OrderItem): string | null {
  const resp = order.responsable;
  if (!resp) return null;
  const shortRank =
    resp.gradoCorto ?? abbreviateMilitaryRank(resp.grado) ?? null;
  const cleanName = stripRankPrefix(resp.name) || resp.name;
  return shortRank ? `${shortRank} ${cleanName}` : cleanName;
}

export function OrdenesPage({ workspaceId }: OrdenesPageProps) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [closureFilter, setClosureFilter] = useState<
    OrderClosureStatus | "all"
  >("all");
  const [originFilter, setOriginFilter] = useState<OrderOrigin | "all">("all");
  const [activeDetailTask, setActiveDetailTask] = useState<{
    id: string;
    projectId: string;
  } | null>(null);

  const ordersQuery = useOrdenes(workspaceId, {
    closureStatus: closureFilter === "all" ? undefined : closureFilter,
    origin: originFilter === "all" ? undefined : originFilter,
    search: debouncedSearch || undefined,
  });

  const kpis = ordersQuery.data?.kpis ?? {
    total: 0,
    abiertas: 0,
    enRevision: 0,
    aprobadas: 0,
    devueltas: 0,
    vencidas: 0,
  };
  const ordenes = ordersQuery.data?.ordenes ?? [];

  const kpiCards = [
    {
      id: "total",
      label: "Total de órdenes",
      value: kpis.total,
      sublabel: `${kpis.abiertas} abiertas · ${kpis.devueltas} devueltas`,
      dot: "bg-[#213368] dark:bg-[#4f72c4]",
      tone: "border-border/80 bg-card",
      valueTone: "",
    },
    {
      id: "en-revision",
      label: "En revisión",
      value: kpis.enRevision,
      sublabel: "Pendientes de visto bueno",
      dot: kpis.enRevision > 0 ? "bg-amber-500" : "bg-muted-foreground/40",
      tone:
        kpis.enRevision > 0
          ? "border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-500/[0.05]"
          : "border-border/80 bg-card",
      valueTone:
        kpis.enRevision > 0 ? "text-amber-700 dark:text-amber-400" : "",
    },
    {
      id: "vencidas",
      label: "Vencidas",
      value: kpis.vencidas,
      sublabel: kpis.vencidas > 0 ? "Requieren atención" : "Sin retrasos",
      dot: kpis.vencidas > 0 ? "bg-red-500" : "bg-muted-foreground/40",
      tone:
        kpis.vencidas > 0
          ? "border-red-500/30 bg-red-500/[0.03] dark:bg-red-500/[0.05]"
          : "border-border/80 bg-card",
      valueTone: kpis.vencidas > 0 ? "text-red-600 dark:text-red-400" : "",
    },
    {
      id: "aprobadas",
      label: "Aprobadas",
      value: kpis.aprobadas,
      sublabel: "Con visto bueno y sello",
      dot: "bg-emerald-500",
      tone: "border-border/80 bg-card",
      valueTone:
        kpis.aprobadas > 0 ? "text-emerald-700 dark:text-emerald-400" : "",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <header className="flex flex-col gap-3 border-border/80 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Stamp className="size-4.5 shrink-0 text-[#4B5D3A]" />
            <h1 className="font-semibold text-lg text-foreground tracking-tight sm:text-xl">
              Órdenes del Ministro
            </h1>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Control foliado de instrucciones ministeriales, responsables,
            evidencias y visto bueno.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              navigate({
                to: "/despacho",
                search: { workspaceId },
              })
            }
          >
            <Tablet className="size-3.5" />
            Modo Despacho
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/discurso",
                params: { workspaceId },
              })
            }
            className="bg-[#1E3A5F] border-[#1E3A5F] text-white hover:bg-[#172D4B]"
          >
            <FileAudio2 className="size-3.5" />
            Desde discurso
          </Button>
        </div>
      </header>

      <section
        aria-label="Indicadores de órdenes"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {ordersQuery.isLoading && !ordersQuery.data
          ? [1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-7 w-12" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            ))
          : kpiCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "flex min-w-0 flex-col justify-between rounded-xl border p-3.5 sm:p-4",
                  card.tone,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-xs text-muted-foreground">
                    {card.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn("size-2 shrink-0 rounded-full", card.dot)}
                  />
                </div>
                <p
                  className={cn(
                    "mt-1.5 font-semibold text-2xl text-foreground tracking-tight tabular-nums",
                    card.valueTone,
                  )}
                >
                  {card.value}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {card.sublabel}
                </p>
              </div>
            ))}
      </section>

      <section className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por folio, título, responsable o proyecto..."
            className="[&_input]:pl-8"
            aria-label="Buscar órdenes"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <div className="sm:w-44">
            <Select
              value={closureFilter}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "abierta" ||
                  value === "en_revision" ||
                  value === "aprobada" ||
                  value === "devuelta"
                ) {
                  setClosureFilter(value);
                }
              }}
            >
              <SelectTrigger aria-label="Filtrar por estado de cierre">
                <SelectValue>
                  {closureFilter === "all"
                    ? "Estado: Todos"
                    : CLOSURE_STATUS_LABELS[closureFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Estado: Todos</SelectItem>
                <SelectItem value="abierta">Abierta</SelectItem>
                <SelectItem value="en_revision">En revisión</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="devuelta">Devuelta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:w-40">
            <Select
              value={originFilter}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "discurso" ||
                  value === "audiencia" ||
                  value === "verbal" ||
                  value === "escrita"
                ) {
                  setOriginFilter(value);
                }
              }}
            >
              <SelectTrigger aria-label="Filtrar por origen">
                <SelectValue>
                  {originFilter === "all"
                    ? "Origen: Todos"
                    : ORIGIN_LABELS[originFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Origen: Todos</SelectItem>
                <SelectItem value="discurso">Discurso</SelectItem>
                <SelectItem value="audiencia">Audiencia</SelectItem>
                <SelectItem value="verbal">Verbal</SelectItem>
                <SelectItem value="escrita">Escrita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {ordersQuery.isError && !ordersQuery.data ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span>No se pudo cargar el listado de órdenes.</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void ordersQuery.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : ordersQuery.isLoading && !ordersQuery.data ? (
        <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : ordenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-12 text-center">
          <ClipboardList className="size-6 text-muted-foreground/70" />
          <p className="font-medium text-sm text-foreground">
            No se encontraron órdenes con los filtros seleccionados
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Marca una tarea como Orden del Ministro o extrae órdenes desde un
            discurso o dictado en Modo Despacho.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Orden / Proyecto</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Plazo</TableHead>
                  <TableHead>Estado / Avance</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenes.map((order) => {
                  const due = formatCaracasDueStatus(
                    order.dueDate,
                    order.isFinal || order.orderClosureStatus === "aprobada",
                  );
                  const semaforo = SEMAFORO_CLASSES[order.semaforo];
                  const closure = getClosureMeta(order.orderClosureStatus);
                  const respLabel = formatResponsableDisplay(order);
                  const ticketCode =
                    order.number != null
                      ? `${order.projectSlug}-${order.number}`
                      : order.projectSlug;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs text-foreground">
                        {order.orderFolio ?? "Sin folio"}
                      </TableCell>

                      <TableCell className="max-w-xs whitespace-normal">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="flex shrink-0 items-center [&_svg]:size-3.5">
                              {getPriorityIcon(order.priority)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveDetailTask({
                                  id: order.id,
                                  projectId: order.projectId,
                                })
                              }
                              className="truncate text-left font-medium text-sm text-foreground hover:underline"
                            >
                              {order.title}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="truncate">
                              {order.projectName}
                            </span>
                            <span className="font-mono text-muted-foreground/75">
                              ({ticketCode})
                            </span>
                            {isRestrictedConfidentiality(
                              order.confidentialityLevel,
                            ) ? (
                              <ConfidentialityBadge
                                level={order.confidentialityLevel}
                                size="sm"
                              />
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {order.responsable ? (
                          <div className="flex min-w-0 items-center gap-2">
                            <ResponsableAvatar
                              assigned
                              userId={order.responsable.userId}
                              name={order.responsable.name}
                              image={order.responsable.fotoUrl}
                              cedula={order.responsable.cedula}
                              grado={order.responsable.grado}
                              componente={order.responsable.componente}
                              unidad={order.responsable.unidad}
                              size="sm"
                              showHoverCard
                            />
                            <span className="max-w-44 truncate text-xs text-foreground">
                              {respLabel}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin asignar
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              semaforo.dot,
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              semaforo.text,
                            )}
                          >
                            {due.label}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex w-36 flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              size="sm"
                              className={closure.className}
                            >
                              {closure.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {order.avancePct}%
                            </span>
                          </div>
                          <Progress value={order.avancePct} />
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              setActiveDetailTask({
                                id: order.id,
                                projectId: order.projectId,
                              })
                            }
                          >
                            Ver / Gestionar
                          </Button>
                          <Link
                            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                            params={{
                              workspaceId,
                              projectId: order.projectId,
                              taskId: order.id,
                            }}
                            aria-label={`Abrir ${order.title} en página completa`}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
            {ordenes.map((order) => {
              const due = formatCaracasDueStatus(
                order.dueDate,
                order.isFinal || order.orderClosureStatus === "aprobada",
              );
              const semaforo = SEMAFORO_CLASSES[order.semaforo];
              const closure = getClosureMeta(order.orderClosureStatus);
              const respLabel = formatResponsableDisplay(order);

              return (
                <li
                  key={order.id}
                  className="space-y-3 rounded-xl border border-border/80 bg-card p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-medium text-xs text-foreground">
                        {order.orderFolio ?? "Sin folio"}
                      </span>
                      {isRestrictedConfidentiality(
                        order.confidentialityLevel,
                      ) ? (
                        <ConfidentialityBadge
                          level={order.confidentialityLevel}
                          size="sm"
                        />
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      size="sm"
                      className={closure.className}
                    >
                      {closure.label}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 flex shrink-0 items-center [&_svg]:size-3.5">
                        {getPriorityIcon(order.priority)}
                      </span>
                      <p className="font-medium text-sm text-foreground">
                        {order.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.projectName}
                      {order.number != null
                        ? ` · ${order.projectSlug}-${order.number}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {order.responsable ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <ResponsableAvatar
                          assigned
                          userId={order.responsable.userId}
                          name={order.responsable.name}
                          image={order.responsable.fotoUrl}
                          cedula={order.responsable.cedula}
                          grado={order.responsable.grado}
                          componente={order.responsable.componente}
                          unidad={order.responsable.unidad}
                          size="sm"
                        />
                        <span className="truncate text-foreground/90">
                          {respLabel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin asignar</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          semaforo.dot,
                        )}
                      />
                      <span className={cn("tabular-nums", semaforo.text)}>
                        {due.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Avance</span>
                      <span className="tabular-nums">{order.avancePct}%</span>
                    </div>
                    <Progress value={order.avancePct} />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        setActiveDetailTask({
                          id: order.id,
                          projectId: order.projectId,
                        })
                      }
                    >
                      Ver / Gestionar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <TaskDetailsSheet
        taskId={activeDetailTask?.id}
        projectId={activeDetailTask?.projectId ?? ""}
        workspaceId={workspaceId}
        onClose={() => setActiveDetailTask(null)}
      />
    </div>
  );
}
