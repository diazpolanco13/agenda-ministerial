import {
  CheckCircle2,
  ChevronDown,
  Cpu,
  Quote,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { OrderCandidatePicker } from "@/components/discurso/order-candidate-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DiscursoOrdenBorrador,
  DiscursoPrioridad,
} from "@/fetchers/discurso";
import { cn } from "@/lib/cn";

type ProjectOption = {
  id: string;
  name: string;
};

type OrdersReviewListProps = {
  ordenes: DiscursoOrdenBorrador[];
  projects: ProjectOption[];
  motorUsado: string;
  fallbackMotivo?: string;
  isSaving: boolean;
  isApproving: boolean;
  canSaveDraft: boolean;
  onChangeOrdenes: (next: DiscursoOrdenBorrador[]) => void;
  onSaveDraft: () => void;
  onApprove: () => void;
};

const PRIORIDADES: { value: DiscursoPrioridad; label: string }[] = [
  { value: "no-priority", label: "Sin prioridad" },
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function OrdersReviewList({
  ordenes,
  projects,
  motorUsado,
  fallbackMotivo,
  isSaving,
  isApproving,
  canSaveDraft,
  onChangeOrdenes,
  onSaveDraft,
  onApprove,
}: OrdersReviewListProps) {
  const [bulkProjectId, setBulkProjectId] = useState<string>("");
  const selectedPendingCount = ordenes.filter(
    (o) => o.seleccionada && !o.createdTaskId,
  ).length;

  const updateOrder = (id: string, patch: Partial<DiscursoOrdenBorrador>) => {
    onChangeOrdenes(
      ordenes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const applyBulkProject = (projectId: string | null) => {
    if (!projectId) return;
    setBulkProjectId(projectId);
    onChangeOrdenes(
      ordenes.map((item) =>
        item.createdTaskId ? item : { ...item, proyectoId: projectId },
      ),
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-border/70 border-b pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-sm text-foreground tracking-tight">
              Acta borrador · Órdenes detectadas ({ordenes.length})
            </h2>
            {motorUsado === "ollama" ? (
              <Badge
                variant="outline"
                size="sm"
                className="border-[#1E3A5F]/40 bg-[#1E3A5F]/10 text-[#1E3A5F] dark:text-[#93B8E8]"
              >
                <Sparkles className="size-3" />
                IA local
              </Badge>
            ) : (
              <Badge variant="secondary" size="sm">
                <Cpu className="size-3" />
                Reglas
              </Badge>
            )}
          </div>
          {fallbackMotivo ? (
            <p className="text-xs text-muted-foreground">{fallbackMotivo}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 0 && ordenes.length > 0 ? (
            <div className="w-full sm:w-48">
              <Select value={bulkProjectId} onValueChange={applyBulkProject}>
                <SelectTrigger size="sm" aria-label="Proyecto para todas">
                  <SelectValue placeholder="Proyecto para todas..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {canSaveDraft ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={isSaving}
              disabled={isApproving || ordenes.length === 0}
              onClick={onSaveDraft}
            >
              <Save className="size-3.5" />
              Guardar borrador
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            loading={isApproving}
            disabled={isSaving || selectedPendingCount === 0}
            onClick={onApprove}
            className="bg-[#4B5D3A] border-[#4B5D3A] text-white hover:bg-[#3F4E30]"
          >
            <CheckCircle2 className="size-3.5" />
            Crear {selectedPendingCount}{" "}
            {selectedPendingCount === 1 ? "tarea" : "tareas"}
          </Button>
        </div>
      </div>

      {ordenes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-xs text-muted-foreground">
          No se detectaron órdenes en el texto analizado. Puedes editar la
          transcripción y volver a extraer.
        </div>
      ) : (
        <div className="space-y-3">
          {ordenes.map((orden, index) => {
            const isCreated = Boolean(orden.createdTaskId);
            const selectedProjectName =
              projects.find((p) => p.id === orden.proyectoId)?.name ??
              "Seleccionar proyecto";

            return (
              <article
                key={orden.id}
                className={cn(
                  "space-y-3 rounded-xl border border-border/80 bg-background/70 p-3.5 transition-opacity sm:p-4",
                  !orden.seleccionada && !isCreated && "opacity-65",
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={orden.seleccionada}
                    disabled={isCreated}
                    aria-label={`Seleccionar orden ${index + 1}`}
                    className="mt-1.5"
                    onCheckedChange={(checked) =>
                      updateOrder(orden.id, { seleccionada: Boolean(checked) })
                    }
                  />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        #{index + 1}
                      </span>
                      {orden.pistas.componente ? (
                        <Badge variant="outline" size="sm">
                          {orden.pistas.componente}
                        </Badge>
                      ) : null}
                      {isCreated ? (
                        <Badge variant="success" size="sm" className="ml-auto">
                          <CheckCircle2 className="size-3" />
                          Tarea creada
                        </Badge>
                      ) : null}
                    </div>

                    <Input
                      value={orden.titulo}
                      disabled={isCreated}
                      aria-label={`Título de la orden ${index + 1}`}
                      onChange={(event) =>
                        updateOrder(orden.id, { titulo: event.target.value })
                      }
                      className="font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <span
                      id={`orden-proyecto-label-${orden.id}`}
                      className="block font-medium text-[11px] text-muted-foreground"
                    >
                      Proyecto destino
                    </span>
                    <Select
                      value={orden.proyectoId ?? ""}
                      disabled={isCreated}
                      onValueChange={(value) =>
                        updateOrder(orden.id, { proyectoId: value || null })
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        aria-labelledby={`orden-proyecto-label-${orden.id}`}
                      >
                        <SelectValue placeholder="Seleccionar proyecto">
                          {selectedProjectName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <label
                      htmlFor={`orden-plazo-${orden.id}`}
                      className="block font-medium text-[11px] text-muted-foreground"
                    >
                      Fecha límite
                      {orden.plazoTexto ? ` (${orden.plazoTexto})` : ""}
                    </label>
                    <Input
                      id={`orden-plazo-${orden.id}`}
                      type="date"
                      size="sm"
                      disabled={isCreated}
                      value={orden.plazo ?? ""}
                      onChange={(event) =>
                        updateOrder(orden.id, {
                          plazo: event.target.value || null,
                        })
                      }
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <span
                      id={`orden-prioridad-label-${orden.id}`}
                      className="block font-medium text-[11px] text-muted-foreground"
                    >
                      Prioridad
                    </span>
                    <Select
                      value={orden.prioridad}
                      disabled={isCreated}
                      onValueChange={(value) =>
                        updateOrder(orden.id, {
                          prioridad: (value as DiscursoPrioridad) || "medium",
                        })
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        aria-labelledby={`orden-prioridad-label-${orden.id}`}
                      >
                        <SelectValue>
                          {PRIORIDADES.find((p) => p.value === orden.prioridad)
                            ?.label ?? "Media"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDADES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <OrderCandidatePicker
                  orden={orden}
                  disabled={isCreated}
                  onChange={(patch) => updateOrder(orden.id, patch)}
                />

                <Collapsible>
                  <CollapsibleTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <Quote className="size-3" />
                    <span>Cita textual</span>
                    <ChevronDown className="size-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <blockquote className="mt-2 rounded-md border-l-2 border-[#4B5D3A]/60 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
                      «{orden.citaTextual}»
                    </blockquote>
                  </CollapsibleContent>
                </Collapsible>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
