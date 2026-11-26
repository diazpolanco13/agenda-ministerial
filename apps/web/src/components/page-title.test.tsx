import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useInstanceNameStore } from "@/store/instance-name";
import PageTitle from "./page-title";

describe("PageTitle", () => {
  beforeEach(() => {
    document.title = "AGENDA · MPPD";
  });

  afterEach(() => {
    cleanup();
    useInstanceNameStore.setState({ instanceName: "AGENDA · MPPD" });
  });

  it("uses the custom instance name and restores the fallback on unmount", () => {
    useInstanceNameStore.setState({ instanceName: "Acme" });
    const { unmount } = render(<PageTitle title="Settings" />);
    expect(document.title).toBe("Settings | Acme");
    unmount();
    expect(document.title).toBe("AGENDA · MPPD");
  });

  it("sets the document title using the default AGENDA · MPPD suffix", () => {
    render(<PageTitle title="MFP-1 Drag this card" />);
    expect(document.title).toBe("MFP-1 Drag this card | AGENDA · MPPD");
  });

  it("formats the title with AGENDA · MPPD when instanceName is MPPD", () => {
    useInstanceNameStore.setState({ instanceName: "MPPD" });
    render(<PageTitle title="Tablero" />);
    expect(document.title).toBe("Tablero · AGENDA · MPPD");
  });

  it("uses only the page title when instanceName is Kaneo", () => {
    useInstanceNameStore.setState({ instanceName: "Kaneo" });
    render(<PageTitle title="MFP-1 Drag this card" />);
    expect(document.title).toBe("MFP-1 Drag this card");
  });

  it("keeps the fallback title while the title is still loading", () => {
    const { rerender } = render(<PageTitle title={undefined} />);
    expect(document.title).toBe("AGENDA · MPPD");

    rerender(<PageTitle title="Website / Board" />);
    expect(document.title).toBe("Website / Board | AGENDA · MPPD");
  });

  it("restores the fallback title when the page unmounts", () => {
    const { unmount } = render(<PageTitle title="Inbox" />);
    unmount();
    expect(document.title).toBe("AGENDA · MPPD");
  });
});
