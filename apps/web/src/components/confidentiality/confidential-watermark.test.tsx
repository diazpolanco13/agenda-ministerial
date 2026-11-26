import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ConfidentialWatermark, maskCedula } from "./confidential-watermark";

describe("maskCedula", () => {
  it("retorna 'Sin cédula' cuando no se proporciona cédula", () => {
    expect(maskCedula()).toBe("Sin cédula");
    expect(maskCedula(null)).toBe("Sin cédula");
    expect(maskCedula("")).toBe("Sin cédula");
    expect(maskCedula("   ")).toBe("Sin cédula");
  });

  it("enmascara la cédula conservando prefijo y últimos 4 dígitos", () => {
    expect(maskCedula("V-12345678")).toBe("V-••••5678");
    expect(maskCedula("E-9876543")).toBe("E-••••6543");
    expect(maskCedula("12345678")).toBe("••••5678");
    expect(maskCedula("V-12.345.678")).toBe("V-••••5678");
  });
});

describe("ConfidentialWatermark", () => {
  afterEach(() => {
    cleanup();
  });

  it("no renderiza nada cuando visible es false", () => {
    render(
      <ConfidentialWatermark
        visible={false}
        userName="Cnel. Pérez"
        cedula="V-12345678"
        dateLabel="26/11/2026"
      />,
    );

    expect(
      screen.queryByTestId("confidential-watermark"),
    ).not.toBeInTheDocument();
  });

  it("renderiza la marca de agua con nombre y cédula enmascarada cuando visible es true", () => {
    render(
      <ConfidentialWatermark
        visible={true}
        userName="Cnel. Pérez"
        cedula="V-12345678"
        dateLabel="26/11/2026"
      />,
    );

    const watermark = screen.getByTestId("confidential-watermark");
    expect(watermark).toBeInTheDocument();
    expect(watermark).toHaveAttribute("aria-hidden", "true");
    expect(watermark.textContent).toContain(
      "CONFIDENCIAL · Cnel. Pérez · V-••••5678 · 26/11/2026",
    );
  });
});
