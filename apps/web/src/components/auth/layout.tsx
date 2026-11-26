import { BrandMark, TricolorBar } from "@/components/common/brand-mark";
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
    <div className="min-h-dvh w-full overflow-y-auto bg-background text-foreground flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-5 my-auto">
        <div className="flex flex-col items-center gap-2.5">
          <BrandMark size="md" />
          <TricolorBar className="w-12" />
        </div>

        <Card className="border-border/60 shadow-none">
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
