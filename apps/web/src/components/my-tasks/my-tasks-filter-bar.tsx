import { Bookmark, BookmarkPlus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SavedFilter } from "@/fetchers/user/saved-filters";
import {
  useCreateSavedFilter,
  useDeleteSavedFilter,
  useSavedFilters,
} from "@/hooks/queries/user/use-saved-filters";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  DEFAULT_MY_TASKS_FILTERS,
  hasActiveFilters,
  type MyTasksFilterState,
  type MyTasksGroupBy,
  type MyTasksScope,
  type MyTasksViewMode,
  type TaskLike,
} from "./my-tasks-filters";

type OptionItem = { id: string; name: string };

type MyTasksFilterBarProps = {
  workspaceId: string;
  scope: MyTasksScope;
  viewMode: MyTasksViewMode;
  groupBy: MyTasksGroupBy;
  onGroupByChange: (groupBy: MyTasksGroupBy) => void;
  filters: MyTasksFilterState;
  onFiltersChange: (next: MyTasksFilterState) => void;
  tasks: readonly TaskLike[];
  workspaces?: ReadonlyArray<OptionItem>;
};

const GROUP_BY_OPTIONS: ReadonlyArray<{ value: MyTasksGroupBy; label: string }> =
  [
    { value: "dueDate", label: "Fecha" },
    { value: "project", label: "Proyecto" },
    { value: "priority", label: "Prioridad" },
    { value: "status", label: "Estado" },
  ];

const PRIORITY_OPTIONS = [
  { id: "all", name: "Todas las prioridades" },
  { id: "urgent", name: "Urgente" },
  { id: "high", name: "Alta" },
  { id: "medium", name: "Media" },
  { id: "low", name: "Baja" },
  { id: "no-priority", name: "Sin prioridad" },
];

export function MyTasksFilterBar({
  workspaceId,
  scope,
  viewMode,
  groupBy,
  onGroupByChange,
  filters,
  onFiltersChange,
  tasks,
  workspaces = [],
}: MyTasksFilterBarProps) {
  const filterScope = scope === "delegated" ? "delegated" : "my-tasks";
  const { data: savedFilters = [] } = useSavedFilters(workspaceId, filterScope);
  const { mutateAsync: createFilter, isPending: savingFilter } =
    useCreateSavedFilter();
  const { mutateAsync: deleteFilter } = useDeleteSavedFilter(workspaceId);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedMenuOpen, setSavedMenuOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.projectId, task.projectName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const statuses = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.status, task.statusName ?? task.status);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      for (const label of task.labels) {
        map.set(label.name, label.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const active = hasActiveFilters(filters);

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = presetName.trim();
    if (!trimmed) return;
    try {
      await createFilter({
        workspaceId,
        scope: filterScope,
        name: trimmed,
        filters: { ...filters, groupBy, viewMode },
      });
      toast.success(`Filtro guardado: ${trimmed}`);
      setPresetName("");
      setSaveOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el filtro",
      );
    }
  };

  const applySavedFilter = (item: SavedFilter) => {
    const raw = item.filters as Partial<MyTasksFilterState> & {
      groupBy?: MyTasksGroupBy;
    };
    onFiltersChange({
      ...DEFAULT_MY_TASKS_FILTERS,
      search: typeof raw.search === "string" ? raw.search : "",
      projectId: typeof raw.projectId === "string" ? raw.projectId : "all",
      priority: typeof raw.priority === "string" ? raw.priority : "all",
      status: typeof raw.status === "string" ? raw.status : "all",
      labelId: typeof raw.labelId === "string" ? raw.labelId : "all",
      allWorkspaces: Boolean(raw.allWorkspaces),
      workspaceFilterId:
        typeof raw.workspaceFilterId === "string"
          ? raw.workspaceFilterId
          : "all",
      segment: raw.segment ?? "all",
    });
    if (raw.groupBy) {
      onGroupByChange(raw.groupBy);
    }
    setSavedMenuOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-border/60 border-b bg-background px-4 py-2 sm:px-5">
      <div className="relative min-w-44 flex-1 sm:max-w-xs">
        <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          placeholder="Buscar por título, código, proyecto..."
          aria-label="Buscar tareas"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={filters.projectId}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, projectId: value || "all" })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Filtrar por proyecto"
            className="h-8 w-auto min-w-28 text-xs"
          >
            <SelectValue placeholder="Proyecto">
              {filters.projectId === "all"
                ? "Proyecto"
                : (projects.find((p) => p.id === filters.projectId)?.name ??
                  "Proyecto")}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, priority: value || "all" })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Filtrar por prioridad"
            className="h-8 w-auto min-w-26 text-xs"
          >
            <SelectValue placeholder="Prioridad">
              {filters.priority === "all"
                ? "Prioridad"
                : (PRIORITY_OPTIONS.find((p) => p.id === filters.priority)
                    ?.name ?? "Prioridad")}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value || "all" })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Filtrar por estado"
            className="h-8 w-auto min-w-24 text-xs"
          >
            <SelectValue placeholder="Estado">
              {filters.status === "all"
                ? "Estado"
                : (statuses.find((s) => s.id === filters.status)?.name ??
                  "Estado")}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="all">Todos los estados</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {labels.length > 0 && (
          <Select
            value={filters.labelId}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, labelId: value || "all" })
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Filtrar por etiqueta"
              className="h-8 w-auto min-w-24 text-xs"
            >
              <SelectValue placeholder="Etiqueta">
                {filters.labelId === "all" ? "Etiqueta" : filters.labelId}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}

        {workspaces.length > 1 && (
          <Select
            value={filters.allWorkspaces ? filters.workspaceFilterId : "current"}
            onValueChange={(value) => {
              if (!value || value === "current") {
                onFiltersChange({
                  ...filters,
                  allWorkspaces: false,
                  workspaceFilterId: "all",
                });
              } else {
                onFiltersChange({
                  ...filters,
                  allWorkspaces: true,
                  workspaceFilterId: value,
                });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label="Filtrar por espacio"
              className="h-8 w-auto min-w-28 text-xs"
            >
              <SelectValue placeholder="Espacio">
                {!filters.allWorkspaces
                  ? "Este espacio"
                  : filters.workspaceFilterId === "all"
                    ? "Todos los espacios"
                    : (workspaces.find((w) => w.id === filters.workspaceFilterId)
                        ?.name ?? "Espacio")}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="current">Este espacio</SelectItem>
              <SelectItem value="all">Todos los espacios</SelectItem>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}

        {scope === "assigned" && viewMode === "list" && (
          <Select
            value={groupBy}
            onValueChange={(value) =>
              onGroupByChange((value as MyTasksGroupBy) || "dueDate")
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Agrupar por"
              className="h-8 w-auto min-w-28 text-xs"
            >
              <SelectValue>
                {`Agrupar: ${GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label ?? "Fecha"}`}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {GROUP_BY_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Popover open={savedMenuOpen} onOpenChange={setSavedMenuOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
              />
            }
          >
            <Bookmark className="size-3.5" />
            <span>Guardados</span>
            {savedFilters.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">
                {savedFilters.length}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Filtros guardados
            </p>
            {savedFilters.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No hay filtros guardados todavía.
              </p>
            ) : (
              <div className="mt-1 flex max-h-60 flex-col gap-1 overflow-y-auto">
                {savedFilters.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-1.5 hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => applySavedFilter(item)}
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium text-foreground"
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar filtro ${item.name}`}
                      onClick={() => {
                        void deleteFilter(item.id).catch(() =>
                          toast.error("No se pudo eliminar el filtro"),
                        );
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-destructive-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={saveOpen} onOpenChange={setSaveOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
              />
            }
          >
            <BookmarkPlus className="size-3.5" />
            <span className="hidden sm:inline">Guardar filtro</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            <form onSubmit={handleSavePreset} className="space-y-2.5">
              <p className="text-xs font-medium text-foreground">
                Guardar filtro actual
              </p>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Ej. Urgentes esta semana"
                className="h-8 text-xs"
                autoFocus
                maxLength={80}
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSaveOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!presetName.trim() || savingFilter}
                >
                  Guardar
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>

        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onFiltersChange({
                ...DEFAULT_MY_TASKS_FILTERS,
                segment: filters.segment,
              })
            }
            className={cn("h-8 gap-1 px-2 text-xs text-muted-foreground")}
          >
            <X className="size-3.5" />
            <span>Limpiar</span>
          </Button>
        )}
      </div>
    </div>
  );
}
