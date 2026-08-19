export type HeaderValue = string | string[] | undefined;
export type HeaderRecord = Record<string, HeaderValue>;

export type InternalOperatorSession = {
  apiKey: string;
  operatorId: string;
  operatorRole?: string;
};

export type InternalWorkerSession = {
  apiKey: string;
  workerId: string;
};

export type InternalGovernedExecutorSession = {
  apiKey: string;
  executorId: string;
};

export type GovernedExecutionDispatchSession = {
  apiKey: string;
  workerId: string;
};

function normalizeHeaderValue(headerValue: HeaderValue): string | null {
  if (typeof headerValue === "string") {
    const normalizedHeaderValue = headerValue.trim();
    return normalizedHeaderValue ? normalizedHeaderValue : null;
  }

  if (Array.isArray(headerValue) && headerValue.length > 0) {
    const firstHeaderValue = headerValue[0]?.trim() ?? "";
    return firstHeaderValue ? firstHeaderValue : null;
  }

  return null;
}

function normalizeRole(role: string | undefined): string | null {
  const normalizedRole = role?.trim().toLowerCase() ?? "";
  return normalizedRole ? normalizedRole : null;
}

export function readHeaderValue(
  headers: HeaderRecord,
  headerName: string
): string | null {
  const normalizedHeaderName = headerName.toLowerCase();
  return normalizeHeaderValue(
    headers[normalizedHeaderName] ?? headers[headerName]
  );
}

export function buildInternalOperatorHeaders(
  session: InternalOperatorSession
): Record<string, string> {
  const operatorRole = normalizeRole(session.operatorRole);

  return {
    "x-operator-api-key": session.apiKey.trim(),
    "x-operator-id": session.operatorId.trim(),
    ...(operatorRole
      ? {
          "x-operator-role": operatorRole
        }
      : {})
  };
}

export function buildInternalWorkerHeaders(
  session: InternalWorkerSession
): Record<string, string> {
  return {
    "x-worker-api-key": session.apiKey.trim(),
    "x-worker-id": session.workerId.trim()
  };
}

export function buildInternalGovernedExecutorHeaders(
  session: InternalGovernedExecutorSession
): Record<string, string> {
  return {
    "x-governed-executor-api-key": session.apiKey.trim(),
    "x-governed-executor-id": session.executorId.trim()
  };
}

export function buildGovernedExecutionDispatchHeaders(
  session: GovernedExecutionDispatchSession
): Record<string, string> {
  return {
    "x-governed-execution-dispatch-api-key": session.apiKey.trim(),
    "x-governed-execution-dispatch-worker-id": session.workerId.trim()
  };
}

export {
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
  CUSTOMER_PASSWORD_POLICY_VERSION,
  customerPasswordErrorMessage,
  validateCustomerPassword,
} from "./password-policy";
export type {
  CustomerPasswordContext,
  CustomerPasswordValidation,
} from "./password-policy";
