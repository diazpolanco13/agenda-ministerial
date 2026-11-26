import { Link } from "@tanstack/react-router";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      <span className="inline-flex items-center gap-2">
        <img
          src="/marca/sigefanb.webp"
          alt="SIGEFANB · AGENDA"
          className="h-7 w-auto object-contain dark:hidden"
        />
        <img
          src="/marca/sigefanb-oscuro.png"
          alt="SIGEFANB · AGENDA"
          className="hidden h-7 w-auto object-contain dark:block"
        />
        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
          AGENDA
        </span>
      </span>
    </Link>
  );
}
