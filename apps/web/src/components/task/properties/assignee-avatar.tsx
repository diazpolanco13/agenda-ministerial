import { ResponsableAvatar } from "@/components/responsable-avatar";
import { cn } from "@/lib/cn";

type AssigneeAvatarProps = {
  userId?: string | null;
  name: string | null | undefined;
  image: string | null | undefined;
  cedula?: string | null;
  grado?: string | null;
  componente?: string | null;
  unidad?: string | null;
  showHoverCard?: boolean;
  assigned: boolean;
  className?: string;
  fallbackClassName?: string;
};

export function AssigneeAvatar({
  userId,
  name,
  image,
  cedula,
  grado,
  componente,
  unidad,
  showHoverCard = false,
  assigned,
  className,
  fallbackClassName,
}: AssigneeAvatarProps) {
  return (
    <ResponsableAvatar
      userId={userId}
      name={name}
      image={image}
      cedula={cedula}
      grado={grado}
      componente={componente}
      unidad={unidad}
      showHoverCard={showHoverCard}
      assigned={assigned}
      size="xs"
      className={cn("size-4.5", className)}
      fallbackClassName={fallbackClassName}
    />
  );
}
