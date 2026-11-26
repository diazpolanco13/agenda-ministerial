export type DiscursoFuenteTipo = "texto" | "archivo" | "plaud" | "ejemplo";

export type DiscursoEstadoBorrador = "borrador" | "aprobado";

export type DiscursoMotorUsado = "ollama" | "reglas";

export type DiscursoPistasResponsable = {
  grado: string | null;
  componente: string | null;
  apellido: string | null;
  nombre: string | null;
};

export type DiscursoCandidatoResponsable = {
  cedula: string;
  nacionalidad: "V" | "E";
  nombreCompleto: string;
  grado: string;
  componente: "EJB" | "ARB" | "AMB" | "GNB" | "MIL" | null;
  unidad: string | null;
  sexo: string | null;
  insignia: string | null;
  fotoUrl: string;
  score: number;
  motivo: string;
};

export type DiscursoAsignacionModo = "auto" | "sugerido" | "manual" | "sin_responsable";

export type DiscursoPrioridad = "no-priority" | "low" | "medium" | "high" | "urgent";

export type DiscursoOrdenBorrador = {
  id: string;
  seleccionada: boolean;
  titulo: string;
  descripcion: string;
  proyectoId: string | null;
  responsableMencionado: string;
  pistas: DiscursoPistasResponsable;
  asignacionModo: DiscursoAsignacionModo;
  responsableCedula: string | null;
  responsableUserId: string | null;
  candidatos: DiscursoCandidatoResponsable[];
  plazo: string | null;
  plazoTexto: string | null;
  prioridad: DiscursoPrioridad;
  citaTextual: string;
  confianza: number;
  createdTaskId?: string | null;
};
