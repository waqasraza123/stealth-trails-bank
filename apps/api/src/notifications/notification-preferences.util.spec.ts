import {
  buildNotificationPreferenceMatrix,
  buildNotificationRecipientKey,
  isMandatoryNotificationPreference,
  normalizeNotificationPreferenceMatrix,
} from "./notification-preferences.util";

describe("notification-preferences.util", () => {
  it("builds customer defaults from legacy email preferences while preserving mandatory security channels", () => {
    const matrix = buildNotificationPreferenceMatrix({
      audience: "customer",
      legacyEmailPreferences: {
        depositEmails: false,
        withdrawalEmails: true,
        loanEmails: false,
        productUpdateEmails: false,
      },
    });

    const securityEntry = matrix.entries.find(
      (entry) => entry.category === "security",
    );
    const moneyMovementEntry = matrix.entries.find(
      (entry) => entry.category === "money_movement",
    );
    const loansEntry = matrix.entries.find(
      (entry) => entry.category === "loans",
    );

    expect(securityEntry?.channels.find((channel) => channel.channel === "in_app"))
      .toEqual({
        channel: "in_app",
        enabled: true,
        mandatory: true,
      });
    expect(securityEntry?.channels.find((channel) => channel.channel === "email"))
      .toEqual({
        channel: "email",
        enabled: true,
        mandatory: true,
      });
    expect(
      moneyMovementEntry?.channels.find((channel) => channel.channel === "email")
        ?.enabled,
    ).toBe(true);
    expect(
      loansEntry?.channels.find((channel) => channel.channel === "email")
        ?.enabled,
    ).toBe(false);
  });

  it("normalizes customer matrices by re-enabling mandatory channels and dropping unsupported channels", () => {
    const normalized = normalizeNotificationPreferenceMatrix(
      {
        audience: "customer",
        supportedChannels: ["in_app", "email"],
        updatedAt: null,
        entries: [
          {
            category: "security",
            channels: [
              {
                channel: "in_app",
                enabled: false,
                mandatory: false,
              },
              {
                channel: "email",
                enabled: false,
                mandatory: false,
              },
              {
                channel: "push",
                enabled: true,
                mandatory: false,
              },
            ],
          },
        ],
      },
      "customer",
    );

    const securityEntry = normalized.entries.find(
      (entry) => entry.category === "security",
    );

    expect(securityEntry?.channels.find((channel) => channel.channel === "in_app"))
      .toEqual({
        channel: "in_app",
        enabled: true,
        mandatory: true,
      });
    expect(securityEntry?.channels.find((channel) => channel.channel === "email"))
      .toEqual({
        channel: "email",
        enabled: true,
        mandatory: true,
      });
    expect(
      securityEntry?.channels.find((channel) => channel.channel === "push"),
    ).toBeUndefined();
  });

  it("marks operator incident and operations in-app channels as mandatory and builds recipient keys", () => {
    const matrix = buildNotificationPreferenceMatrix({
      audience: "operator",
    });
    const incidentEntry = matrix.entries.find(
      (entry) => entry.category === "incident",
    );
    const operationsEntry = matrix.entries.find(
      (entry) => entry.category === "operations",
    );

    expect(isMandatoryNotificationPreference("operator", "incident", "in_app"))
      .toBe(true);
    expect(isMandatoryNotificationPreference("operator", "operations", "in_app"))
      .toBe(true);
    expect(
      incidentEntry?.channels.find((channel) => channel.channel === "in_app"),
    ).toEqual({
      channel: "in_app",
      enabled: true,
      mandatory: true,
    });
    expect(
      operationsEntry?.channels.find((channel) => channel.channel === "email")
        ?.enabled,
    ).toBe(false);
    expect(buildNotificationRecipientKey("operator", "operator_db_1")).toBe(
      "operator:operator_db_1",
    );
  });
});
