import { ResponsableAvatar } from "@/components/responsable-avatar";
import { cn } from "@/lib/cn";

type AssigneeAvatarProps = {
  userId?: string | null;
  name: string | null | undefined;
  image: string | null | undefined;
  assigned: boolean;
  className?: string;
  fallbackClassName?: string;
};

export function AssigneeAvatar({
  userId,
  name,
  image,
  assigned,
  className,
  fallbackClassName,
}: AssigneeAvatarProps) {
  return (
    <ResponsableAvatar
      userId={userId}
      name={name}
      image={image}
      assigned={assigned}
      size="xs"
      className={cn("size-4.5", className)}
      fallbackClassName={fallbackClassName}
    />
  );
}
