import { describe, expect, it } from "vite-plus/test";
import { createPlaudAdapter, validatePlaudId } from "./adapter";

describe("plaud adapter", () => {
  it("reporta desconectado con instrucciones cuando faltan tokens o CLI", async () => {
    const adapter = createPlaudAdapter({
      tokensPath: "/tmp/no-existe-plaud-tokens.json",
      fileExists: async () => false,
      runner: async () => {
        throw new Error("ENOENT");
      },
    });

    const estado = await adapter.obtenerEstado();
    expect(estado.conectado).toBe(false);
    expect(estado.tieneTokens).toBe(false);
    expect(estado.cliInstalada).toBe(false);
    expect(estado.instrucciones).toEqual([
      "npm i -g @plaud-ai/cli",
      "plaud login",
    ]);
  });

  it("reporta conectado cuando existen tokens y CLI responde", async () => {
    const adapter = createPlaudAdapter({
      tokensPath: "/home/user/.plaud/tokens.json",
      fileExists: async () => true,
      runner: async (_file, args) => {
        if (args[0] === "--version") {
          return { stdout: "1.2.0\n", stderr: "" };
        }
        return {
          stdout: JSON.stringify([
            {
              id: "rec_2026_11_12",
              title: "Reunión Estado Mayor",
              date: "2026-11-12T09:00:00-04:00",
              duration: 1840,
              has_summary: true,
            },
          ]),
          stderr: "",
        };
      },
    });

    const estado = await adapter.obtenerEstado();
    expect(estado.conectado).toBe(true);

    const grabaciones = await adapter.listarGrabaciones(14);
    expect(grabaciones).toEqual([
      {
        id: "rec_2026_11_12",
        titulo: "Reunión Estado Mayor",
        fecha: "2026-11-12T09:00:00-04:00",
        duracionSegundos: 1840,
        resumenDisponible: true,
      },
    ]);
  });

  it("usa fallback sin --json si la versión de CLI no soporta el flag", async () => {
    const calls: string[][] = [];
    const adapter = createPlaudAdapter({
      fileExists: async () => true,
      runner: async (_file, args) => {
        calls.push(args);
        if (args[0] === "--version") return { stdout: "1.0.0", stderr: "" };
        if (args.includes("--json")) throw new Error("unknown option --json");
        return {
          stdout: "rec-001 | Consejo Superior | 2026-11-10\n",
          stderr: "",
        };
      },
    });

    const grabaciones = await adapter.listarGrabaciones(7);
    expect(calls).toContainEqual(["recent", "--days", "7", "--json"]);
    expect(calls).toContainEqual(["recent", "--days", "7"]);
    expect(grabaciones).toHaveLength(1);
    expect(grabaciones[0]?.id).toBe("rec-001");
    expect(grabaciones[0]?.titulo).toBe("Consejo Superior");
  });

  it("valida estrictamente los IDs para evitar inyección de argumentos o rutas", async () => {
    expect(() => validatePlaudId("rec_abc-123")).not.toThrow();
    expect(() => validatePlaudId("../etc/passwd")).toThrow();
    expect(() => validatePlaudId("id;rm -rf /")).toThrow();
    expect(() => validatePlaudId("a")).toThrow();

    const adapter = createPlaudAdapter({
      fileExists: async () => true,
      runner: async (_file, args) => {
        if (args[0] === "--version") return { stdout: "1.0.0", stderr: "" };
        if (args[0] === "transcript")
          return { stdout: "Texto completo", stderr: "" };
        return { stdout: "Resumen ejecutivo", stderr: "" };
      },
    });

    await expect(adapter.obtenerTranscripcion("bad id!")).rejects.toThrow();
    await expect(adapter.obtenerTranscripcion("rec_ok_1")).resolves.toEqual({
      id: "rec_ok_1",
      texto: "Texto completo",
    });
    await expect(adapter.obtenerResumen("rec_ok_1")).resolves.toEqual({
      id: "rec_ok_1",
      resumen: "Resumen ejecutivo",
    });
  });
});
