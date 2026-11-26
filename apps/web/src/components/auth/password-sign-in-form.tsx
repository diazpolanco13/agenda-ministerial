import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
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
import { getApiUrl } from "@/fetchers/get-api-url";
import { authClient } from "@/lib/auth-client";
import { normalizeCedulaInput } from "@/lib/military-assets";
import { toast } from "@/lib/toast";
import { AuthCaptcha } from "./auth-captcha";
import {
  authFieldClassName,
  authLabelClassName,
  authMessageClassName,
} from "./auth-form-styles";
import { PasswordInput } from "./password-input";
import type { AuthCaptcha as AuthCaptchaState } from "./use-auth-captcha";

type PasswordSignInValues = { identificador: string; password: string };

type PasswordSignInFormProps = {
  defaultEmail?: string;
  canResetPassword?: boolean;
  captcha: AuthCaptchaState;
  disabled?: boolean;
  onSuccess: () => void;
};

// Reenvía id y atributos ARIA de FormControl directo al <input> real dentro de InputGroup.
function IdentifierGroupInput(props: Omit<InputProps, "type">) {
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <User className="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput size="lg" type="text" {...props} />
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
  const { refetchUser } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        identificador: z
          .string()
          .trim()
          .min(
            1,
            t("auth:forms.identifierRequired", {
              defaultValue: "Ingresa tu cédula o correo electrónico",
            }),
          )
          .refine(
            (value) => {
              if (value.includes("@")) {
                return z.email().safeParse(value).success;
              }
              return normalizeCedulaInput(value) !== null;
            },
            t("auth:forms.invalidIdentifier", {
              defaultValue:
                "Ingresa una cédula válida (ej. V-12345678) o un correo electrónico",
            }),
          ),
        password: z.string().min(1, t("auth:forms.passwordRequired")),
      }),
    [t],
  );
  const form = useForm<PasswordSignInValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { identificador: defaultEmail ?? "", password: "" },
  });

  const onSubmit = async ({
    identificador,
    password,
  }: PasswordSignInValues) => {
    if (captcha.pending) return;
    setIsPending(true);
    try {
      const response = await fetch(getApiUrl("/auth/ingresar"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...captcha.headers,
        },
        body: JSON.stringify({
          identificador: identificador.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          code?: string;
          message?: string;
        } | null;
        toast.error(
          errorBody?.code === "EMAIL_NOT_VERIFIED"
            ? t("auth:signInForm.emailNotVerified")
            : errorBody?.message || t("auth:signInForm.failedSignIn"),
        );
        setIsPending(false);
        captcha.reset();
        return;
      }

      if (typeof authClient.getSession === "function") {
        await authClient.getSession({ query: { disableCookieCache: true } });
      }
      await refetchUser();
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
          name="identificador"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.identifier", {
                  defaultValue: "Cédula o correo electrónico",
                })}
              </FormLabel>
              <FormControl>
                <IdentifierGroupInput
                  autoComplete="username"
                  className="font-mono"
                  placeholder={t("auth:forms.identifierPlaceholder", {
                    defaultValue: "V-12345678 o correo@ejemplo.com",
                  })}
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
