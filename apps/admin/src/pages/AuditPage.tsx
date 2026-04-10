import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditEvents } from "@/lib/api";
import {
  ErrorState,
  LoadingState,
  SectionPanel,
  TimelinePanel
} from "@/components/console/primitives";
import { mapAuditEntriesToTimeline, useConfiguredSessionGuard } from "./shared";

export function AuditPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const auditQuery = useQuery({
    queryKey: ["audit-events", session?.baseUrl, deferredSearch],
    queryFn: () => listAuditEvents(session!, { limit: 30, search: deferredSearch || undefined }),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (auditQuery.isLoading) {
    return (
      <LoadingState
        title="Loading audit trail"
        description="Structured event history is loading with actor, target, and timestamp detail."
      />
    );
  }

  if (auditQuery.isError) {
    return (
      <ErrorState
        title="Audit trail unavailable"
        description="Audit history could not be loaded for the current operator session."
      />
    );
  }

  return (
    <SectionPanel
      title="Audit trail"
      description="Searchable event history with actor, target, and timestamp prominence."
      action={
        <input
          className="admin-search-input"
          placeholder="Search audit events"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      }
    >
      <TimelinePanel
        title="Search results"
        description="Timeline-first audit history across customer, operator, and system actions."
        events={mapAuditEntriesToTimeline(
          auditQuery.data!.events.map((event) => ({
            id: event.id,
            actorType: event.actorType,
            actorId: event.actorId,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            metadata: event.metadata,
            createdAt: event.createdAt
          }))
        )}
        emptyState={{
          title: "No audit events matched",
          description: "Adjust the search term to inspect a different slice of system history."
        }}
      />
    </SectionPanel>
  );
}
