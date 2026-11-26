import { useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceOrderModalProps = {
  open: boolean;
  workspaceId: string;
  onOpenChange: (open: boolean) => void;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as SpeechWindow;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function VoiceOrderModal({
  open,
  workspaceId,
  onOpenChange,
}: VoiceOrderModalProps) {
  const navigate = useNavigate();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const isSupported = getSpeechRecognitionConstructor() !== null;

  const stopListening = () => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // Ignora errores si el reconocimiento ya finalizó
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
  };

  useEffect(() => {
    if (!open) {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [open]);

  const startListening = () => {
    const SpeechRec = getSpeechRecognitionConstructor();
    if (!SpeechRec) {
      setSpeechError(
        "Este navegador no admite dictado por voz. Puedes escribir la orden directamente.",
      );
      return;
    }

    stopListening();
    setSpeechError(null);

    const recognition = new SpeechRec();
    recognition.lang = "es-VE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      if (finalChunk.trim()) {
        setContenido((prev) => {
          const base = prev.trimEnd();
          return base ? `${base} ${finalChunk.trim()}` : finalChunk.trim();
        });
      }
      setInterimText(interimChunk.trim());
    };

    recognition.onerror = (event) => {
      const errorMap: Record<string, string> = {
        "not-allowed":
          "Permiso de micrófono denegado. Habilita el micrófono o escribe la orden manualmente.",
        "no-speech": "No se detectó voz. Puedes volver a intentarlo.",
        "audio-capture": "No se encontró un micrófono disponible.",
        network: "Error de red durante el reconocimiento de voz.",
      };
      setSpeechError(
        errorMap[event.error] ??
          "No se pudo continuar con el dictado por voz. Puedes editar el texto manualmente.",
      );
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setSpeechError(
        "No se pudo iniciar el micrófono. Escribe la instrucción directamente.",
      );
      setIsListening(false);
    }
  };

  const handleContinue = () => {
    const mergedText = [contenido.trim(), interimText.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (mergedText.length < 10) {
      toast.error(
        "Dicta o escribe al menos 10 caracteres para continuar a la extracción.",
      );
      return;
    }

    stopListening();

    const todayLabel = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

    const payload = {
      titulo: titulo.trim() || `Dictado Despacho (${todayLabel})`,
      contenido: mergedText,
      fuenteTipo: "texto" as const,
      fuenteReferencia: "Dictado Despacho",
    };

    try {
      sessionStorage.setItem(
        "agenda-discurso-prefill",
        JSON.stringify(payload),
      );
    } catch {
      toast.error("No se pudo guardar temporalmente el texto dictado.");
      return;
    }

    onOpenChange(false);
    void navigate({
      to: "/dashboard/workspace/$workspaceId/discurso",
      params: { workspaceId },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mic className="size-5 text-[#4B5D3A]" />
            Nueva orden por voz
          </DialogTitle>
          <DialogDescription>
            Dicta la instrucción en español para convertirla en órdenes
            asignables con responsable y plazo.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          {!isSupported ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <MicOff className="mt-0.5 size-4 shrink-0" />
              <p>
                Tu navegador no soporta la API Web Speech para dictado por voz.
                Puedes escribir o pegar directamente la instrucción aquí abajo.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/25 p-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={isListening ? "default" : "secondary"}
                  className={isListening ? "bg-red-600 text-white" : undefined}
                >
                  {isListening ? "Escuchando (es-VE)…" : "Micrófono listo"}
                </Badge>
              </div>

              {isListening ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-12 px-5"
                  onClick={stopListening}
                >
                  <Square className="size-4" />
                  Detener dictado
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-12 bg-[#4B5D3A] border-[#4B5D3A] px-5 text-white hover:bg-[#3F4E30]"
                  onClick={startListening}
                >
                  <Mic className="size-4" />
                  Iniciar dictado
                </Button>
              )}
            </div>
          )}

          {speechError ? (
            <p role="alert" className="text-xs text-destructive">
              {speechError}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="voice-order-title"
              className="block font-medium text-xs text-muted-foreground"
            >
              Título de referencia (opcional)
            </label>
            <Input
              id="voice-order-title"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ej. Instrucciones del Despacho Ministerial"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="voice-order-text"
              className="block font-medium text-xs text-muted-foreground"
            >
              Transcripción de la orden
            </label>
            <Textarea
              id="voice-order-text"
              rows={6}
              value={contenido}
              onChange={(event) => setContenido(event.target.value)}
              placeholder="Dicta o escribe la orden indicando qué debe hacerse, quién es el responsable y cuál es el plazo..."
              className="min-h-36 text-base sm:text-sm"
            />
            {interimText ? (
              <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs italic text-muted-foreground">
                Transcribiendo: {interimText}
              </p>
            ) : null}
          </div>
        </DialogPanel>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-12 bg-[#1E3A5F] border-[#1E3A5F] px-5 text-white hover:bg-[#172D4B]"
            onClick={handleContinue}
          >
            <Sparkles className="size-4" />
            Continuar a extracción de órdenes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
