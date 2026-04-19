import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { OperatorSession, OperatorSessionInfo } from "@/lib/types";

export const operatorSessionSettingsStorageKey =
  "stealth-trails-bank.admin.operator-session-settings";
export const operatorSessionTokenStorageKey =
  "stealth-trails-bank.admin.operator-session-token";
export const operatorSessionStorageKey = operatorSessionSettingsStorageKey;

export type SessionDraft = Pick<
  OperatorSession,
  "baseUrl" | "accessToken" | "operatorId" | "operatorRole"
>;

type OperatorSessionContextValue = {
  sessionDraft: SessionDraft;
  configuredSession: OperatorSession | null;
  setSessionDraft: React.Dispatch<React.SetStateAction<SessionDraft>>;
  saveSession: () => void;
  clearSession: () => void;
  setResolvedSessionInfo: (sessionInfo: OperatorSessionInfo | null) => void;
};

const OperatorSessionContext = createContext<OperatorSessionContextValue | null>(null);

function buildDefaultDraft(serverUrl: string): SessionDraft {
  return {
    baseUrl: serverUrl,
    accessToken: "",
    operatorId: "",
    operatorRole: null
  };
}

function loadStoredDraft(serverUrl: string): SessionDraft {
  if (typeof window === "undefined") {
    return buildDefaultDraft(serverUrl);
  }

  const serializedSettings = window.localStorage.getItem(
    operatorSessionSettingsStorageKey
  );
  window.sessionStorage.removeItem(operatorSessionTokenStorageKey);

  if (!serializedSettings) {
    return buildDefaultDraft(serverUrl);
  }

  try {
    const parsedSettings = JSON.parse(serializedSettings) as Partial<SessionDraft>;

    return {
      baseUrl: parsedSettings.baseUrl || serverUrl,
      accessToken: "",
      operatorId: "",
      operatorRole: null
    };
  } catch {
    return buildDefaultDraft(serverUrl);
  }
}

function persistDraft(session: SessionDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    operatorSessionSettingsStorageKey,
    JSON.stringify({
      baseUrl: session.baseUrl
    })
  );

  window.sessionStorage.removeItem(operatorSessionTokenStorageKey);
}

export function OperatorSessionProvider({
  serverUrl,
  initialDraft,
  children
}: {
  serverUrl: string;
  initialDraft?: Partial<SessionDraft>;
  children: ReactNode;
}) {
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() =>
    initialDraft
      ? {
          ...buildDefaultDraft(serverUrl),
          ...initialDraft
        }
      : loadStoredDraft(serverUrl)
  );
  const [resolvedSessionInfo, setResolvedSessionInfo] =
    useState<OperatorSessionInfo | null>(null);

  const value = useMemo<OperatorSessionContextValue>(() => {
    const configuredSession = sessionDraft.accessToken.trim()
      ? {
          ...sessionDraft,
          operatorId:
            resolvedSessionInfo?.operatorId ?? sessionDraft.operatorId ?? "",
          operatorRole:
            resolvedSessionInfo?.operatorRole ?? sessionDraft.operatorRole ?? null,
          operatorRoles: resolvedSessionInfo?.operatorRoles ?? [],
          operatorDbId: resolvedSessionInfo?.operatorDbId ?? null,
          operatorSupabaseUserId:
            resolvedSessionInfo?.operatorSupabaseUserId ?? null,
          operatorEmail: resolvedSessionInfo?.operatorEmail ?? null,
          authSource: resolvedSessionInfo?.authSource ?? null,
          environment: resolvedSessionInfo?.environment ?? null,
          sessionCorrelationId:
            resolvedSessionInfo?.sessionCorrelationId ?? null
        }
      : null;

    return {
      sessionDraft,
      configuredSession,
      setSessionDraft,
      saveSession: () => persistDraft(sessionDraft),
      clearSession: () => {
        setSessionDraft({
          baseUrl: serverUrl,
          accessToken: "",
          operatorId: "",
          operatorRole: null
        });
        setResolvedSessionInfo(null);
        persistDraft({
          baseUrl: serverUrl,
          accessToken: "",
          operatorId: "",
          operatorRole: null
        });
      },
      setResolvedSessionInfo
    };
  }, [resolvedSessionInfo, serverUrl, sessionDraft]);

  return (
    <OperatorSessionContext.Provider value={value}>
      {children}
    </OperatorSessionContext.Provider>
  );
}

export function useOperatorSession() {
  const context = useContext(OperatorSessionContext);

  if (!context) {
    throw new Error("useOperatorSession must be used within OperatorSessionProvider.");
  }

  return context;
}
