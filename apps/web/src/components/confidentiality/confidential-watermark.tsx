import { cn } from "@/lib/cn";

export function maskCedula(cedula?: string | null): string {
  const trimmed = cedula?.trim();
  if (!trimmed) {
    return "Sin cédula";
  }

  const prefixMatch = /^([VE]-?)\s*(.+)$/i.exec(trimmed);
  const prefix = prefixMatch
    ? `${prefixMatch[1].replace("-", "").toUpperCase()}-`
    : "";
  const body = (prefixMatch ? prefixMatch[2] : trimmed).trim();
  const normalized = body.replace(/[.\s]/g, "");

  if (!normalized) {
    return "Sin cédula";
  }

  if (normalized.length <= 4) {
    return `${prefix}${normalized}`;
  }

  return `${prefix}••••${normalized.slice(-4)}`;
}

export interface ConfidentialWatermarkProps {
  visible: boolean;
  userName: string;
  cedula?: string | null;
  dateLabel?: string;
  className?: string;
}

const WATERMARK_ROWS = [0, 1, 2, 3, 4, 5] as const;

export function ConfidentialWatermark({
  visible,
  userName,
  cedula,
  dateLabel,
  className,
}: ConfidentialWatermarkProps) {
  if (!visible) {
    return null;
  }

  const fecha = dateLabel?.trim() || new Date().toLocaleDateString("es-VE");
  const stamp = `CONFIDENCIAL · ${userName} · ${maskCedula(cedula)} · ${fecha}`;

  return (
    <div
      aria-hidden="true"
      data-testid="confidential-watermark"
      className={cn(
        "pointer-events-none select-none overflow-hidden absolute inset-0 z-10",
        className,
      )}
    >
      <div className="flex h-full w-full flex-col justify-around -rotate-24 scale-125 opacity-[0.065]">
        {WATERMARK_ROWS.map((row) => (
          <div
            key={row}
            className="flex whitespace-nowrap gap-10 text-xs font-semibold tracking-widest uppercase text-foreground"
          >
            <span>{stamp}</span>
            <span>{stamp}</span>
            <span>{stamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
