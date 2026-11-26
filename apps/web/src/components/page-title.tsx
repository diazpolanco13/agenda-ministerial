import { useInstanceNameStore } from "@/store/instance-name";

function formatPageTitle(title: string, instanceName: string) {
  if (instanceName === "Kaneo") return title;
  if (instanceName === "MPPD") return `${title} · AGENDA · MPPD`;
  return `${title} | ${instanceName}`;
}

export default function PageTitle({ title }: { title?: string }) {
  const instanceName = useInstanceNameStore((state) => state.instanceName);
  if (!title) return null;

  return <title>{formatPageTitle(title, instanceName)}</title>;
}
