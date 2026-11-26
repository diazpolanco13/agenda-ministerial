import {
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

export type TemporaryPasswordPayload = {
  userName: string;
  identifier?: string;
  temporaryPassword: string;
};

type TemporaryPasswordDialogProps = {
  payload: TemporaryPasswordPayload | null;
  onClose: () => void;
};

/**
 * Muestra la contraseña temporal recién generada una única vez con botón de copiado.
 */
export function TemporaryPasswordDialog({
  payload,
  onClose,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      open={payload !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" aria-hidden="true" />
            Contraseña temporal generada
          </DialogTitle>
          <DialogDescription>
            {payload ? (
              <>
                Credencial temporal para{" "}
                <span className="font-medium text-foreground">
                  {payload.userName}
                </span>
                {payload.identifier ? (
                  <span className="font-mono text-xs">
                    {" "}
                    ({payload.identifier})
                  </span>
                ) : null}
                .
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-4">
            <Alert variant="warning">
              <ShieldAlertIcon />
              <AlertDescription>
                Esta contraseña se muestra una sola vez y no podrá consultarse
                nuevamente. Cópiala y entrégala al usuario por un canal seguro.
              </AlertDescription>
            </Alert>
            {payload ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                <code
                  data-testid="temporary-password-value"
                  className="select-all font-mono text-sm font-semibold tracking-wider text-foreground"
                >
                  {payload.temporaryPassword}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3.5" aria-hidden="true" />
                      Copiada
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" aria-hidden="true" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Cerrar</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
