import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  NotificationAudience,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationSourceType,
  OperatorStatus,
  Prisma,
} from "@prisma/client";
import type {
  NotificationDeepLink,
  NotificationFeedItem,
  NotificationFeedResult,
  NotificationPreferenceMatrix,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildNotificationPreferenceMatrix,
  buildNotificationRecipientKey,
  isMandatoryNotificationPreference,
  normalizeNotificationPreferenceMatrix,
} from "./notification-preferences.util";
import { NotificationsRealtimeService } from "./notifications.realtime.service";
import { ListNotificationsDto } from "./dto/list-notifications.dto";

type AuditEventRecord = Prisma.AuditEventGetPayload<{}>;

type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

type LoanEventRecord = Prisma.LoanEventGetPayload<{
  include: {
    loanApplication: {
      select: {
        id: true;
        customerAccount: {
          select: {
            customerId: true;
          };
        };
      };
    };
    loanAgreement: {
      select: {
        id: true;
        customerAccount: {
          select: {
            customerId: true;
          };
        };
      };
    };
  };
}>;

type NotificationProjectionInput = {
  audience: NotificationAudience;
  recipientIds: string[];
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  summary: string;
  body?: string | null;
  deepLink?: NotificationDeepLink | null;
  metadata?: Prisma.JsonValue | null;
  sourceType: NotificationSourceType;
  sourceId: string;
  sourceCreatedAt: Date;
  platformAlertId?: string | null;
};

type FeedItemRecord = Prisma.NotificationFeedItemGetPayload<{
  include: {
    notificationEvent: true;
  };
}>;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private syncPromise: Promise<void> | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly realtimeService: NotificationsRealtimeService,
  ) {}

  onModuleInit(): void {
    this.syncInterval = setInterval(() => {
      void this.syncSourceStreams();
    }, 5000);
  }

  onModuleDestroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async listCustomerNotifications(
    supabaseUserId: string,
    query: ListNotificationsDto,
  ): Promise<NotificationFeedResult> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    await this.syncSourceStreams();
    return this.listNotificationsForRecipient(
      "customer",
      customer.id,
      query,
      customer.id,
      null,
    );
  }

  async getCustomerUnreadSummary(
    supabaseUserId: string,
  ): Promise<NotificationUnreadSummary> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    await this.syncSourceStreams();
    return this.buildUnreadSummary("customer", customer.id, customer.id, null);
  }

  async markCustomerNotificationsRead(
    supabaseUserId: string,
    ids: string[],
  ): Promise<NotificationFeedResult> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    await this.markNotificationsRead("customer", customer.id, ids, customer.id, null);
    return this.listNotificationsForRecipient(
      "customer",
      customer.id,
      {},
      customer.id,
      null,
    );
  }

  async markAllCustomerNotificationsRead(
    supabaseUserId: string,
  ): Promise<NotificationUnreadSummary> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    await this.prismaService.notificationFeedItem.updateMany({
      where: {
        audience: NotificationAudience.customer,
        customerId: customer.id,
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const feed = await this.prismaService.notificationFeedItem.findMany({
      where: {
        audience: NotificationAudience.customer,
        customerId: customer.id,
        archivedAt: null,
      },
      include: {
        notificationEvent: true,
      },
      take: 100,
      orderBy: {
        notificationEvent: {
          sourceCreatedAt: "desc",
        },
      },
    });

    const unreadSummary = await this.buildUnreadSummary(
      "customer",
      customer.id,
      customer.id,
      null,
    );

    for (const item of feed) {
      this.realtimeService.broadcastUpdated(
        buildNotificationRecipientKey("customer", customer.id),
        this.mapFeedItem(item),
        unreadSummary,
      );
    }

    return unreadSummary;
  }

  async archiveCustomerNotifications(
    supabaseUserId: string,
    ids: string[],
  ): Promise<NotificationFeedResult> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    await this.archiveNotifications("customer", customer.id, ids, customer.id, null);
    return this.listNotificationsForRecipient(
      "customer",
      customer.id,
      {},
      customer.id,
      null,
    );
  }

  async getCustomerPreferences(
    supabaseUserId: string,
  ): Promise<NotificationPreferenceMatrix> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    const rows = await this.prismaService.notificationPreference.findMany({
      where: {
        audience: NotificationAudience.customer,
        recipientKey: buildNotificationRecipientKey("customer", customer.id),
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return buildNotificationPreferenceMatrix({
      audience: "customer",
      rows: rows.map((row) => ({
        category: row.category as unknown as NotificationCategory,
        channel: row.channel as unknown as NotificationChannel,
        enabled: row.enabled,
        mandatory: row.mandatory,
        updatedAt: row.updatedAt,
      })),
      legacyEmailPreferences: {
        depositEmails: customer.depositEmailNotificationsEnabled,
        withdrawalEmails: customer.withdrawalEmailNotificationsEnabled,
        loanEmails: customer.loanEmailNotificationsEnabled,
        productUpdateEmails: customer.productUpdateEmailNotificationsEnabled,
      },
    });
  }

  async updateCustomerPreferences(
    supabaseUserId: string,
    matrix: NotificationPreferenceMatrix,
  ): Promise<NotificationPreferenceMatrix> {
    const customer = await this.resolveCustomerOrThrow(supabaseUserId);
    const normalized = normalizeNotificationPreferenceMatrix(matrix, "customer");
    const recipientKey = buildNotificationRecipientKey("customer", customer.id);

    await this.persistPreferences({
      audience: NotificationAudience.customer,
      recipientKey,
      customerId: customer.id,
      operatorId: null,
      matrix: normalized,
    });

    const emailEnabled = (category: NotificationCategory) =>
      normalized.entries
        .find(
          (
            entry: NotificationPreferenceMatrix["entries"][number],
          ) => entry.category === category,
        )
        ?.channels.find(
          (
            channel: NotificationPreferenceMatrix["entries"][number]["channels"][number],
          ) => channel.channel === "email",
        )?.enabled ??
      false;

    await this.prismaService.customer.update({
      where: {
        id: customer.id,
      },
      data: {
        depositEmailNotificationsEnabled: emailEnabled("money_movement"),
        withdrawalEmailNotificationsEnabled: emailEnabled("money_movement"),
        loanEmailNotificationsEnabled: emailEnabled("loans"),
        productUpdateEmailNotificationsEnabled: emailEnabled("product"),
      },
    });

    return this.getCustomerPreferences(supabaseUserId);
  }

  async listOperatorNotifications(
    operatorId: string,
    query: ListNotificationsDto,
  ): Promise<NotificationFeedResult> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    await this.syncSourceStreams();
    return this.listNotificationsForRecipient(
      "operator",
      operator.id,
      query,
      null,
      operator.id,
    );
  }

  async getOperatorUnreadSummary(
    operatorId: string,
  ): Promise<NotificationUnreadSummary> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    await this.syncSourceStreams();
    return this.buildUnreadSummary("operator", operator.id, null, operator.id);
  }

  async markOperatorNotificationsRead(
    operatorId: string,
    ids: string[],
  ): Promise<NotificationFeedResult> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    await this.markNotificationsRead("operator", operator.id, ids, null, operator.id);
    return this.listNotificationsForRecipient(
      "operator",
      operator.id,
      {},
      null,
      operator.id,
    );
  }

  async markAllOperatorNotificationsRead(
    operatorId: string,
  ): Promise<NotificationUnreadSummary> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    await this.prismaService.notificationFeedItem.updateMany({
      where: {
        audience: NotificationAudience.operator,
        operatorId: operator.id,
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return this.buildUnreadSummary("operator", operator.id, null, operator.id);
  }

  async archiveOperatorNotifications(
    operatorId: string,
    ids: string[],
  ): Promise<NotificationFeedResult> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    await this.archiveNotifications("operator", operator.id, ids, null, operator.id);
    return this.listNotificationsForRecipient(
      "operator",
      operator.id,
      {},
      null,
      operator.id,
    );
  }

  async getOperatorPreferences(
    operatorId: string,
  ): Promise<NotificationPreferenceMatrix> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    const rows = await this.prismaService.notificationPreference.findMany({
      where: {
        audience: NotificationAudience.operator,
        recipientKey: buildNotificationRecipientKey("operator", operator.id),
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return buildNotificationPreferenceMatrix({
      audience: "operator",
      rows: rows.map((row) => ({
        category: row.category as unknown as NotificationCategory,
        channel: row.channel as unknown as NotificationChannel,
        enabled: row.enabled,
        mandatory: row.mandatory,
        updatedAt: row.updatedAt,
      })),
    });
  }

  async updateOperatorPreferences(
    operatorId: string,
    matrix: NotificationPreferenceMatrix,
  ): Promise<NotificationPreferenceMatrix> {
    const operator = await this.resolveOperatorOrThrow(operatorId);
    const normalized = normalizeNotificationPreferenceMatrix(matrix, "operator");

    await this.persistPreferences({
      audience: NotificationAudience.operator,
      recipientKey: buildNotificationRecipientKey("operator", operator.id),
      customerId: null,
      operatorId: operator.id,
      matrix: normalized,
    });

    return this.getOperatorPreferences(operatorId);
  }

  private async persistPreferences(input: {
    audience: NotificationAudience;
    recipientKey: string;
    customerId: string | null;
    operatorId: string | null;
    matrix: NotificationPreferenceMatrix;
  }): Promise<void> {
    await this.prismaService.$transaction(async (transaction) => {
      await transaction.notificationPreference.deleteMany({
        where: {
          audience: input.audience,
          recipientKey: input.recipientKey,
        },
      });

      await transaction.notificationPreference.createMany({
        data: input.matrix.entries.flatMap(
          (entry: NotificationPreferenceMatrix["entries"][number]) =>
            entry.channels.map(
              (
                channel: NotificationPreferenceMatrix["entries"][number]["channels"][number],
              ) => ({
              audience: input.audience,
              recipientKey: input.recipientKey,
              customerId: input.customerId,
              operatorId: input.operatorId,
              category: entry.category as unknown as NotificationCategory,
            channel: channel.channel as unknown as NotificationChannel,
            enabled:
              channel.mandatory ||
              isMandatoryNotificationPreference(
                input.audience as unknown as "customer" | "operator",
                entry.category,
                channel.channel,
              )
                ? true
                : channel.enabled,
            mandatory:
              channel.mandatory ||
              isMandatoryNotificationPreference(
                input.audience as unknown as "customer" | "operator",
                entry.category,
                channel.channel,
              ),
            }),
            ),
        ),
      });
    });
  }

  private async listNotificationsForRecipient(
    audience: "customer" | "operator",
    recipientId: string,
    query: Partial<ListNotificationsDto>,
    customerId: string | null,
    operatorDbId: string | null,
  ): Promise<NotificationFeedResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.NotificationFeedItemWhereInput = {
      audience:
        audience === "customer"
          ? NotificationAudience.customer
          : NotificationAudience.operator,
      archivedAt: null,
      ...(audience === "customer"
        ? { customerId: recipientId }
        : { operatorId: recipientId }),
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.category
        ? {
            notificationEvent: {
              category: query.category as unknown as NotificationCategory,
            },
          }
        : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      this.prismaService.notificationFeedItem.findMany({
        where,
        include: {
          notificationEvent: true,
        },
        take: limit,
        orderBy: {
          notificationEvent: {
            sourceCreatedAt: "desc",
          },
        },
      }),
      this.prismaService.notificationFeedItem.count({
        where: {
          audience:
            audience === "customer"
              ? NotificationAudience.customer
              : NotificationAudience.operator,
          archivedAt: null,
          readAt: null,
          ...(audience === "customer"
            ? { customerId: recipientId }
            : { operatorId: recipientId }),
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.mapFeedItem(row)),
      unreadCount,
      limit,
    };
  }

  private async buildUnreadSummary(
    audience: "customer" | "operator",
    recipientId: string,
    customerId: string | null,
    operatorDbId: string | null,
  ): Promise<NotificationUnreadSummary> {
    const rows = await this.prismaService.notificationFeedItem.findMany({
      where: {
        audience:
          audience === "customer"
            ? NotificationAudience.customer
            : NotificationAudience.operator,
        ...(audience === "customer"
          ? { customerId: recipientId }
          : { operatorId: recipientId }),
        readAt: null,
        archivedAt: null,
      },
      include: {
        notificationEvent: true,
      },
    });

    return {
      unreadCount: rows.length,
      criticalCount: rows.filter(
        (row) => row.notificationEvent.priority === NotificationPriority.critical,
      ).length,
      highCount: rows.filter(
        (row) => row.notificationEvent.priority === NotificationPriority.high,
      ).length,
    };
  }

  private mapFeedItem(row: FeedItemRecord): NotificationFeedItem {
    return {
      id: row.id,
      audience: row.audience,
      category: row.notificationEvent.category,
      priority: row.notificationEvent.priority,
      title: row.notificationEvent.title,
      summary: row.notificationEvent.summary,
      body: row.notificationEvent.body,
      sourceType: row.notificationEvent.sourceType,
      sourceId: row.notificationEvent.sourceId,
      readAt: row.readAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      eventCreatedAt: row.notificationEvent.sourceCreatedAt.toISOString(),
      deepLink: (row.notificationEvent.deepLink as NotificationDeepLink | null) ?? null,
      metadata:
        (row.notificationEvent.metadata as unknown as NotificationFeedItem["metadata"]) ??
        null,
    };
  }

  private async markNotificationsRead(
    audience: "customer" | "operator",
    recipientId: string,
    ids: string[],
    customerId: string | null,
    operatorDbId: string | null,
  ): Promise<void> {
    if (ids.length === 0) {
      throw new BadRequestException("At least one notification id is required.");
    }

    const rows = await this.prismaService.notificationFeedItem.findMany({
      where: {
        id: {
          in: ids,
        },
        audience:
          audience === "customer"
            ? NotificationAudience.customer
            : NotificationAudience.operator,
        ...(audience === "customer"
          ? { customerId: recipientId }
          : { operatorId: recipientId }),
      },
      include: {
        notificationEvent: true,
      },
    });

    if (rows.length === 0) {
      return;
    }

    await this.prismaService.notificationFeedItem.updateMany({
      where: {
        id: {
          in: rows.map((row) => row.id),
        },
      },
      data: {
        readAt: new Date(),
      },
    });

    const refreshed = await this.prismaService.notificationFeedItem.findMany({
      where: {
        id: {
          in: rows.map((row) => row.id),
        },
      },
      include: {
        notificationEvent: true,
      },
    });

    const unreadSummary = await this.buildUnreadSummary(
      audience,
      recipientId,
      customerId,
      operatorDbId,
    );

    for (const row of refreshed) {
      this.realtimeService.broadcastUpdated(
        buildNotificationRecipientKey(audience, recipientId),
        this.mapFeedItem(row),
        unreadSummary,
      );
    }
  }

  private async archiveNotifications(
    audience: "customer" | "operator",
    recipientId: string,
    ids: string[],
    customerId: string | null,
    operatorDbId: string | null,
  ): Promise<void> {
    if (ids.length === 0) {
      throw new BadRequestException("At least one notification id is required.");
    }

    const rows = await this.prismaService.notificationFeedItem.findMany({
      where: {
        id: {
          in: ids,
        },
        audience:
          audience === "customer"
            ? NotificationAudience.customer
            : NotificationAudience.operator,
        ...(audience === "customer"
          ? { customerId: recipientId }
          : { operatorId: recipientId }),
      },
      include: {
        notificationEvent: true,
      },
    });

    if (rows.length === 0) {
      return;
    }

    await this.prismaService.notificationFeedItem.updateMany({
      where: {
        id: {
          in: rows.map((row) => row.id),
        },
      },
      data: {
        archivedAt: new Date(),
      },
    });

    const refreshed = await this.prismaService.notificationFeedItem.findMany({
      where: {
        id: {
          in: rows.map((row) => row.id),
        },
      },
      include: {
        notificationEvent: true,
      },
    });

    const unreadSummary = await this.buildUnreadSummary(
      audience,
      recipientId,
      customerId,
      operatorDbId,
    );

    for (const row of refreshed) {
      this.realtimeService.broadcastUpdated(
        buildNotificationRecipientKey(audience, recipientId),
        this.mapFeedItem(row),
        unreadSummary,
      );
    }
  }

  async syncSourceStreams(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        await this.syncAuditEvents();
        await this.syncLoanEvents();
        await this.syncPlatformAlerts();
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private async syncAuditEvents(): Promise<void> {
    const cursor = await this.loadCursor(NotificationSourceType.audit_event);
    const rows = await this.prismaService.auditEvent.findMany({
      where: cursor.lastCreatedAt
        ? {
            createdAt: {
              gte: cursor.lastCreatedAt,
            },
          }
        : undefined,
      orderBy: {
        createdAt: "asc",
      },
      take: 200,
    });

    const events = rows.filter((row) => {
      if (!cursor.lastCreatedAt) {
        return true;
      }

      return (
        row.createdAt.getTime() > cursor.lastCreatedAt.getTime() ||
        row.id !== cursor.lastSourceId
      );
    });

    for (const event of events) {
      const projections = await this.projectAuditEvent(event);

      for (const projection of projections) {
        await this.persistProjection(projection);
      }

      await this.persistCursor(NotificationSourceType.audit_event, event.id, event.createdAt);
    }
  }

  private async syncLoanEvents(): Promise<void> {
    const cursor = await this.loadCursor(NotificationSourceType.loan_event);
    const rows = await this.prismaService.loanEvent.findMany({
      where: cursor.lastCreatedAt
        ? {
            createdAt: {
              gte: cursor.lastCreatedAt,
            },
          }
        : undefined,
      orderBy: {
        createdAt: "asc",
      },
      take: 200,
      include: {
        loanApplication: {
          select: {
            id: true,
            customerAccount: {
              select: {
                customerId: true,
              },
            },
          },
        },
        loanAgreement: {
          select: {
            id: true,
            customerAccount: {
              select: {
                customerId: true,
              },
            },
          },
        },
      },
    });

    const events = rows.filter((row) => {
      if (!cursor.lastCreatedAt) {
        return true;
      }

      return (
        row.createdAt.getTime() > cursor.lastCreatedAt.getTime() ||
        row.id !== cursor.lastSourceId
      );
    });

    for (const event of events) {
      const projections = await this.projectLoanEvent(event);

      for (const projection of projections) {
        await this.persistProjection(projection);
      }

      await this.persistCursor(NotificationSourceType.loan_event, event.id, event.createdAt);
    }
  }

  private async syncPlatformAlerts(): Promise<void> {
    const cursor = await this.loadCursor(NotificationSourceType.platform_alert);
    const rows = await this.prismaService.platformAlert.findMany({
      where: cursor.lastCreatedAt
        ? {
            createdAt: {
              gte: cursor.lastCreatedAt,
            },
          }
        : undefined,
      orderBy: {
        createdAt: "asc",
      },
      take: 200,
    });

    const alerts = rows.filter((row) => {
      if (!cursor.lastCreatedAt) {
        return true;
      }

      return (
        row.createdAt.getTime() > cursor.lastCreatedAt.getTime() ||
        row.id !== cursor.lastSourceId
      );
    });

    for (const alert of alerts) {
      const projection = await this.projectPlatformAlert(alert);

      if (projection) {
        await this.persistProjection(projection);
      }

      await this.persistCursor(
        NotificationSourceType.platform_alert,
        alert.id,
        alert.createdAt,
      );
    }
  }

  private async persistProjection(input: NotificationProjectionInput): Promise<void> {
    const event = await this.prismaService.notificationEvent.upsert({
      where: {
        sourceType_sourceId_audience: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          audience: input.audience,
        },
      },
      update: {
        category: input.category,
        priority: input.priority,
        title: input.title,
        summary: input.summary,
        body: input.body ?? null,
        deepLink: (input.deepLink ?? null) as Prisma.InputJsonValue,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        sourceCreatedAt: input.sourceCreatedAt,
        platformAlertId: input.platformAlertId ?? null,
      },
      create: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        audience: input.audience,
        category: input.category,
        priority: input.priority,
        title: input.title,
        summary: input.summary,
        body: input.body ?? null,
        deepLink: (input.deepLink ?? null) as Prisma.InputJsonValue,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        sourceCreatedAt: input.sourceCreatedAt,
        platformAlertId: input.platformAlertId ?? null,
      },
    });

    for (const recipientId of input.recipientIds) {
      const recipientKey = buildNotificationRecipientKey(
        input.audience as unknown as "customer" | "operator",
        recipientId,
      );
      const existingFeedItem =
        await this.prismaService.notificationFeedItem.findUnique({
          where: {
            notificationEventId_recipientKey: {
              notificationEventId: event.id,
              recipientKey,
            },
          },
          include: {
            notificationEvent: true,
          },
        });

      if (existingFeedItem) {
        continue;
      }

      const createdFeedItem = await this.prismaService.notificationFeedItem.create({
        data: {
          notificationEventId: event.id,
          audience: input.audience,
          recipientKey,
          customerId:
            input.audience === NotificationAudience.customer ? recipientId : null,
          operatorId:
            input.audience === NotificationAudience.operator ? recipientId : null,
        },
        include: {
          notificationEvent: true,
        },
      });

      const unreadSummary = await this.buildUnreadSummary(
        input.audience === NotificationAudience.customer ? "customer" : "operator",
        recipientId,
        input.audience === NotificationAudience.customer ? recipientId : null,
        input.audience === NotificationAudience.operator ? recipientId : null,
      );

      this.realtimeService.broadcastCreated(
        recipientKey,
        this.mapFeedItem(createdFeedItem),
        unreadSummary,
      );
    }
  }

  private async loadCursor(sourceType: NotificationSourceType) {
    const cursor = await this.prismaService.notificationDeliveryCursor.findUnique({
      where: {
        sourceType,
      },
    });

    return {
      lastSourceId: cursor?.lastSourceId ?? null,
      lastCreatedAt: cursor?.lastCreatedAt ?? null,
    };
  }

  private async persistCursor(
    sourceType: NotificationSourceType,
    sourceId: string,
    createdAt: Date,
  ): Promise<void> {
    await this.prismaService.notificationDeliveryCursor.upsert({
      where: {
        sourceType,
      },
      update: {
        lastSourceId: sourceId,
        lastCreatedAt: createdAt,
      },
      create: {
        sourceType,
        lastSourceId: sourceId,
        lastCreatedAt: createdAt,
      },
    });
  }

  private async resolveCustomerOrThrow(supabaseUserId: string) {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        supabaseUserId,
      },
      select: {
        id: true,
        depositEmailNotificationsEnabled: true,
        withdrawalEmailNotificationsEnabled: true,
        loanEmailNotificationsEnabled: true,
        productUpdateEmailNotificationsEnabled: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer profile not found.");
    }

    return customer;
  }

  private async resolveOperatorOrThrow(operatorId: string) {
    const operator = await this.prismaService.operator.findFirst({
      where: {
        operatorId,
        status: OperatorStatus.active,
      },
      select: {
        id: true,
        operatorId: true,
      },
    });

    if (!operator) {
      throw new NotFoundException("Operator profile not found.");
    }

    return operator;
  }

  private async listActiveOperatorRecipientIds(): Promise<string[]> {
    const operators = await this.prismaService.operator.findMany({
      where: {
        status: OperatorStatus.active,
      },
      select: {
        id: true,
      },
    });

    return operators.map((operator) => operator.id);
  }

  private deriveCategoryFromAction(action: string): NotificationCategory {
    if (
      action.startsWith("transaction_intent.") ||
      action.startsWith("customer_account.incident_package_release")
    ) {
      return "money_movement";
    }

    if (action.startsWith("retirement_vault.")) {
      return "vault";
    }

    if (action.startsWith("staking.")) {
      return action.includes("pool_creation") ? "governance" : "yield";
    }

    if (action.startsWith("customer_account.")) {
      return action.includes("mfa") ||
        action.includes("session") ||
        action.includes("password")
        ? "security"
        : "account";
    }

    if (action.startsWith("governed_execution.")) {
      return "governance";
    }

    if (
      action.startsWith("ledger_reconciliation.") ||
      action.startsWith("solvency.") ||
      action.startsWith("release_readiness.")
    ) {
      return "operations";
    }

    if (action.startsWith("oversight_incident.")) {
      return "incident";
    }

    if (action.startsWith("loan.")) {
      return "loans";
    }

    return "product";
  }

  private derivePriorityFromAction(action: string): NotificationPriority {
    if (
      action.includes("failed") ||
      action.includes("rejected") ||
      action.includes("denied") ||
      action.includes("lockout") ||
      action.includes("restricted") ||
      action.includes("execution_failed")
    ) {
      return "critical";
    }

    if (
      action.includes("review_required") ||
      action.includes("opened") ||
      action.includes("escalated") ||
      action.includes("requested") ||
      action.includes("queued") ||
      action.includes("mutation_blocked")
    ) {
      return "high";
    }

    if (
      action.includes("approved") ||
      action.includes("settled") ||
      action.includes("completed") ||
      action.includes("confirmed") ||
      action.includes("executed") ||
      action.includes("released")
    ) {
      return "normal";
    }

    return "low";
  }

  private humanizeAction(action: string): string {
    const normalized = action
      .replace(/^transaction_intent\./, "")
      .replace(/^customer_account\./, "")
      .replace(/^retirement_vault\./, "")
      .replace(/^staking\./, "")
      .replace(/^oversight_incident\./, "")
      .replace(/^review_case\./, "")
      .replace(/^governed_execution\./, "")
      .replace(/^release_readiness\./, "")
      .replace(/^ledger_reconciliation\./, "")
      .replace(/^loan\./, "")
      .replace(/\./g, " ")
      .replace(/_/g, " ");

    return normalized.replace(/\b\w/g, (token: string) => token.toUpperCase());
  }

  private buildCustomerDeepLink(action: string, targetId: string | null): NotificationDeepLink {
    if (action.startsWith("customer_account.")) {
      return {
        label: "Open profile",
        webPath: "/profile",
        adminPath: null,
        mobileRoute: "Profile",
        mobileParams: null,
      };
    }

    if (action.startsWith("retirement_vault.")) {
      return {
        label: "Open retirement vault",
        webPath: "/vault",
        adminPath: null,
        mobileRoute: "RetirementVault",
        mobileParams: null,
      };
    }

    if (action.startsWith("staking.")) {
      const focus = action.includes("reward_claim")
        ? "claim"
        : action.includes("withdrawal") || action.includes("emergency_withdrawal")
          ? "withdraw"
          : "stake";

      return {
        label: "Open yield",
        webPath: "/yield",
        adminPath: null,
        mobileRoute: "MainTabs",
        mobileParams: {
          screen: "Yield",
          params: {
            focus,
          },
        },
      };
    }

    if (action.startsWith("loan.")) {
      return {
        label: "Open loans",
        webPath: "/loans",
        adminPath: null,
        mobileRoute: "Loans",
        mobileParams: null,
      };
    }

    return {
      label: "Open transactions",
      webPath: "/transactions",
      adminPath: null,
      mobileRoute: "MainTabs",
      mobileParams: {
        screen: "Transactions",
      },
    };
  }

  private buildOperatorDeepLink(
    action: string,
    sourceId: string,
    metadata?: Prisma.JsonValue | null,
  ): NotificationDeepLink {
    if (action.startsWith("oversight_incident.")) {
      return {
        label: "Open incidents",
        webPath: null,
        adminPath: "/alerts",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("customer_account.mfa_recovery")) {
      return {
        label: "Open MFA recovery",
        webPath: null,
        adminPath: "/mfa-recovery",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("customer_account.session_risk")) {
      return {
        label: "Open session risk",
        webPath: null,
        adminPath: "/session-risk",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("retirement_vault.")) {
      return {
        label: "Open vault releases",
        webPath: null,
        adminPath: "/vault-releases",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("staking.")) {
      return {
        label: "Open staking governance",
        webPath: null,
        adminPath: "/staking-governance",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("governed_execution.")) {
      return {
        label: "Open governed execution",
        webPath: null,
        adminPath: "/governed-execution",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("ledger_reconciliation.")) {
      return {
        label: "Open reconciliation",
        webPath: null,
        adminPath: "/reconciliation",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("release_readiness.")) {
      return {
        label: "Open launch readiness",
        webPath: null,
        adminPath: "/launch-readiness",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("solvency.")) {
      return {
        label: "Open solvency",
        webPath: null,
        adminPath: "/solvency",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    if (action.startsWith("customer_account.incident_package")) {
      return {
        label: "Open incident packages",
        webPath: null,
        adminPath: "/incident-packages",
        mobileRoute: null,
        mobileParams: null,
      };
    }

    return {
      label: "Open queues",
      webPath: null,
      adminPath: "/queues",
      mobileRoute: null,
      mobileParams: null,
    };
  }

  private async projectAuditEvent(
    event: AuditEventRecord,
  ): Promise<NotificationProjectionInput[]> {
    const action = event.action;
    const projections: NotificationProjectionInput[] = [];

    if (
      action.includes(".email_delivery_") ||
      action.startsWith("client_telemetry.")
    ) {
      return projections;
    }

    const customerRelevant =
      Boolean(event.customerId) &&
      (action.startsWith("customer_account.") ||
        action.startsWith("transaction_intent.") ||
        action.startsWith("retirement_vault.") ||
        action.startsWith("staking.") ||
        action.startsWith("loan."));

    if (customerRelevant && event.customerId) {
      const customerRecipientIds = [event.customerId];

      if (action.startsWith("transaction_intent.internal_balance_transfer.")) {
        const recipientCustomerAccountId =
          typeof (event.metadata as Record<string, unknown> | null)?.[
            "recipientCustomerAccountId"
          ] === "string"
            ? ((event.metadata as Record<string, unknown>)["recipientCustomerAccountId"] as string)
            : null;

        if (recipientCustomerAccountId) {
          const recipientAccount = await this.prismaService.customerAccount.findUnique({
            where: {
              id: recipientCustomerAccountId,
            },
            select: {
              customerId: true,
            },
          });

          if (recipientAccount?.customerId) {
            customerRecipientIds.push(recipientAccount.customerId);
          }
        }
      }

      projections.push({
        audience: NotificationAudience.customer,
        recipientIds: Array.from(new Set(customerRecipientIds)),
        category: this.deriveCategoryFromAction(action),
        priority: this.derivePriorityFromAction(action),
        title: this.humanizeAction(action),
        summary:
          action.startsWith("transaction_intent.")
            ? "Your money movement status changed."
            : action.startsWith("customer_account.")
              ? "Your account security or profile state changed."
              : action.startsWith("retirement_vault.")
                ? "Your retirement vault status changed."
                : action.startsWith("staking.")
                  ? "Your yield activity changed."
                  : "Your notification feed has a new event.",
        body:
          typeof (event.metadata as Record<string, unknown> | null)?.["note"] === "string"
            ? ((event.metadata as Record<string, unknown>)["note"] as string)
            : null,
        deepLink: this.buildCustomerDeepLink(action, event.targetId),
        metadata: event.metadata,
        sourceType: NotificationSourceType.audit_event,
        sourceId: event.id,
        sourceCreatedAt: event.createdAt,
      });
    }

    const operatorRelevant =
      action.includes("review_required") ||
      action.startsWith("review_case.") ||
      action.startsWith("oversight_incident.") ||
      action.startsWith("customer_account.mfa_recovery") ||
      action.startsWith("customer_account.session_risk") ||
      action.startsWith("retirement_vault.release_") ||
      action.startsWith("retirement_vault.rule_change_") ||
      action.startsWith("staking.pool_creation") ||
      action.startsWith("governed_execution.") ||
      action.startsWith("ledger_reconciliation.") ||
      action.startsWith("solvency.") ||
      action.startsWith("release_readiness.") ||
      action.startsWith("customer_account.incident_package") ||
      action.startsWith("transaction_intent.withdrawal.") ||
      action.startsWith("transaction_intent.internal_balance_transfer.");

    if (operatorRelevant) {
      const operatorRecipientIds = await this.listActiveOperatorRecipientIds();

      if (operatorRecipientIds.length > 0) {
        projections.push({
          audience: NotificationAudience.operator,
          recipientIds: operatorRecipientIds,
          category: this.deriveCategoryFromAction(action),
          priority: this.derivePriorityFromAction(action),
          title: this.humanizeAction(action),
          summary: "A governed or operational workflow needs attention.",
          body:
            typeof (event.metadata as Record<string, unknown> | null)?.["note"] === "string"
              ? ((event.metadata as Record<string, unknown>)["note"] as string)
              : null,
          deepLink: this.buildOperatorDeepLink(action, event.id, event.metadata),
          metadata: event.metadata,
          sourceType: NotificationSourceType.audit_event,
          sourceId: event.id,
          sourceCreatedAt: event.createdAt,
        });
      }
    }

    return projections;
  }

  private async projectLoanEvent(
    event: LoanEventRecord,
  ): Promise<NotificationProjectionInput[]> {
    const customerId =
      event.loanAgreement?.customerAccount.customerId ??
      event.loanApplication?.customerAccount.customerId ??
      null;

    if (!customerId) {
      return [];
    }

    return [
      {
        audience: NotificationAudience.customer,
        recipientIds: [customerId],
        category: "loans",
        priority: this.derivePriorityFromAction(event.eventType),
        title: this.humanizeAction(`loan.${event.eventType}`),
        summary: "Your managed lending status changed.",
        body: event.note ?? null,
        deepLink: {
          label: "Open loans",
          webPath: "/loans",
          adminPath: null,
          mobileRoute: "Loans",
          mobileParams: null,
        },
        metadata: event.metadata,
        sourceType: NotificationSourceType.loan_event,
        sourceId: event.id,
        sourceCreatedAt: event.createdAt,
      },
    ];
  }

  private async projectPlatformAlert(
    alert: PlatformAlertRecord,
  ): Promise<NotificationProjectionInput | null> {
    const operatorRecipientIds = await this.listActiveOperatorRecipientIds();

    if (operatorRecipientIds.length === 0) {
      return null;
    }

    return {
      audience: NotificationAudience.operator,
      recipientIds: operatorRecipientIds,
      category: "operations",
      priority:
        alert.severity === "critical"
          ? "critical"
          : alert.severity === "warning"
            ? "high"
            : "normal",
      title: alert.summary,
      summary: alert.detail ?? "A platform alert requires review.",
      body: alert.detail ?? null,
      deepLink: {
        label: "Open alert",
        webPath: null,
        adminPath: `/alerts?alert=${alert.id}`,
        mobileRoute: null,
        mobileParams: null,
      },
      metadata: alert.metadata,
      sourceType: NotificationSourceType.platform_alert,
      sourceId: alert.id,
      sourceCreatedAt: alert.createdAt,
      platformAlertId: alert.id,
    };
  }
}
