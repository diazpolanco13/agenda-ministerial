import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type AuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-background text-foreground flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm space-y-5 my-auto">
        <div className="flex items-center justify-center gap-2.5">
          <img
            src="/marca/sigefanb.webp"
            alt="SIGEFANB"
            className="h-7 w-auto object-contain dark:hidden"
          />
          <img
            src="/marca/sigefanb-oscuro.png"
            alt="SIGEFANB"
            className="hidden h-7 w-auto object-contain dark:block"
          />
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-primary">
            AGENDA
          </span>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </CardHeader>
          <CardContent className="pt-0">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
