import {
  INSTITUTIONAL_INSTANCE_ROLE_PERMISSIONS,
  INSTITUTIONAL_ROLES,
  type InstitutionalRole,
} from "@kaneo/permissions";
import { InfoIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buscarPersonalSigefanb,
  type SigefanbPersonalItem,
} from "@/fetchers/sigefanb";
import useCreateAdminUser from "@/hooks/mutations/admin/use-create-admin-user";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useAdminRoles from "@/hooks/queries/admin/use-admin-roles";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { cn } from "@/lib/cn";
import {
  componentLogo,
  normalizeCedulaInput,
  rankInsignia,
} from "@/lib/military-assets";
import {
  buildCreateUserRequest,
  EMPTY_CREATE_USER_VALUES,
} from "./create-user-values";
import { getAccountSetupMode } from "./get-account-setup-mode";
import type { TemporaryPasswordPayload } from "./temporary-password-dialog";
import { useInstanceRoleLabel } from "./use-instance-role-label";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemporaryPassword?: (payload: TemporaryPasswordPayload) => void;
};

export function CreateUserDialog({
  open,
  onOpenChange,
  onTemporaryPassword,
}: CreateUserDialogProps) {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const mode = getAccountSetupMode(config);
  const { permissions } = useAdminAccess();
  const { data: roles = [] } = useAdminRoles();
  const roleLabel = useInstanceRoleLabel();

  const [values, setValues] = useState(EMPTY_CREATE_USER_VALUES);
  const { mutateAsync: createUser, isPending } = useCreateAdminUser();
  const [nameError, setNameError] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);

  // Estado del buscador SIGEFANB
  const [sigefanbQuery, setSigefanbQuery] = useState("");
  const [sigefanbResults, setSigefanbResults] = useState<
    SigefanbPersonalItem[]
  >([]);
  const [isSearchingSigefanb, setIsSearchingSigefanb] = useState(false);
  const [sigefanbError, setSigefanbError] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] =
    useState<SigefanbPersonalItem | null>(null);

  useEffect(() => {
    const trimmed = sigefanbQuery.trim();
    if (!open || trimmed.length < 3) {
      setSigefanbResults([]);
      setSigefanbError(null);
      setIsSearchingSigefanb(false);
      return;
    }

    let cancelled = false;
    setIsSearchingSigefanb(true);
    setSigefanbError(null);

    const timer = window.setTimeout(async () => {
      try {
        const items = await buscarPersonalSigefanb(trimmed);
        if (!cancelled) {
          setSigefanbResults(items);
        }
      } catch (error) {
        if (!cancelled) {
          setSigefanbResults([]);
          setSigefanbError(
            error instanceof Error && error.message
              ? error.message
              : "No se pudo consultar SIGEFANB",
          );
        }
      } finally {
        if (!cancelled) {
          setIsSearchingSigefanb(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sigefanbQuery, open]);

  const roleOptions = useMemo(() => {
    const isAdmin = permissions.includes("roles:manage");
    const institutional = INSTITUTIONAL_ROLES.filter((roleName) => {
      if (roleName === values.role) return true;
      if (roleName === "admin") return isAdmin;
      if (isAdmin) return true;
      const reqPerms = INSTITUTIONAL_INSTANCE_ROLE_PERMISSIONS[roleName];
      return reqPerms.every((permission) => permissions.includes(permission));
    });
    const extras = roles
      .filter(
        (role) =>
          !institutional.includes(role.name as InstitutionalRole) &&
          (role.name === values.role ||
            isAdmin ||
            role.permissions.every((permission) =>
              permissions.includes(permission),
            )),
      )
      .map((role) => role.name);

    return Array.from(
      new Set([
        ...(values.role === "user" ? ["user"] : []),
        ...institutional,
        ...extras,
        ...(values.role !== "user" ? ["user"] : []),
      ]),
    );
  }, [permissions, roles, values.role]);

  const close = () => {
    onOpenChange(false);
    setValues(EMPTY_CREATE_USER_VALUES);
    setNameError(false);
    setIdentifierError(null);
    setSigefanbQuery("");
    setSigefanbResults([]);
    setSigefanbError(null);
    setSelectedPersona(null);
  };

  const handleSelectPersona = (persona: SigefanbPersonalItem) => {
    setSelectedPersona(persona);
    setSigefanbQuery("");
    setSigefanbResults([]);
    setSigefanbError(null);
    setNameError(false);
    setIdentifierError(null);
    setValues((current) => ({
      ...current,
      name: persona.nombreCompleto,
      cedula: persona.cedula,
      nacionalidad: persona.nacionalidad,
      grado: persona.grado,
      componente: persona.componente ?? "",
      unidad: persona.unidad ?? "",
      role: current.role === "user" ? "responsable" : current.role,
    }));
  };

  const handleClearPersona = () => {
    setSelectedPersona(null);
    setValues((current) => ({
      ...current,
      cedula: "",
      nacionalidad: "V",
      grado: "",
      componente: "",
      unidad: "",
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = buildCreateUserRequest(values);
    if (!request) {
      setNameError(!values.name.trim());
      const rawCedula = values.cedula?.trim() ?? "";
      if (rawCedula && !normalizeCedulaInput(rawCedula)) {
        setIdentifierError("La cédula ingresada no es válida.");
      } else if (!values.email.trim() && !rawCedula) {
        setIdentifierError("Indica un correo electrónico o una cédula.");
      }
      return;
    }
    try {
      const created = await createUser(request);
      const tempPassword = created.temporaryPassword;
      const createdName = created.user.name;
      const createdIdentifier = created.user.cedula
        ? `${created.user.nacionalidad === "E" ? "E" : "V"}-${created.user.cedula}`
        : created.user.email;
      close();
      if (tempPassword) {
        onTemporaryPassword?.({
          userName: createdName,
          identifier: createdIdentifier,
          temporaryPassword: tempPassword,
        });
      }
    } catch {
      return;
    }
  };

  const previewInsignia = selectedPersona
    ? rankInsignia(
        selectedPersona.grado,
        selectedPersona.componente,
        selectedPersona.unidad,
      )
    : null;
  const previewCompLogo = selectedPersona?.componente
    ? componentLogo(selectedPersona.componente)
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (!isPending) close();
      }}
    >
      <DialogPopup className="sm:max-w-lg">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("settings:adminUsers.create.title")}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              {/* Buscador SIGEFANB */}
              <div className="space-y-2 rounded-lg border bg-muted/25 p-3">
                <label
                  htmlFor="admin-sigefanb-search"
                  className="block text-xs font-medium text-foreground"
                >
                  Buscar en SIGEFANB (cédula o nombre)
                </label>
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="admin-sigefanb-search"
                    type="search"
                    value={sigefanbQuery}
                    onChange={(event) => setSigefanbQuery(event.target.value)}
                    placeholder="Ej. 12345678 o Apellido Nombre"
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
                {isSearchingSigefanb ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2Icon
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Consultando SIGEFANB…
                  </p>
                ) : null}
                {sigefanbError ? (
                  <p className="text-xs text-destructive">{sigefanbError}</p>
                ) : null}
                {sigefanbResults.length > 0 ? (
                  <div className="max-h-44 divide-y divide-border overflow-y-auto rounded-md border bg-background">
                    {sigefanbResults.map((persona) => {
                      const itemInsignia = rankInsignia(
                        persona.grado,
                        persona.componente,
                        persona.unidad,
                      );
                      return (
                        <button
                          key={persona.cedula}
                          type="button"
                          onClick={() => handleSelectPersona(persona)}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                        >
                          <ResponsableAvatar
                            name={persona.nombreCompleto}
                            cedula={persona.cedula}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {itemInsignia ? (
                                <img
                                  src={itemInsignia.src}
                                  alt={itemInsignia.name}
                                  className={cn(
                                    "shrink-0 object-contain",
                                    itemInsignia.shape === "vertical"
                                      ? "h-4 w-auto"
                                      : "h-2.5 w-auto",
                                  )}
                                />
                              ) : null}
                              <span className="truncate text-xs font-medium text-foreground">
                                {persona.nombreCompleto}
                              </span>
                            </div>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {persona.nacionalidad}-{persona.cedula}
                              {persona.grado ? ` · ${persona.grado}` : ""}
                              {persona.componente
                                ? ` · ${persona.componente}`
                                : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selectedPersona ? (
                  <div className="flex items-start gap-3 rounded-md border bg-background p-2.5">
                    <ResponsableAvatar
                      name={selectedPersona.nombreCompleto}
                      cedula={selectedPersona.cedula}
                      nacionalidad={selectedPersona.nacionalidad}
                      grado={selectedPersona.grado}
                      componente={selectedPersona.componente}
                      unidad={selectedPersona.unidad}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {previewInsignia ? (
                          <img
                            src={previewInsignia.src}
                            alt={previewInsignia.name}
                            className={cn(
                              "shrink-0 object-contain",
                              previewInsignia.shape === "vertical"
                                ? "h-4.5 w-auto"
                                : "h-3 w-auto",
                            )}
                          />
                        ) : null}
                        <span className="truncate text-xs font-semibold text-foreground">
                          {selectedPersona.nombreCompleto}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {selectedPersona.nacionalidad}-{selectedPersona.cedula}
                        {selectedPersona.grado
                          ? ` · ${selectedPersona.grado}`
                          : ""}
                      </p>
                      {previewCompLogo || selectedPersona.unidad ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {previewCompLogo ? (
                            <img
                              src={previewCompLogo.src}
                              alt={previewCompLogo.name}
                              className="size-3.5 shrink-0 object-contain"
                            />
                          ) : null}
                          <span className="truncate">
                            {selectedPersona.unidad ?? previewCompLogo?.name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Quitar vínculo SIGEFANB"
                      onClick={handleClearPersona}
                    >
                      <XIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <Field invalid={nameError}>
                <FieldLabel htmlFor="admin-create-user-name">
                  {t("settings:adminUsers.edit.name")}
                </FieldLabel>
                <Input
                  id="admin-create-user-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  required
                  maxLength={200}
                  value={values.name}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                    setNameError(false);
                  }}
                />
                {nameError ? (
                  <FieldError match>
                    {t("settings:adminUsers.create.nameRequired")}
                  </FieldError>
                ) : null}
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field invalid={Boolean(identifierError)}>
                  <FieldLabel htmlFor="admin-create-user-cedula">
                    Cédula de identidad
                  </FieldLabel>
                  <Input
                    id="admin-create-user-cedula"
                    name="cedula"
                    type="text"
                    autoComplete="off"
                    maxLength={20}
                    placeholder="V-12345678 (opcional)"
                    className="font-mono"
                    value={values.cedula ?? ""}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        cedula: event.target.value,
                      }));
                      setIdentifierError(null);
                    }}
                  />
                </Field>

                <Field invalid={Boolean(identifierError)}>
                  <FieldLabel htmlFor="admin-create-user-email">
                    {t("settings:adminUsers.edit.email")}
                  </FieldLabel>
                  <Input
                    id="admin-create-user-email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    required={!values.cedula?.trim()}
                    maxLength={254}
                    placeholder={
                      values.cedula?.trim()
                        ? "Opcional con cédula"
                        : "correo@ejemplo.com"
                    }
                    value={values.email}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        email: event.target.value,
                      }));
                      setIdentifierError(null);
                    }}
                  />
                </Field>
              </div>
              {identifierError ? (
                <p className="text-xs text-destructive">{identifierError}</p>
              ) : null}

              <Field>
                <FieldLabel htmlFor="admin-create-user-role">
                  {t("settings:adminUsers.edit.role")}
                </FieldLabel>
                <Select
                  items={Object.fromEntries(
                    roleOptions.map((name) => [name, roleLabel(name)]),
                  )}
                  value={values.role}
                  onValueChange={(next) => {
                    if (typeof next === "string") {
                      setValues((current) => ({ ...current, role: next }));
                    }
                  }}
                >
                  <SelectTrigger id="admin-create-user-role">
                    <SelectValue>{roleLabel(values.role)}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {roleOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {roleLabel(name)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Field>

              <label
                htmlFor="admin-create-user-temp-password"
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
              >
                <Checkbox
                  id="admin-create-user-temp-password"
                  checked={Boolean(values.generarContrasenaTemporal)}
                  onCheckedChange={(checked) =>
                    setValues((current) => ({
                      ...current,
                      generarContrasenaTemporal: Boolean(checked),
                    }))
                  }
                />
                <span className="text-xs font-medium text-foreground">
                  Generar contraseña temporal ahora
                </span>
              </label>

              {mode === "noEmail" && !values.generarContrasenaTemporal ? (
                <Alert variant="warning">
                  <InfoIcon />
                  <AlertDescription>
                    {t("settings:adminUsers.create.hintNoEmail")}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("settings:adminUsers.create.creating")
                : t("settings:adminUsers.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
