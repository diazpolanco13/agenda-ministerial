import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FileUp,
  Loader2,
  Mic,
  Sparkles,
  Terminal,
  Wand2,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DiscursoFuenteTipo } from "@/fetchers/discurso";
import {
  listarGrabacionesPlaud,
  obtenerEstadoPlaud,
  obtenerResumenPlaud,
  obtenerTranscripcionPlaud,
} from "@/fetchers/plaud";
import { toast } from "@/lib/toast";

type ExtractPayload = {
  titulo: string;
  fechaDiscurso: string;
  contenido: string;
  formato?: "txt" | "md" | "vtt" | "srt" | "json";
  fuenteTipo: DiscursoFuenteTipo;
  fuenteReferencia?: string | null;
};

type SourcePanelProps = {
  isExtracting: boolean;
  isLoadingExample: boolean;
  onExtract: (payload: ExtractPayload) => void;
  onLoadExample: () => Promise<{
    titulo: string;
    fechaDiscurso: string;
    texto: string;
  } | null>;
};

function inferFormatoFromName(
  filename: string,
): "txt" | "md" | "vtt" | "srt" | "json" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".srt")) return "srt";
  if (lower.endsWith(".json")) return "json";
  return "txt";
}

export function SourcePanel({
  isExtracting,
  isLoadingExample,
  onExtract,
  onLoadExample,
}: SourcePanelProps) {
  const [activeTab, setActiveTab] = useState("texto");
  const [titulo, setTitulo] = useState("");
  const [fechaDiscurso, setFechaDiscurso] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [contenido, setContenido] = useState("");
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [archivoFormato, setArchivoFormato] = useState<
    "txt" | "md" | "vtt" | "srt" | "json" | undefined
  >(undefined);
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data: plaudEstado, isLoading: loadingEstado } = useQuery({
    queryKey: ["plaud-estado"],
    queryFn: obtenerEstadoPlaud,
    enabled: activeTab === "plaud",
    staleTime: 30_000,
  });

  const { data: grabaciones = [], isLoading: loadingGrabaciones } = useQuery({
    queryKey: ["plaud-grabaciones"],
    queryFn: () => listarGrabacionesPlaud(14),
    enabled: activeTab === "plaud" && Boolean(plaudEstado?.conectado),
    staleTime: 30_000,
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 2 MB.");
      return;
    }

    const text = await file.text();
    const formato = inferFormatoFromName(file.name);
    setContenido(text);
    setArchivoNombre(file.name);
    setArchivoFormato(formato);
    if (!titulo.trim()) {
      setTitulo(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleExample = async () => {
    const ejemplo = await onLoadExample();
    if (!ejemplo) return;
    setActiveTab("texto");
    setTitulo(ejemplo.titulo);
    setFechaDiscurso(ejemplo.fechaDiscurso);
    setContenido(ejemplo.texto);
    setArchivoNombre(null);
    setArchivoFormato(undefined);
    onExtract({
      titulo: ejemplo.titulo,
      fechaDiscurso: ejemplo.fechaDiscurso,
      contenido: ejemplo.texto,
      fuenteTipo: "ejemplo",
      fuenteReferencia: "Ejemplo institucional",
    });
  };

  const handleImportPlaud = async (
    id: string,
    recordingTitle: string,
    mode: "transcripcion" | "resumen",
  ) => {
    setImportingId(id);
    try {
      const text =
        mode === "transcripcion"
          ? (await obtenerTranscripcionPlaud(id)).texto
          : (await obtenerResumenPlaud(id)).resumen;

      if (!text.trim()) {
        toast.error("Plaud devolvió contenido vacío para esta grabación.");
        return;
      }

      setTitulo(recordingTitle);
      setContenido(text);
      onExtract({
        titulo: recordingTitle,
        fechaDiscurso,
        contenido: text,
        fuenteTipo: "plaud",
        fuenteReferencia: `Plaud:${id}`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo importar desde Plaud.",
      );
    } finally {
      setImportingId(null);
    }
  };

  const submitManualOrFile = (fuenteTipo: DiscursoFuenteTipo) => {
    if (contenido.trim().length < 10) {
      toast.error("Ingresa al menos 10 caracteres para extraer órdenes.");
      return;
    }
    onExtract({
      titulo: titulo.trim(),
      fechaDiscurso,
      contenido,
      formato: fuenteTipo === "archivo" ? archivoFormato : undefined,
      fuenteTipo,
      fuenteReferencia:
        fuenteTipo === "archivo" ? archivoNombre : "Entrada manual",
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <label
              htmlFor="discurso-titulo"
              className="block font-medium text-xs text-muted-foreground"
            >
              Título del discurso o reunión
            </label>
            <Input
              id="discurso-titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ej. Reunión de Estado Mayor Superior"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label
              htmlFor="discurso-fecha"
              className="block font-medium text-xs text-muted-foreground"
            >
              Fecha de referencia
            </label>
            <Input
              id="discurso-fecha"
              type="date"
              value={fechaDiscurso}
              onChange={(event) => setFechaDiscurso(event.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={isLoadingExample}
          disabled={isExtracting}
          onClick={handleExample}
          className="w-full shrink-0 sm:w-auto"
        >
          <Wand2 className="size-3.5" />
          Probar con ejemplo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          <TabsTrigger value="texto">
            <FileText className="size-3.5" />
            Pegar texto
          </TabsTrigger>
          <TabsTrigger value="archivo">
            <FileUp className="size-3.5" />
            Subir archivo
          </TabsTrigger>
          <TabsTrigger value="plaud">
            <Mic className="size-3.5" />
            Plaud
          </TabsTrigger>
        </TabsList>

        <TabsContent value="texto" className="space-y-3 pt-2">
          <Textarea
            rows={7}
            value={contenido}
            onChange={(event) => setContenido(event.target.value)}
            placeholder="Pega aquí la transcripción, minuta o palabras del Ministro para extraer órdenes, responsables y plazos..."
            className="min-h-40 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {contenido.trim().length} caracteres
            </span>
            <Button
              type="button"
              loading={isExtracting}
              disabled={contenido.trim().length < 10}
              onClick={() => submitManualOrFile("texto")}
              className="w-full bg-[#1E3A5F] border-[#1E3A5F] text-white hover:bg-[#172D4B] sm:w-auto"
            >
              <Sparkles className="size-3.5" />
              Extraer órdenes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="archivo" className="space-y-3 pt-2">
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 space-y-2">
            <label
              htmlFor="discurso-file-input"
              className="block font-medium text-xs text-foreground"
            >
              Selecciona una transcripción o exportación
            </label>
            <Input
              id="discurso-file-input"
              type="file"
              accept=".txt,.md,.vtt,.srt,.json"
              onChange={handleFileChange}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Formatos compatibles: <code>.txt</code>, <code>.md</code>,{" "}
              <code>.vtt</code>, <code>.srt</code> y <code>.json</code> de
              Plaud.
            </p>
            {archivoNombre ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" size="sm">
                  {archivoNombre}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {contenido.length} caracteres cargados
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              loading={isExtracting}
              disabled={contenido.trim().length < 10}
              onClick={() => submitManualOrFile("archivo")}
              className="w-full bg-[#1E3A5F] border-[#1E3A5F] text-white hover:bg-[#172D4B] sm:w-auto"
            >
              <Sparkles className="size-3.5" />
              Procesar archivo y extraer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="plaud" className="space-y-3 pt-2">
          {loadingEstado ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/80 p-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Verificando conexión con Plaud CLI...
            </div>
          ) : !plaudEstado?.conectado ? (
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-muted-foreground" />
                <h3 className="font-medium text-sm text-foreground">
                  Conecta Plaud CLI para importar grabaciones directamente
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {plaudEstado?.mensaje ??
                  "No se detectó una sesión activa de Plaud CLI en este servidor."}
              </p>
              <pre className="overflow-x-auto rounded-md border border-border/80 bg-background px-3 py-2 font-mono text-xs text-foreground">
                npm i -g @plaud-ai/cli &amp;&amp; plaud login
              </pre>
              <p className="text-xs text-muted-foreground">
                Mientras tanto, puedes exportar la transcripción desde la app
                Plaud en formato <code>.txt</code>, <code>.md</code>,{" "}
                <code>.vtt</code>, <code>.srt</code> o <code>.json</code> y
                subirla en la pestaña <strong>Subir archivo</strong>.
              </p>
            </div>
          ) : loadingGrabaciones ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/80 p-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando grabaciones recientes de Plaud...
            </div>
          ) : grabaciones.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 p-4 text-xs text-muted-foreground">
              No se encontraron grabaciones recientes en los últimos 14 días.
            </div>
          ) : (
            <div className="space-y-2">
              {grabaciones.map((rec) => (
                <div
                  key={rec.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-xs text-foreground">
                      {rec.titulo}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {rec.fecha ?? "Sin fecha"}
                      {rec.duracionSegundos
                        ? ` · ${Math.max(1, Math.round(rec.duracionSegundos / 60))} min`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      loading={importingId === rec.id}
                      disabled={isExtracting}
                      onClick={() =>
                        handleImportPlaud(rec.id, rec.titulo, "transcripcion")
                      }
                    >
                      Importar transcripción
                    </Button>
                    {rec.resumenDisponible ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        loading={importingId === rec.id}
                        disabled={isExtracting}
                        onClick={() =>
                          handleImportPlaud(rec.id, rec.titulo, "resumen")
                        }
                      >
                        Usar resumen
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
