import { loadDatabaseRuntimeConfig } from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import type { Prisma } from "@prisma/client";

type RepairCommand =
  | "repair:missing-customer-projections"
  | "repair:customer-account-wallet-projections"
  | "repair:customer-wallet-projections";

type RepairSurface =
  | "missing_customer_projection"
  | "missing_customer_account"
  | "wallet_only";

type RepairMethod = "create_wallet" | "attach_existing_wallet";

type ScriptOptions = {
  days: number;
  limit: number;
  command?: RepairCommand;
  surface?: RepairSurface;
  batchRunId?: string;
  summaryOnly: boolean;
};

type RecentRepairEvent = {
  auditEventId: string;
  createdAt: string;
  batchRunId: string | null;
  repairCommand: RepairCommand | null;
  repairSurface: RepairSurface | null;
  repairMethod: RepairMethod | null;
  customerId: string | null;
  customerAccountId: string | null;
  targetId: string | null;
  walletId: string | null;
  walletAddress: string | null;
  legacyUserId: number | null;
  supabaseUserId: string | null;
  email: string | null;
  customerCreated: boolean | null;
  customerAccountCreated: boolean | null;
  walletCreated: boolean | null;
  walletAttached: boolean | null;
  action: string;
};

type RepairAuditSummary = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  days: number;
  limit: number;
  commandFilter: RepairCommand | null;
  surfaceFilter: RepairSurface | null;
  batchRunIdFilter: string | null;
  scanned: number;
  byCommand: Record<string, number>;
  bySurface: Record<string, number>;
  byDateUtc: Record<string, number>;
  earliestEventAt: string | null;
  latestEventAt: string | null;
};

const VALID_REPAIR_COMMANDS: RepairCommand[] = [
  "repair:missing-customer-projections",
  "repair:customer-account-wallet-projections",
  "repair:customer-wallet-projections"
];

const VALID_REPAIR_SURFACES: RepairSurface[] = [
  "missing_customer_projection",
  "missing_customer_account",
  "wallet_only"
];

function parseOptions(argv: string[]): ScriptOptions {
  let days = 30;
  let limit = 200;
  let command: RepairCommand | undefined;
  let surface: RepairSurface | undefined;
  let batchRunId: string | undefined;
  let summaryOnly = false;

  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--summary-only") {
      summaryOnly = true;
      continue;
    }

    if (argument.startsWith("--days=")) {
      const rawDays = argument.slice("--days=".length).trim();
      const parsedDays = Number(rawDays);

      if (!Number.isInteger(parsedDays) || parsedDays <= 0) {
        throw new Error("The --days option must be a positive integer.");
      }

      days = parsedDays;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      const rawLimit = argument.slice("--limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error("The --limit option must be a positive integer.");
      }

      limit = parsedLimit;
      continue;
    }

    if (argument.startsWith("--command=")) {
      const commandValue = argument.slice("--command=".length).trim();

      if (!VALID_REPAIR_COMMANDS.includes(commandValue as RepairCommand)) {
        throw new Error(
          `The --command option must be one of: ${VALID_REPAIR_COMMANDS.join(", ")}`
        );
      }

      command = commandValue as RepairCommand;
      continue;
    }

    if (argument.startsWith("--surface=")) {
      const surfaceValue = argument.slice("--surface=".length).trim();

      if (!VALID_REPAIR_SURFACES.includes(surfaceValue as RepairSurface)) {
        throw new Error(
          `The --surface option must be one of: ${VALID_REPAIR_SURFACES.join(", ")}`
        );
      }

      surface = surfaceValue as RepairSurface;
      continue;
    }

    if (argument.startsWith("--batch-run-id=")) {
      const batchRunIdValue = argument.slice("--batch-run-id=".length).trim();

      if (!batchRunIdValue) {
        throw new Error("The --batch-run-id option requires a non-empty value.");
      }

      batchRunId = batchRunIdValue;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    days,
    limit,
    command,
    surface,
    batchRunId,
    summaryOnly
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function parseRepairSurfaceFromAction(action: string): RepairSurface | null {
  if (action === "wallet_projection.missing_customer_projection.repaired") {
    return "missing_customer_projection";
  }

  if (action === "wallet_projection.missing_customer_account.repaired") {
    return "missing_customer_account";
  }

  if (action === "wallet_projection.wallet_only.repaired") {
    return "wallet_only";
  }

  return null;
}

function normalizeRepairCommand(value: unknown): RepairCommand | null {
  return VALID_REPAIR_COMMANDS.includes(value as RepairCommand)
    ? (value as RepairCommand)
    : null;
}

function normalizeRepairSurface(value: unknown): RepairSurface | null {
  return VALID_REPAIR_SURFACES.includes(value as RepairSurface)
    ? (value as RepairSurface)
    : null;
}

function normalizeRepairMethod(value: unknown): RepairMethod | null {
  return value === "create_wallet" || value === "attach_existing_wallet"
    ? value
    : null;
}

function accumulateCount(
  bucket: Record<string, number>,
  key: string | null
): void {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] ?? 0) + 1;
}

function toUtcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapRecentRepairEvent(event: {
  id: string;
  createdAt: Date;
  action: string;
  actorId: string | null;
  customerId: string | null;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
}): RecentRepairEvent {
  const metadata = isRecord(event.metadata) ? event.metadata : {};

  const metadataRepairCommand = normalizeRepairCommand(
    readString(metadata, "repairCommand")
  );
  const metadataRepairSurface = normalizeRepairSurface(
    readString(metadata, "repairSurface")
  );
  const repairCommand =
    normalizeRepairCommand(event.actorId) ?? metadataRepairCommand;
  const repairSurface =
    metadataRepairSurface ?? parseRepairSurfaceFromAction(event.action);

  return {
    auditEventId: event.id,
    createdAt: event.createdAt.toISOString(),
    batchRunId: readString(metadata, "batchRunId"),
    repairCommand,
    repairSurface,
    repairMethod: normalizeRepairMethod(readString(metadata, "repairMethod")),
    customerId: event.customerId,
    customerAccountId: readString(metadata, "customerAccountId"),
    targetId: event.targetId,
    walletId: readString(metadata, "walletId"),
    walletAddress: readString(metadata, "walletAddress"),
    legacyUserId: readNumber(metadata, "legacyUserId"),
    supabaseUserId: readString(metadata, "supabaseUserId"),
    email: readString(metadata, "email"),
    customerCreated: readBoolean(metadata, "customerCreated"),
    customerAccountCreated: readBoolean(metadata, "customerAccountCreated"),
    walletCreated: readBoolean(metadata, "walletCreated"),
    walletAttached: readBoolean(metadata, "walletAttached"),
    action: event.action
  };
}

function createSummary(
  options: ScriptOptions,
  windowStart: Date,
  windowEnd: Date
): RepairAuditSummary {
  return {
    generatedAt: windowEnd.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    days: options.days,
    limit: options.limit,
    commandFilter: options.command ?? null,
    surfaceFilter: options.surface ?? null,
    batchRunIdFilter: options.batchRunId ?? null,
    scanned: 0,
    byCommand: {},
    bySurface: {},
    byDateUtc: {},
    earliestEventAt: null,
    latestEventAt: null
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - options.days * 24 * 60 * 60 * 1000
  );
  const summary = createSummary(options, windowStart, windowEnd);
  const recentEvents: RecentRepairEvent[] = [];

  try {
    const where: Prisma.AuditEventWhereInput = {
      actorType: "system",
      actorId: options.command
        ? options.command
        : {
            in: VALID_REPAIR_COMMANDS
          },
      action: options.surface
        ? `wallet_projection.${options.surface}.repaired`
        : {
            startsWith: "wallet_projection."
          },
      createdAt: {
        gte: windowStart,
        lte: windowEnd
      }
    };

    if (options.batchRunId) {
      where.metadata = {
        path: ["batchRunId"],
        equals: options.batchRunId
      };
    }

    const events = await prisma.auditEvent.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      take: options.limit,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorId: true,
        customerId: true,
        targetId: true,
        metadata: true
      }
    });

    summary.scanned = events.length;

    if (events.length > 0) {
      summary.latestEventAt = events[0].createdAt.toISOString();
      summary.earliestEventAt =
        events[events.length - 1].createdAt.toISOString();
    }

    for (const event of events) {
      const normalizedEvent = mapRecentRepairEvent(event);

      accumulateCount(summary.byCommand, normalizedEvent.repairCommand);
      accumulateCount(summary.bySurface, normalizedEvent.repairSurface);
      accumulateCount(summary.byDateUtc, toUtcDateKey(event.createdAt));

      if (!options.summaryOnly) {
        recentEvents.push(normalizedEvent);
      }
    }

    console.log(
      JSON.stringify(
        {
          summary,
          recentEvents: options.summaryOnly ? [] : recentEvents
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Wallet projection repair audit summary failed.");
  process.exit(1);
});
