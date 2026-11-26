import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { InputProps } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthCaptcha } from "./auth-captcha";
import {
  authFieldClassName,
  authLabelClassName,
  authMessageClassName,
} from "./auth-form-styles";
import { PasswordInput } from "./password-input";
import type { AuthCaptcha as AuthCaptchaState } from "./use-auth-captcha";

// TODO fase 5: soportar inicio de sesión por cédula de identidad además de correo electrónico

type PasswordSignInValues = { email: string; password: string };

type PasswordSignInFormProps = {
  defaultEmail?: string;
  canResetPassword?: boolean;
  captcha: AuthCaptchaState;
  disabled?: boolean;
  onSuccess: () => void;
};

// Reenvía id y atributos ARIA de FormControl directo al <input> real dentro de InputGroup.
function EmailGroupInput(props: Omit<InputProps, "type">) {
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <User className="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput size="lg" type="email" {...props} />
    </InputGroup>
  );
}

export function PasswordSignInForm({
  defaultEmail,
  canResetPassword = false,
  captcha,
  disabled = false,
  onSuccess,
}: PasswordSignInFormProps) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t("auth:forms.invalidEmail")),
        password: z.string().min(1, t("auth:forms.passwordRequired")),
      }),
    [t],
  );
  const form = useForm<PasswordSignInValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { email: defaultEmail ?? "", password: "" },
  });

  const onSubmit = async ({ email, password }: PasswordSignInValues) => {
    if (captcha.pending) return;
    setIsPending(true);
    try {
      const result = await authClient.signIn.email(
        { email, password },
        { headers: captcha.headers },
      );
      if (result.error) {
        toast.error(
          result.error.code === "EMAIL_NOT_VERIFIED"
            ? t("auth:signInForm.emailNotVerified")
            : result.error.message || t("auth:signInForm.failedSignIn"),
        );
        setIsPending(false);
        captcha.reset();
        return;
      }
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:signInForm.failedSignIn"),
      );
      setIsPending(false);
      captcha.reset();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.email")}
              </FormLabel>
              <FormControl>
                <EmailGroupInput
                  autoComplete="username"
                  className="font-mono"
                  placeholder={t("auth:forms.emailPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <div className="flex items-center justify-between gap-2">
                <FormLabel className={authLabelClassName}>
                  {t("auth:forms.password")}
                </FormLabel>
                {canResetPassword ? (
                  <Link
                    to="/auth/forgot-password"
                    className="text-[13px] text-muted-foreground leading-4 underline decoration-muted-foreground/50 underline-offset-[3px] transition-colors hover:text-foreground"
                  >
                    {t("auth:passwordReset.forgotPassword")}
                  </Link>
                ) : null}
              </div>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder={t("auth:forms.passwordPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <AuthCaptcha captcha={captcha} />
        <Button
          type="submit"
          size="lg"
          className="mt-2 h-11 w-full"
          loading={isPending}
          disabled={disabled || captcha.pending}
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t("auth:signIn.submitPassword")}
        </Button>
      </form>
    </Form>
  );
}
