export type DiscursoEjemplo = {
  titulo: string;
  fechaDiscurso: string;
  texto: string;
};

/**
 * Discurso ficticio realista del Despacho Ministerial para pruebas de extracción (sin cédulas).
 */
export function obtenerDiscursoEjemplo(
  fechaBase: Date = new Date(),
): DiscursoEjemplo {
  const fechaDiscurso = fechaBase.toISOString().slice(0, 10);

  return {
    titulo: "Reunión de Estado Mayor Superior — Lineamientos de Despacho",
    fechaDiscurso,
    texto: [
      "Buenos días a todo el Estado Mayor Superior y comandantes de componentes.",
      "Primero, instruyo al General de Brigada Rodríguez del Ejército Bolivariano que verifique e informe de inmediato el estado del parque automotor y la disponibilidad logística en las unidades de frontera.",
      "Segundo, quiero que el Contralmirante González de la Armada Bolivariana presente el plan de mantenimiento preventivo de las unidades flotantes para el viernes.",
      "Tercero, dispongo que el Coronel Hernández de la Aviación Militar Bolivariana coordine la revisión de la flota de transporte táctico y entregue el reporte técnico completo en 15 días.",
      "Cuarto, el General de División Martínez de la Guardia Nacional Bolivariana deberá garantizar el despliegue del dispositivo de seguridad vial y control territorial antes de fin de mes.",
      "Quinto, ordeno al Teniente Coronel Castillo de la Milicia Bolivariana que elabore y remita la actualización del registro de cuadros de reserva para el próximo martes.",
    ].join("\n\n"),
  };
}
