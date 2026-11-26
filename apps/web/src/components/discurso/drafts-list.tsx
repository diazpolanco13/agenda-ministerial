import { ChevronDown, FileCheck2, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DiscursoBorrador } from "@/fetchers/discurso";
import { cn } from "@/lib/cn";

type DraftsListProps = {
  drafts: DiscursoBorrador[];
  activeDraftId: string | null;
  isLoading: boolean;
  onSelect: (draft: DiscursoBorrador) => void;
  onDelete: (id: string) => void;
};

export function DraftsList({
  drafts,
  activeDraftId,
  isLoading,
  onSelect,
  onDelete,
}: DraftsListProps) {
  const content = (
    <div className="space-y-2">
      {isLoading ? (
        <p className="py-3 text-xs text-muted-foreground">
          Cargando borradores...
        </p>
      ) : drafts.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">
          Aún no hay actas borrador guardadas en este espacio.
        </p>
      ) : (
        drafts.map((draft) => {
          const isActive = draft.id === activeDraftId;
          const isApproved = draft.estado === "aprobado";

          return (
            <div
              key={draft.id}
              className={cn(
                "group flex items-start gap-2 rounded-lg border p-2.5 transition-colors",
                isActive
                  ? "border-[#4B5D3A]/60 bg-[#4B5D3A]/8"
                  : "border-border/80 bg-background/60 hover:bg-accent/40",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(draft)}
                className="min-w-0 flex-1 text-left outline-none"
              >
                <div className="flex items-center gap-1.5">
                  {isApproved ? (
                    <FileCheck2 className="size-3.5 shrink-0 text-[#4B5D3A]" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium text-xs text-foreground">
                    {draft.titulo}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={isApproved ? "success" : "secondary"}
                    size="sm"
                  >
                    {isApproved
                      ? `Aprobado · ${draft.tareasCreadas}`
                      : `Borrador · ${draft.ordenes.length}`}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(draft.updatedAt).toLocaleDateString("es-VE")}
                  </span>
                </div>
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Eliminar borrador ${draft.titulo}`}
                onClick={() => onDelete(draft.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="hidden rounded-xl border border-border/80 bg-card p-3.5 lg:block">
        <h2 className="mb-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Borradores guardados ({drafts.length})
        </h2>
        {content}
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3 lg:hidden">
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            <span>Borradores guardados ({drafts.length})</span>
            <ChevronDown className="size-3.5" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">{content}</CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
}
