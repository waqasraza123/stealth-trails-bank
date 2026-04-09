import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adminLocaleStorageKey } from "../i18n/provider";
import App from "../App";

vi.mock("@stealth-trails-bank/config/web", () => ({
  loadWebRuntimeConfig: () => ({
    serverUrl: "http://localhost:9001"
  })
}));

describe("Admin console", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  });

  it("renders the operator console shell and credential form", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Operator Console" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ledger reconciliation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Platform audit log" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Treasury visibility" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Route critical alerts" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Operator ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Operator API Key")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Session" })
    ).toBeInTheDocument();
  });

  it("persists the saved operator session and restores it on the next render", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.clear(screen.getByLabelText("Operator ID"));
    await user.type(screen.getByLabelText("Operator ID"), "ops_saved");
    await user.selectOptions(screen.getByLabelText("Operator Role"), "risk_manager");
    await user.type(screen.getByLabelText("Operator API Key"), "local-dev-operator-key");
    await user.click(screen.getByRole("button", { name: "Save Session" }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem("stealth-trails-bank.admin.operator-session")
      ).toContain("\"operatorId\":\"ops_saved\"");
    });

    cleanup();
    render(<App />);

    expect(screen.getByLabelText("Operator ID")).toHaveValue("ops_saved");
    expect(screen.getByLabelText("Operator Role")).toHaveValue("risk_manager");
  });

  it("switches the shell into Arabic and persists document rtl state", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "العربية" }));

    expect(
      await screen.findByRole("heading", { name: "وحدة تحكم المشغل" })
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(window.localStorage.getItem(adminLocaleStorageKey)).toBe("ar");
  });
});
