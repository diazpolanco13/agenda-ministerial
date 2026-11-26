import type { User as BetterAuthUser } from "better-auth/types";

export type MilitarProfile = {
  cedula: string;
  nacionalidad: string | null;
  grado: string | null;
  componente: string | null;
  unidad: string | null;
  sexo: string | null;
  insignia: string | null;
  fotoUrl: string;
  pendiente: boolean;
  sincronizadoEn: string | null;
};

export type CurrentUserProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  managedProfileFields: string[];
  militar: MilitarProfile | null;
};

export type User = BetterAuthUser & {
  locale?: string | null;
  role?: string | null;
  militar?: MilitarProfile | null;
};
