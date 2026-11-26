import { ResponsableAvatar } from "@/components/responsable-avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/cn";
import { componentLogo, maskCedula, rankInsignia } from "@/lib/military-assets";

type ResponsableHoverCardProps = {
  userId?: string | null;
  name?: string | null;
  image?: string | null;
  cedula?: string | null;
  nacionalidad?: string | null;
  grado?: string | null;
  componente?: string | null;
  unidad?: string | null;
  children: React.ReactNode;
};

/**
 * Tarjeta flotante con la ficha militar del responsable (foto oficial, grado
 * con insignia, componente con escudo y unidad de adscripción).
 */
export function ResponsableHoverCard({
  userId,
  name,
  image,
  cedula,
  nacionalidad,
  grado,
  componente,
  unidad,
  children,
}: ResponsableHoverCardProps) {
  const insignia = grado ? rankInsignia(grado, componente, unidad) : null;
  const compLogo = componente ? componentLogo(componente) : null;
  const maskedCedula = cedula ? maskCedula(cedula, nacionalidad) : "";

  return (
    <HoverCard openDelay={220} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-76 p-3.5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <ResponsableAvatar
            userId={userId}
            name={name}
            image={image}
            cedula={cedula}
            grado={grado}
            componente={componente}
            unidad={unidad}
            size="lg"
            className="size-16 text-lg"
            showHoverCard={false}
          />
          <div className="min-w-0 flex-1 space-y-1">
            {grado ? (
              <div className="flex items-center gap-1.5">
                {insignia ? (
                  <img
                    src={insignia.src}
                    alt={insignia.name}
                    className={cn(
                      "shrink-0 object-contain",
                      insignia.shape === "vertical"
                        ? "h-5 w-auto"
                        : "h-3.5 w-auto",
                    )}
                  />
                ) : null}
                <span className="truncate font-medium text-xs text-primary">
                  {grado}
                </span>
              </div>
            ) : null}

            <p className="line-clamp-2 font-semibold text-sm leading-snug text-foreground">
              {name || "Responsable"}
            </p>

            {maskedCedula ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {maskedCedula}
              </p>
            ) : null}

            {compLogo || componente ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                {compLogo ? (
                  <img
                    src={compLogo.src}
                    alt={compLogo.name}
                    className="size-4 shrink-0 object-contain"
                  />
                ) : null}
                <span className="truncate text-xs text-muted-foreground">
                  {compLogo?.name ?? componente}
                </span>
              </div>
            ) : null}

            {unidad ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {unidad}
              </p>
            ) : null}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
