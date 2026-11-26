import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
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
  assigned?: boolean;
  size?: ResponsableAvatarSize;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
};

/**
 * Avatar institucional reutilizable para responsables en Gantt, Tablero, Lista,
 * Carga de trabajo y Personas. Delega en `useResponsableFoto` para que la
 * Fase 4 enchufe fotos SIGEFANB en un solo punto.
 */
export function ResponsableAvatar({
  userId,
  name,
  image,
  assigned = true,
  size = "sm",
  className,
  fallbackClassName,
  alt,
}: ResponsableAvatarProps) {
  const { src, initials, swatch } = useResponsableFoto({
    userId,
    image,
    name,
  });

  if (!assigned) {
    return <UnassignedAvatar className={cn(SIZE_CLASSES[size], className)} />;
  }

  return (
    <Avatar
      className={cn(
        SIZE_CLASSES[size],
        "shrink-0 ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt={alt ?? name ?? ""} /> : null}
      <AvatarFallback
        style={
          fallbackClassName
            ? undefined
            : {
                backgroundColor: swatch.fill,
                color: swatch.onFill,
              }
        }
        className={cn(
          "font-semibold tracking-tight",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
