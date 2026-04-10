import { expect, type Page, type Request, type Route } from "@playwright/test";

export type MockResponseSpec<T> = {
  data?: T;
  message?: string;
  statusCode?: number;
  error?: unknown;
  ok?: boolean;
};

export function isoAt(hoursAgo = 0): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

export function successEnvelope<T>(data: T, message = "ok") {
  return {
    status: "success" as const,
    message,
    data
  };
}

export function failedEnvelope(message: string, error?: unknown) {
  return {
    status: "failed" as const,
    message,
    ...(error === undefined ? {} : { error })
  };
}

export async function fulfillJson<T>(
  route: Route,
  spec: MockResponseSpec<T> = {}
): Promise<void> {
  const ok = spec.ok ?? true;

  await route.fulfill({
    status: spec.statusCode ?? 200,
    contentType: "application/json",
    body: JSON.stringify(
      ok
        ? successEnvelope(spec.data as T, spec.message)
        : failedEnvelope(spec.message ?? "Request failed.", spec.error)
    )
  });
}

export async function waitForJsonRequest(
  page: Page,
  pathSuffix: string,
  method = "POST"
): Promise<Record<string, unknown>> {
  const request = await page.waitForRequest(
    (candidate) =>
      candidate.method() === method &&
      new URL(candidate.url()).pathname.endsWith(pathSuffix)
  );

  return (request.postDataJSON() as Record<string, unknown> | null) ?? {};
}

export async function expectJsonRequest(
  requestPromise: Promise<Record<string, unknown>>,
  expected: Record<string, unknown>
): Promise<void> {
  const payload = await requestPromise;
  expect(payload).toMatchObject(expected);
}

export function readPathname(request: Request): string {
  return new URL(request.url()).pathname;
}
