import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { saveAs } from "file-saver";
import { CheckCircle2, ExternalLink, FileAudio2 } from "lucide-react";
import { useState } from "react";
import { DraftsList } from "@/components/discurso/drafts-list";
import { OrdersReviewList } from "@/components/discurso/orders-review-list";
import { SourcePanel } from "@/components/discurso/source-panel";
import { Badge } from "@/components/ui/badge";
import {
  type AprobarBorradorResponse,
  actualizarBorradorDiscurso,
  aprobarBorradorDiscurso,
  descargarActaPdf,
  type DiscursoBorrador,
  type DiscursoOrdenBorrador,
  eliminarBorradorDiscurso,
  extraerOrdenesDiscurso,
  listarBorradoresDiscurso,
  obtenerEjemploDiscurso,
} from "@/fetchers/discurso";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

type DiscursoPageProps = {
  workspaceId: string;
};

function parseAsistentes(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildActaFilename(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "acta-acuerdos"}.pdf`;
}

export function DiscursoPage({ workspaceId }: DiscursoPageProps) {
  const queryClient = useQueryClient();

  const [activeDraft, setActiveDraft] = useState<DiscursoBorrador | null>(null);
  const [ordenes, setOrdenes] = useState<DiscursoOrdenBorrador[]>([]);
  const [asistentesText, setAsistentesText] = useState("");
  const [motorUsado, setMotorUsado] = useState<string>("reglas");
  const [fallbackMotivo, setFallbackMotivo] = useState<string | undefined>(
    undefined,
  );
  const [createdResult, setCreatedResult] =
    useState<AprobarBorradorResponse | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);

  const { data: projectsData } = useGetProjects({ workspaceId });
  const projects = (projectsData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const { data: drafts = [], isLoading: isLoadingDrafts } = useQuery({
    queryKey: ["discurso-borradores", workspaceId],
    queryFn: () => listarBorradoresDiscurso(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const extractMutation = useMutation({
    mutationFn: extraerOrdenesDiscurso,
    onSuccess: (res) => {
      setActiveDraft(res.borrador);
      setOrdenes(res.borrador.ordenes);
      setAsistentesText((res.borrador.asistentes ?? []).join(", "));
      setMotorUsado(res.motorUsado);
      setFallbackMotivo(res.fallbackMotivo);
      setCreatedResult(null);
      void queryClient.invalidateQueries({
        queryKey: ["discurso-borradores", workspaceId],
      });
      toast.success(
        `Se detectaron ${res.borrador.ordenes.length} órdenes (${
          res.motorUsado === "ollama" ? "IA local" : "Reglas"
        }).`,
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron extraer las órdenes.",
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      nextOrdenes,
      titulo,
      asistentes,
    }: {
      id: string;
      nextOrdenes: DiscursoOrdenBorrador[];
      titulo: string;
      asistentes: string[];
    }) =>
      actualizarBorradorDiscurso(id, {
        titulo,
        ordenes: nextOrdenes,
        asistentes,
      }),
    onSuccess: (updated) => {
      setActiveDraft(updated);
      setOrdenes(updated.ordenes);
      setAsistentesText((updated.asistentes ?? []).join(", "));
      void queryClient.invalidateQueries({
        queryKey: ["discurso-borradores", workspaceId],
      });
      toast.success("Borrador guardado.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el borrador.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: eliminarBorradorDiscurso,
    onSuccess: ({ id }) => {
      if (activeDraft?.id === id) {
        setActiveDraft(null);
        setOrdenes([]);
        setAsistentesText("");
        setCreatedResult(null);
      }
      void queryClient.invalidateQueries({
        queryKey: ["discurso-borradores", workspaceId],
      });
      toast.success("Borrador eliminado.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el borrador.",
      );
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      nextOrdenes,
      titulo,
      asistentes,
    }: {
      id: string;
      nextOrdenes: DiscursoOrdenBorrador[];
      titulo: string;
      asistentes: string[];
    }) =>
      aprobarBorradorDiscurso(id, {
        titulo,
        defaultProyectoId: projects[0]?.id ?? null,
        ordenes: nextOrdenes,
        asistentes,
      }),
    onSuccess: (res) => {
      setActiveDraft(res.borrador);
      setOrdenes(res.borrador.ordenes);
      setAsistentesText((res.borrador.asistentes ?? []).join(", "));
      setCreatedResult(res);
      void queryClient.invalidateQueries({
        queryKey: ["discurso-borradores", workspaceId],
      });
      toast.success(
        `Se crearon ${res.tareasCreadas} tareas con etiqueta ORDEN.`,
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron crear las tareas.",
      );
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async ({
      id,
      titulo,
      asistentes,
    }: {
      id: string;
      titulo: string;
      asistentes: string[];
    }) => {
      const blob = await descargarActaPdf(id, { titulo, asistentes });
      saveAs(blob, buildActaFilename(titulo));
    },
    onSuccess: () => {
      toast.success("Acta PDF descargada.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo generar el Acta PDF.",
      );
    },
  });

  const handleLoadExample = async () => {
    setIsLoadingExample(true);
    try {
      return await obtenerEjemploDiscurso();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el discurso de ejemplo.",
      );
      return null;
    } finally {
      setIsLoadingExample(false);
    }
  };

  const handleSelectDraft = (draft: DiscursoBorrador) => {
    setActiveDraft(draft);
    setOrdenes(draft.ordenes);
    setAsistentesText((draft.asistentes ?? []).join(", "));
    setMotorUsado(draft.motorUsado);
    setFallbackMotivo(undefined);
    setCreatedResult(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-border/80 border-b pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <FileAudio2 className="size-4 shrink-0 text-[#4B5D3A]" />
            <h1 className="font-semibold text-base text-foreground tracking-tight sm:text-lg">
              Discurso / Reunión → Tareas
            </h1>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Extrae órdenes, responsables SIGEFANB y plazos desde transcripciones
            o grabaciones Plaud para aprobarlas en lote.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <DraftsList
          drafts={drafts}
          activeDraftId={activeDraft?.id ?? null}
          isLoading={isLoadingDrafts}
          onSelect={handleSelectDraft}
          onDelete={(id) => deleteMutation.mutate(id)}
        />

        <div className="min-w-0 flex-1 space-y-5">
          <SourcePanel
            isExtracting={extractMutation.isPending}
            isLoadingExample={isLoadingExample}
            onLoadExample={handleLoadExample}
            onExtract={(payload) =>
              extractMutation.mutate({
                workspaceId,
                titulo: payload.titulo || undefined,
                fechaDiscurso: payload.fechaDiscurso || null,
                contenido: payload.contenido,
                formato: payload.formato,
                fuenteTipo: payload.fuenteTipo,
                fuenteReferencia: payload.fuenteReferencia ?? null,
                defaultProyectoId: projects[0]?.id ?? null,
              })
            }
          />

          {createdResult ? (
            <section className="space-y-3 rounded-xl border border-[#4B5D3A]/40 bg-[#4B5D3A]/8 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="size-4 text-[#4B5D3A]" />
                <h2 className="font-semibold text-sm text-foreground">
                  {createdResult.tareasCreadas}{" "}
                  {createdResult.tareasCreadas === 1
                    ? "tarea creada"
                    : "tareas creadas"}{" "}
                  correctamente
                </h2>
                <Badge variant="outline" size="sm">
                  ORDEN
                </Badge>
              </div>
              <div className="space-y-1.5">
                {createdResult.tareas.map((task) => {
                  const matchedOrder = ordenes.find(
                    (o) => o.createdTaskId === task.id,
                  );
                  return (
                    <Link
                      key={task.id}
                      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                      params={{
                        workspaceId,
                        projectId: task.projectId,
                        taskId: task.id,
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-xs hover:bg-accent/50"
                    >
                      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        {matchedOrder?.folio ? (
                          <Badge
                            variant="outline"
                            size="sm"
                            className="font-mono"
                          >
                            {matchedOrder.folio}
                          </Badge>
                        ) : null}
                        <span className="truncate">
                          {task.number ? `#${task.number} · ` : ""}
                          {task.title}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeDraft ? (
            <OrdersReviewList
              ordenes={ordenes}
              projects={projects}
              motorUsado={motorUsado}
              fallbackMotivo={fallbackMotivo}
              asistentesText={asistentesText}
              onChangeAsistentesText={setAsistentesText}
              isSaving={saveMutation.isPending}
              isApproving={approveMutation.isPending}
              isDownloadingPdf={downloadPdfMutation.isPending}
              canSaveDraft={activeDraft.id !== "preview"}
              canDownloadPdf={activeDraft.id !== "preview"}
              onChangeOrdenes={setOrdenes}
              onSaveDraft={() =>
                saveMutation.mutate({
                  id: activeDraft.id,
                  titulo: activeDraft.titulo,
                  nextOrdenes: ordenes,
                  asistentes: parseAsistentes(asistentesText),
                })
              }
              onDownloadPdf={() =>
                downloadPdfMutation.mutate({
                  id: activeDraft.id,
                  titulo: activeDraft.titulo,
                  asistentes: parseAsistentes(asistentesText),
                })
              }
              onApprove={() =>
                approveMutation.mutate({
                  id: activeDraft.id,
                  titulo: activeDraft.titulo,
                  nextOrdenes: ordenes,
                  asistentes: parseAsistentes(asistentesText),
                })
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
