import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
import { ResponsableAvatar } from "@/components/responsable-avatar";

type AssignableMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  cedula?: string | null;
  grado?: string | null;
  componente?: string | null;
  unidad?: string | null;
};

export function assigneeMenuOptions(
  members: AssignableMember[],
  current: string | null | undefined,
  unassignedLabel: string,
): OptionMenuItem[] {
  return [
    {
      value: "",
      label: unassignedLabel,
      icon: <UnassignedAvatar className="size-4 text-[8px]" />,
      selected: current !== undefined && !current,
    },
    ...members.map((member) => ({
      value: member.id,
      label: member.name || member.email || "",
      hint: member.grado || undefined,
      icon: (
        <ResponsableAvatar
          size="xs"
          userId={member.id}
          name={member.name}
          image={member.image}
          cedula={member.cedula}
          grado={member.grado}
          componente={member.componente}
          unidad={member.unidad}
          className="size-4 text-[8px]"
        />
      ),
      selected: member.id === current,
    })),
  ];
}
