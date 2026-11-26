import { SigefanbUnavailableError } from "../sigefanb/pools";
import {
  buscarPersonalInteligente,
  type SigefanbSmartCandidate,
} from "../sigefanb/smart-search";
import type {
  DiscursoCandidatoResponsable,
  DiscursoOrdenBorrador,
} from "./types";

const AUTO_ASSIGN_MIN_SCORE = 0.85;
const AUTO_ASSIGN_MIN_GAP = 0.08;
const MAX_SUGGESTED_CANDIDATES = 3;

function buildPersonQuery(orden: DiscursoOrdenBorrador): string {
  const parts = [orden.pistas.nombre, orden.pistas.apellido]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return orden.responsableMencionado
    .replace(/\((?:EJB|ARB|AMB|GNB|MIL)\)/gi, "")
    .trim();
}

function toDiscursoCandidate(
  candidate: SigefanbSmartCandidate,
): DiscursoCandidatoResponsable {
  return {
    cedula: candidate.cedula,
    nacionalidad: candidate.nacionalidad,
    nombreCompleto: candidate.nombreCompleto,
    grado: candidate.grado,
    componente: candidate.componente,
    unidad: candidate.unidad,
    sexo: candidate.sexo,
    insignia: candidate.insignia,
    fotoUrl: candidate.fotoUrl,
    score: candidate.score,
    motivo: candidate.motivo,
  };
}

/**
 * Resuelve candidatos SIGEFANB para cada orden extraída sin fallar si SIGEFANB no está disponible.
 */
export async function resolverResponsablesOrdenes(
  ordenes: DiscursoOrdenBorrador[],
): Promise<DiscursoOrdenBorrador[]> {
  return Promise.all(
    ordenes.map(async (orden) => {
      const q = buildPersonQuery(orden);
      if (q.length < 3) {
        return {
          ...orden,
          asignacionModo: "sin_responsable",
          responsableCedula: null,
          responsableUserId: null,
          candidatos: [],
        };
      }

      try {
        const rawCandidates = await buscarPersonalInteligente({
          q,
          grado: orden.pistas.grado ?? undefined,
          componente: orden.pistas.componente ?? undefined,
          limit: 5,
        });

        const candidatos = rawCandidates
          .slice(0, MAX_SUGGESTED_CANDIDATES)
          .map(toDiscursoCandidate);

        if (candidatos.length === 0) {
          return {
            ...orden,
            asignacionModo: "sin_responsable",
            responsableCedula: null,
            responsableUserId: null,
            candidatos: [],
          };
        }

        const top = candidatos[0];
        const second = candidatos[1];
        const isAuto =
          top &&
          top.score >= AUTO_ASSIGN_MIN_SCORE &&
          (candidatos.length === 1 ||
            (second !== undefined &&
              top.score - second.score >= AUTO_ASSIGN_MIN_GAP));

        if (isAuto && top) {
          return {
            ...orden,
            asignacionModo: "auto",
            responsableCedula: top.cedula,
            responsableUserId: null,
            candidatos,
          };
        }

        return {
          ...orden,
          asignacionModo: "sugerido",
          responsableCedula: null,
          responsableUserId: null,
          candidatos,
        };
      } catch (error) {
        if (error instanceof SigefanbUnavailableError) {
          return {
            ...orden,
            asignacionModo: "sin_responsable",
            responsableCedula: null,
            responsableUserId: null,
            candidatos: [],
          };
        }

        console.error(
          "Error resolviendo responsable SIGEFANB para orden:",
          error instanceof Error ? error.message : "Error desconocido",
        );

        return {
          ...orden,
          asignacionModo: "sin_responsable",
          responsableCedula: null,
          responsableUserId: null,
          candidatos: [],
        };
      }
    }),
  );
}
