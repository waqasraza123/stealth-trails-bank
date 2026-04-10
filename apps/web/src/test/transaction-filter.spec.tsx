import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebI18nProvider } from "@/i18n/provider";
import { TransactionFilter } from "@/components/transactions/TransactionFilter";

describe("transaction filter", () => {
  afterEach(() => {
    cleanup();
  });

  it("propagates search, type, and status filters and can clear them", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <WebI18nProvider>
        <TransactionFilter onFilterChange={onFilterChange} />
      </WebI18nProvider>
    );

    await user.type(screen.getByPlaceholderText("Search transactions..."), "alpha");
    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "alpha",
          types: [],
          statuses: []
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /^Type$/i }));
    const depositItem = screen.getByRole("menuitemcheckbox", { name: "Deposit" });
    await user.click(depositItem);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "alpha",
          types: ["Deposit"]
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /^Status$/i }));
    const settledItem = screen.getByRole("menuitemcheckbox", { name: "settled" });
    await user.click(settledItem);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "alpha",
          types: ["Deposit"],
          statuses: ["settled"]
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith({
        search: "",
        types: [],
        statuses: [],
        dateRange: {
          from: undefined,
          to: undefined
        }
      });
    });
  }, 10000);
});
