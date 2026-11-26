import {
  CheckCircle2,
  Download,
  FileCheck2,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Stamp,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getApiUrl } from "@/fetchers/get-api-url";
import type { OrderClosureStatus, OrderOrigin } from "@/fetchers/ordenes";
import {
  useApproveOrder,
  useMarkAsOrder,
  useOrdenes,
  useReturnOrder,
  useSubmitOrderEvidence,
  useUploadOrderEvidenceFile,
} from "@/hooks/queries/ordenes/use-ordenes";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export type OrderClosureCardTask = {
  isOrder?: boolean;
  orderFolio?: string | null;
  orderOrigin?: string | null;
  orderQuote?: string | null;
  orderClosureStatus?: string | null;
  orderEvidenceText?: string | null;
  orderEvidenceAssetId?: string | null;
  orderEvidenceSubmittedAt?: string | null;
  orderReviewedAt?: string | null;
  orderReviewComment?: string | null;
  orderSealHash?: string | null;
};

type OrderClosureCardProps = {
  taskId: string;
  workspaceId: string;
  projectId: string;
  task: OrderClosureCardTask;
  canApprove?: boolean;
};

const ORIGIN_LABELS: Record<OrderOrigin, string> = {
  discurso: "Discurso",
  audiencia: "Audiencia",
  verbal: "Orden verbal",
  escrita: "Instrucción escrita",
};

const CLOSURE_BADGE: Record<
  OrderClosureStatus,
  { label: string; className: string }
> = {
  abierta: {
    label: "Abierta",
    className: "border-border bg-muted/70 text-foreground dark:bg-muted/40",
  },
  en_revision: {
    label: "En revisión",
    className:
      "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300",
  },
  aprobada: {
    label: "Aprobada",
    className:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  devuelta: {
    label: "Devuelta",
    className:
      "border-red-600/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300",
  },
};

function formatCaracasDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatOriginLabel(origin: string | null | undefined): string {
  if (!origin) return "No especificado";
  return ORIGIN_LABELS[origin as OrderOrigin] ?? origin;
}

function resolveClosureStatus(
  status: string | null | undefined,
): OrderClosureStatus {
  if (
    status === "abierta" ||
    status === "en_revision" ||
    status === "aprobada" ||
    status === "devuelta"
  ) {
    return status;
  }
  return "abierta";
}

function summarizeHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function OrderClosureCard({
  taskId,
  workspaceId,
  projectId: _projectId,
  task,
  canApprove: canApproveProp,
}: OrderClosureCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMarkingOpen, setIsMarkingOpen] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<OrderOrigin>("escrita");
  const [quoteText, setQuoteText] = useState("");

  const [evidenceText, setEvidenceText] = useState(
    () => task.orderEvidenceText ?? "",
  );
  const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(
    () => task.orderEvidenceAssetId ?? null,
  );
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const [reviewAction, setReviewAction] = useState<"approve" | "return" | null>(
    null,
  );
  const [reviewComment, setReviewComment] = useState("");
  const [showFullSeal, setShowFullSeal] = useState(false);

  const shouldLookupApproval =
    canApproveProp === undefined &&
    Boolean(workspaceId) &&
    Boolean(task.isOrder) &&
    task.orderClosureStatus === "en_revision";

  const ordenesQuery = useOrdenes(
    shouldLookupApproval ? workspaceId : undefined,
  );
  const canApprove = canApproveProp ?? ordenesQuery.data?.canApprove ?? false;

  const markMutation = useMarkAsOrder();
  const uploadMutation = useUploadOrderEvidenceFile();
  const submitEvidenceMutation = useSubmitOrderEvidence();
  const approveMutation = useApproveOrder();
  const returnMutation = useReturnOrder();

  const handleMarkAsOrder = () => {
    markMutation.mutate(
      {
        taskId,
        origin: selectedOrigin,
        quote: quoteText.trim() || null,
      },
      {
        onSuccess: (res) => {
          setIsMarkingOpen(false);
          setQuoteText("");
          toast.success(
            res.orderFolio
              ? `Orden registrada con folio ${res.orderFolio}.`
              : "Tarea marcada como Orden del Ministro.",
          );
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo marcar la tarea como orden.",
          );
        },
      },
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(
      { taskId, file },
      {
        onSuccess: (uploaded) => {
          setUploadedAssetId(uploaded.assetId);
          setUploadedFilename(uploaded.filename);
          toast.success(`Archivo "${uploaded.filename}" adjuntado.`);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo subir el archivo de evidencia.",
          );
        },
      },
    );
  };

  const handleSubmitEvidence = () => {
    const cleanText = evidenceText.trim() || null;
    const assetId = uploadedAssetId ?? task.orderEvidenceAssetId ?? null;
    if (!cleanText && !assetId) {
      toast.error(
        "Describe el cumplimiento o adjunta un archivo de soporte antes de enviar.",
      );
      return;
    }

    submitEvidenceMutation.mutate(
      {
        taskId,
        evidenceText: cleanText,
        evidenceAssetId: assetId,
      },
      {
        onSuccess: () => {
          toast.success("Evidencia enviada para visto bueno.");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo enviar la evidencia.",
          );
        },
      },
    );
  };

  const handleApprove = () => {
    approveMutation.mutate(
      {
        taskId,
        comment: reviewComment.trim() || null,
      },
      {
        onSuccess: () => {
          setReviewAction(null);
          setReviewComment("");
          toast.success("Visto bueno otorgado y orden sellada.");
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

  const handleReturn = () => {
    const clean = reviewComment.trim();
    if (clean.length < 3) {
      toast.error("Indica el motivo de la devolución (mínimo 3 caracteres).");
      return;
    }

    returnMutation.mutate(
      {
        taskId,
        comment: clean,
      },
      {
        onSuccess: () => {
          setReviewAction(null);
          setReviewComment("");
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

  if (!task.isOrder) {
    return (
      <section
        aria-label="Orden del Ministro"
        className="rounded-xl border border-border/80 bg-card/60 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Stamp className="size-4 shrink-0 text-[#4B5D3A]" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground">
                Seguimiento como Orden Ministerial
              </p>
              <p className="text-xs text-muted-foreground">
                Asigna folio oficial, registro de evidencia y cierre con visto
                bueno.
              </p>
            </div>
          </div>

          {!isMarkingOpen ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsMarkingOpen(true)}
            >
              <Stamp className="size-3.5" />
              Marcar como Orden del Ministro
            </Button>
          ) : null}
        </div>

        {isMarkingOpen ? (
          <div className="mt-4 space-y-3 border-border/70 border-t pt-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor={`order-origin-${taskId}`}
                  className="block font-medium text-xs text-muted-foreground"
                >
                  Origen de la orden
                </label>
                <Select
                  value={selectedOrigin}
                  onValueChange={(value) => {
                    if (
                      value === "discurso" ||
                      value === "audiencia" ||
                      value === "verbal" ||
                      value === "escrita"
                    ) {
                      setSelectedOrigin(value);
                    }
                  }}
                >
                  <SelectTrigger
                    id={`order-origin-${taskId}`}
                    aria-label="Origen de la orden"
                  >
                    <SelectValue>{ORIGIN_LABELS[selectedOrigin]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escrita">Instrucción escrita</SelectItem>
                    <SelectItem value="verbal">Orden verbal</SelectItem>
                    <SelectItem value="audiencia">Audiencia</SelectItem>
                    <SelectItem value="discurso">Discurso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`order-quote-${taskId}`}
                className="block font-medium text-xs text-muted-foreground"
              >
                Cita textual o instrucción original (opcional)
              </label>
              <Textarea
                id={`order-quote-${taskId}`}
                rows={2}
                value={quoteText}
                onChange={(event) => setQuoteText(event.target.value)}
                placeholder="Transcribe brevemente la instrucción exacta emitida..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={markMutation.isPending}
                onClick={() => setIsMarkingOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                loading={markMutation.isPending}
                onClick={handleMarkAsOrder}
                className="bg-[#4B5D3A] border-[#4B5D3A] text-white hover:bg-[#3F4E30]"
              >
                <Stamp className="size-3.5" />
                Confirmar Orden
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const closureStatus = resolveClosureStatus(task.orderClosureStatus);
  const closureBadge = CLOSURE_BADGE[closureStatus];
  const canSubmitEvidence =
    closureStatus === "abierta" || closureStatus === "devuelta";
  const canReview = closureStatus === "en_revision" && canApprove;
  const activeAssetId = uploadedAssetId ?? task.orderEvidenceAssetId ?? null;
  const submittedAtLabel = formatCaracasDateTime(task.orderEvidenceSubmittedAt);
  const reviewedAtLabel = formatCaracasDateTime(task.orderReviewedAt);

  return (
    <section
      aria-label="Control de cierre de orden"
      className="space-y-4 rounded-xl border border-[#4B5D3A]/30 bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-border/70 border-b pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Stamp className="size-4 shrink-0 text-[#4B5D3A]" />
          <span className="font-semibold text-sm text-foreground">
            Orden del Ministro
          </span>
          {task.orderFolio ? (
            <Badge
              variant="outline"
              size="sm"
              className="font-mono tracking-tight"
            >
              {task.orderFolio}
            </Badge>
          ) : null}
          {task.orderOrigin ? (
            <Badge variant="secondary" size="sm">
              {formatOriginLabel(task.orderOrigin)}
            </Badge>
          ) : null}
        </div>

        <Badge
          variant="outline"
          size="sm"
          className={cn("font-medium", closureBadge.className)}
        >
          {closureBadge.label}
        </Badge>
      </div>

      {task.orderQuote ? (
        <blockquote className="rounded-lg border-l-2 border-[#4B5D3A]/60 bg-muted/40 px-3 py-2 text-xs italic text-foreground/90">
          “{task.orderQuote}”
        </blockquote>
      ) : null}

      {task.orderEvidenceText || task.orderEvidenceAssetId ? (
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-xs text-foreground">
              <FileCheck2 className="size-3.5 text-[#4B5D3A]" />
              Evidencia registrada
            </span>
            {submittedAtLabel ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {submittedAtLabel}
              </span>
            ) : null}
          </div>

          {task.orderEvidenceText ? (
            <p className="whitespace-pre-wrap text-xs text-foreground/90">
              {task.orderEvidenceText}
            </p>
          ) : null}

          {task.orderEvidenceAssetId ? (
            <a
              href={getApiUrl(`/asset/${task.orderEvidenceAssetId}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 py-1.5 font-medium text-xs text-foreground transition-colors hover:bg-accent"
            >
              <Download className="size-3.5 text-muted-foreground" />
              Descargar soporte adjunto
            </a>
          ) : null}
        </div>
      ) : null}

      {task.orderReviewComment || reviewedAtLabel ? (
        <div
          className={cn(
            "space-y-1 rounded-lg border p-3 text-xs",
            closureStatus === "devuelta"
              ? "border-red-500/30 bg-red-500/5"
              : "border-emerald-500/30 bg-emerald-500/5",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              {closureStatus === "devuelta"
                ? "Observación de devolución"
                : "Nota de visto bueno"}
            </span>
            {reviewedAtLabel ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {reviewedAtLabel}
              </span>
            ) : null}
          </div>
          {task.orderReviewComment ? (
            <p className="whitespace-pre-wrap text-foreground/90">
              {task.orderReviewComment}
            </p>
          ) : null}
        </div>
      ) : null}

      {canSubmitEvidence ? (
        <div className="space-y-3 border-border/70 border-t pt-3">
          <p className="font-medium text-xs text-foreground">
            {closureStatus === "devuelta"
              ? "Subsanar y reenviar evidencia de cumplimiento"
              : "Reportar cumplimiento para visto bueno"}
          </p>

          <Textarea
            rows={3}
            value={evidenceText}
            onChange={(event) => setEvidenceText(event.target.value)}
            placeholder="Describe las acciones ejecutadas, resultados o número de oficio de soporte..."
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                aria-label="Adjuntar archivo de evidencia"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={uploadMutation.isPending}
                disabled={submitEvidenceMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Adjuntar archivo
              </Button>
              {uploadedFilename ? (
                <Badge variant="outline" size="sm" className="gap-1">
                  <Paperclip className="size-3" />
                  {uploadedFilename}
                </Badge>
              ) : activeAssetId ? (
                <Badge variant="outline" size="sm" className="gap-1">
                  <Paperclip className="size-3" />
                  Archivo previo vinculado
                </Badge>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              loading={submitEvidenceMutation.isPending}
              disabled={uploadMutation.isPending}
              onClick={handleSubmitEvidence}
              className="bg-[#1E3A5F] border-[#1E3A5F] text-white hover:bg-[#172D4B]"
            >
              <FileCheck2 className="size-3.5" />
              Enviar a revisión
            </Button>
          </div>
        </div>
      ) : null}

      {canReview ? (
        <div className="space-y-3 border-border/70 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-xs text-foreground">
              Decisión de cierre ministerial
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={approveMutation.isPending || returnMutation.isPending}
                onClick={() => {
                  setReviewAction((prev) =>
                    prev === "return" ? null : "return",
                  );
                }}
                className="border-red-600/30 text-red-700 hover:bg-red-500/10 dark:text-red-300"
              >
                <RotateCcw className="size-3.5" />
                Devolver
              </Button>
              <Button
                type="button"
                size="sm"
                loading={approveMutation.isPending && reviewAction === null}
                disabled={returnMutation.isPending}
                onClick={() => {
                  if (reviewAction === "approve") {
                    handleApprove();
                  } else {
                    setReviewAction("approve");
                  }
                }}
                className="bg-[#4B5D3A] border-[#4B5D3A] text-white hover:bg-[#3F4E30]"
              >
                <CheckCircle2 className="size-3.5" />
                Visto bueno
              </Button>
            </div>
          </div>

          {reviewAction ? (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
              <label
                htmlFor={`order-review-comment-${taskId}`}
                className="block font-medium text-xs text-muted-foreground"
              >
                {reviewAction === "return"
                  ? "Motivo de devolución (requerido, mínimo 3 caracteres)"
                  : "Observación del visto bueno (opcional)"}
              </label>
              <Textarea
                id={`order-review-comment-${taskId}`}
                rows={2}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={
                  reviewAction === "return"
                    ? "Indica qué debe corregirse o ampliarse en el soporte..."
                    : "Comentario opcional para el expediente..."
                }
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={
                    approveMutation.isPending || returnMutation.isPending
                  }
                  onClick={() => {
                    setReviewAction(null);
                    setReviewComment("");
                  }}
                >
                  Cancelar
                </Button>
                {reviewAction === "return" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    loading={returnMutation.isPending}
                    onClick={handleReturn}
                  >
                    Confirmar devolución
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="xs"
                    loading={approveMutation.isPending}
                    onClick={handleApprove}
                    className="bg-[#4B5D3A] border-[#4B5D3A] text-white hover:bg-[#3F4E30]"
                  >
                    Confirmar visto bueno
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {task.orderSealHash ? (
        <div className="space-y-1.5 border-border/70 border-t pt-2.5 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setShowFullSeal((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ShieldCheck className="size-3.5 shrink-0 text-[#4B5D3A]" />
                    <span>
                      Sello SHA-256: {summarizeHash(task.orderSealHash)}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs break-all font-mono text-[11px]">
                  {task.orderSealHash}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {showFullSeal ? (
            <p className="break-all rounded bg-muted/50 px-2 py-1 font-mono text-[10px] text-foreground/80">
              {task.orderSealHash}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
