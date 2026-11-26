import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
import { ResponsableHoverCard } from "@/components/responsable-hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useResponsableFoto } from "@/hooks/use-responsable-foto";
import { cn } from "@/lib/cn";

export type ResponsableAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ResponsableAvatarSize, string> = {
  xs: "size-4.5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-14 text-base",
};

type ResponsableAvatarProps = {
  userId?: string | null;
  name?: string | null;
  image?: string | null;
  cedula?: string | null;
  nacionalidad?: string | null;
  grado?: string | null;
  componente?: string | null;
  unidad?: string | null;
  showHoverCard?: boolean;
  assigned?: boolean;
  size?: ResponsableAvatarSize;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
};

/**
 * Avatar institucional reutilizable para responsables en Gantt, Tablero, Lista,
 * Carga de trabajo y Personas. Delega en `useResponsableFoto` para resolver
 * fotos SIGEFANB con fallback a `image` local o iniciales.
 */
export function ResponsableAvatar({
  userId,
  name,
  image,
  cedula,
  nacionalidad,
  grado,
  componente,
  unidad,
  showHoverCard = false,
  assigned = true,
  size = "sm",
  className,
  fallbackClassName,
  alt,
}: ResponsableAvatarProps) {
  const { src, initials, swatch, markFailed } = useResponsableFoto({
    userId,
    cedula,
    image,
    name,
  });

  if (!assigned) {
    return <UnassignedAvatar className={cn(SIZE_CLASSES[size], className)} />;
  }

  const avatar = (
    <Avatar
      className={cn(
        SIZE_CLASSES[size],
        "shrink-0 ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
    >
      {src ? (
        <AvatarImage
          key={src}
          src={src}
          alt={alt ?? name ?? ""}
          onError={() => markFailed(src)}
        />
      ) : null}
      <AvatarFallback
        style={
          fallbackClassName
            ? undefined
            : {
                backgroundColor: swatch.fill,
                color: swatch.onFill,
              }
        }
        className={cn("font-semibold tracking-tight", fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  const hasHoverDetails = Boolean(
    name || grado || componente || unidad || cedula,
  );
  if (showHoverCard && hasHoverDetails) {
    return (
      <ResponsableHoverCard
        userId={userId}
        name={name}
        image={image}
        cedula={cedula}
        nacionalidad={nacionalidad}
        grado={grado}
        componente={componente}
        unidad={unidad}
      >
        {avatar}
      </ResponsableHoverCard>
    );
  }

  return avatar;
}
