import { describe, expect, it } from "vite-plus/test";
import {
  canAccessConfidentialTask,
  hasConfidentialRole,
  normalizeConfidentialityLevel,
  projectConfidentialitySqlFilter,
  taskConfidentialitySqlFilter,
} from "./access";

describe("confidentiality/access", () => {
  it("reconoce roles con acceso confidencial (owner, admin, ministro, jefe_despacho)", () => {
    expect(hasConfidentialRole("owner")).toBe(true);
    expect(hasConfidentialRole("admin")).toBe(true);
    expect(hasConfidentialRole("ministro")).toBe(true);
    expect(hasConfidentialRole("jefe_despacho")).toBe(true);
    expect(hasConfidentialRole("secretaria,jefe_despacho")).toBe(true);

    expect(hasConfidentialRole("secretaria")).toBe(false);
    expect(hasConfidentialRole("responsable")).toBe(false);
    expect(hasConfidentialRole("consulta")).toBe(false);
    expect(hasConfidentialRole("member")).toBe(false);
    expect(hasConfidentialRole(null)).toBe(false);
    expect(hasConfidentialRole(undefined)).toBe(false);
  });

  it("normaliza niveles de confidencialidad con fallback a publica_interna", () => {
    expect(normalizeConfidentialityLevel("publica_interna")).toBe(
      "publica_interna",
    );
    expect(normalizeConfidentialityLevel("reservada")).toBe("reservada");
    expect(normalizeConfidentialityLevel("confidencial")).toBe("confidencial");
    expect(normalizeConfidentialityLevel("desconocido")).toBe(
      "publica_interna",
    );
    expect(normalizeConfidentialityLevel(null)).toBe("publica_interna");
  });

  it("permite acceso a tareas públicas y reservadas independientemente del rol", () => {
    for (const level of ["publica_interna", "reservada"] as const) {
      expect(
        canAccessConfidentialTask({
          userId: "user-consulta",
          taskConfidentiality: level,
          projectConfidentiality: "publica_interna",
          assigneeId: "user-otro",
          createdBy: "user-ministro",
          hasRoleAccess: false,
        }),
      ).toBe(true);
    }
  });

  it("permite acceso a tareas o proyectos confidenciales para ministro/jefe_despacho, asignado o creador", () => {
    // Rol privilegiado (ministro / jefe_despacho) aunque no sea asignado ni creador
    expect(
      canAccessConfidentialTask({
        userId: "user-ministro",
        taskConfidentiality: "confidencial",
        projectConfidentiality: "publica_interna",
        assigneeId: "user-otro",
        createdBy: "user-jefe",
        hasRoleAccess: true,
      }),
    ).toBe(true);

    // Usuario asignado en tarea confidencial
    expect(
      canAccessConfidentialTask({
        userId: "user-resp-1",
        taskConfidentiality: "confidencial",
        projectConfidentiality: "publica_interna",
        assigneeId: "user-resp-1",
        createdBy: "user-ministro",
        hasRoleAccess: false,
      }),
    ).toBe(true);

    // Creador en proyecto confidencial aunque esté asignada a otro
    expect(
      canAccessConfidentialTask({
        userId: "user-sec-creador",
        taskConfidentiality: "publica_interna",
        projectConfidentiality: "confidencial",
        assigneeId: "user-resp-1",
        createdBy: "user-sec-creador",
        hasRoleAccess: false,
      }),
    ).toBe(true);
  });

  it("deniega acceso a tareas o proyectos confidenciales a consulta, secretaría u otro responsable no involucrado", () => {
    // Consulta
    expect(
      canAccessConfidentialTask({
        userId: "user-consulta",
        taskConfidentiality: "confidencial",
        projectConfidentiality: "publica_interna",
        assigneeId: "user-resp-1",
        createdBy: "user-ministro",
        hasRoleAccess: false,
      }),
    ).toBe(false);

    // Secretaría (sin rol confidencial y no es creadora ni asignada)
    expect(
      canAccessConfidentialTask({
        userId: "user-secretaria",
        taskConfidentiality: "publica_interna",
        projectConfidentiality: "confidencial",
        assigneeId: "user-resp-1",
        createdBy: "user-ministro",
        hasRoleAccess: false,
      }),
    ).toBe(false);

    // Otro responsable distinto del asignado/creador
    expect(
      canAccessConfidentialTask({
        userId: "user-resp-2",
        taskConfidentiality: "confidencial",
        projectConfidentiality: "confidencial",
        assigneeId: "user-resp-1",
        createdBy: "user-jefe",
        hasRoleAccess: false,
      }),
    ).toBe(false);
  });

  it("genera filtros SQL solo cuando el usuario no tiene rol confidencial", () => {
    expect(taskConfidentialitySqlFilter("user-1", true)).toBeUndefined();
    expect(taskConfidentialitySqlFilter("user-1", false)).toBeDefined();
    expect(projectConfidentialitySqlFilter(true)).toBeUndefined();
    expect(projectConfidentialitySqlFilter(false)).toBeDefined();
  });
});
