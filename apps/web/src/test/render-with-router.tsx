import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { WebI18nProvider } from "@/i18n/provider";
import { routerFuture } from "@/lib/router-future";

type RenderWithRouterOptions = Omit<MemoryRouterProps, "children">;

const testRouterFuture = {
  ...routerFuture,
  v7_startTransition: false
} as const;

export function renderWithRouter(
  element: ReactElement,
  options?: RenderWithRouterOptions,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(element, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <WebI18nProvider>
          <MemoryRouter future={testRouterFuture} {...options}>
            {children}
          </MemoryRouter>
        </WebI18nProvider>
      </QueryClientProvider>
    )
  });
}
