import { Alert, Switch, View } from "react-native";
import { useEffect, useState } from "react";
import type { CustomerNotificationPreferences } from "@stealth-trails-bank/types";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { LtrValue } from "../components/ui/LtrValue";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import {
  useProfileQuery,
  useRotatePasswordMutation,
  useUpdateNotificationPreferencesMutation
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import { formatAccountStatusLabel, getAccountStatusTone } from "../lib/account";
import { formatDateLabel } from "../lib/finance";
import { useSessionStore } from "../stores/session-store";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function ProfileScreen() {
  const t = useT();
  const { locale } = useLocale();
  const profileQuery = useProfileQuery();
  const signOut = useSessionStore((state) => state.signOut);
  const rotatePasswordMutation = useRotatePasswordMutation();
  const updatePreferencesMutation = useUpdateNotificationPreferencesMutation();
  const profile = profileQuery.data;
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [notificationDraft, setNotificationDraft] =
    useState<CustomerNotificationPreferences | null>(null);

  useEffect(() => {
    setNotificationDraft(profile?.notificationPreferences ?? null);
  }, [profile?.notificationPreferences]);

  async function handlePasswordUpdate() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert(t("profile.passwordManagement"), t("profile.passwordsMustMatch"));
      return;
    }

    try {
      await rotatePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm(emptyPasswordForm);
      Alert.alert(t("profile.passwordManagement"), t("profile.passwordUpdated"));
    } catch (requestError) {
      Alert.alert(
        t("profile.passwordManagement"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  async function handlePreferencesSave() {
    if (!notificationDraft) {
      return;
    }

    try {
      await updatePreferencesMutation.mutateAsync(notificationDraft);
      Alert.alert(t("profile.notifications"), t("profile.preferencesSaved"));
    } catch (requestError) {
      Alert.alert(
        t("profile.notifications"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  return (
    <AppScreen
      title={t("profile.title")}
      subtitle={profile?.email}
      trailing={<LanguageToggle />}
    >
      {profileQuery.isError ? (
        <InlineNotice
          message={
            profileQuery.error instanceof Error
              ? profileQuery.error.message
              : t("common.notAvailable")
          }
          tone="critical"
        />
      ) : null}

      {profile ? (
        <>
          <SectionCard className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <AppText className="text-xl text-ink" weight="bold">
                  {t("profile.status")}
                </AppText>
                <AppText className="text-sm text-slate">
                  {profile.firstName} {profile.lastName}
                </AppText>
              </View>
              <StatusChip
                label={formatAccountStatusLabel(profile.accountStatus, locale)}
                tone={getAccountStatusTone(profile.accountStatus)}
              />
            </View>
            <View className="gap-3">
              <AppText className="text-sm text-slate">{t("profile.customerId")}</AppText>
              <LtrValue value={profile.customerId ?? t("common.notAvailable")} />
              <AppText className="text-sm text-slate">{t("profile.supabaseUserId")}</AppText>
              <LtrValue value={profile.supabaseUserId} />
              <AppText className="text-sm text-slate">
                {t("profile.productChainAddress")}
              </AppText>
              <LtrValue value={profile.ethereumAddress} />
            </View>
            <View className="flex-row flex-wrap gap-3">
              {profile.activatedAt ? (
                <SectionCard className="min-w-[45%] flex-1">
                  <AppText className="text-xs text-slate">
                    {t("profile.activatedAt")}
                  </AppText>
                  <AppText className="mt-2 text-sm text-ink" weight="semibold">
                    {formatDateLabel(profile.activatedAt, locale)}
                  </AppText>
                </SectionCard>
              ) : null}
              {profile.restrictedAt ? (
                <SectionCard className="min-w-[45%] flex-1">
                  <AppText className="text-xs text-slate">
                    {t("profile.restrictedAt")}
                  </AppText>
                  <AppText className="mt-2 text-sm text-ink" weight="semibold">
                    {formatDateLabel(profile.restrictedAt, locale)}
                  </AppText>
                </SectionCard>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.passwordManagement")}
            </AppText>
            {profile.passwordRotationAvailable ? (
              <>
                <FieldInput
                  label={t("auth.currentPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: value
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.currentPassword}
                />
                <FieldInput
                  label={t("auth.newPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: value
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.newPassword}
                />
                <FieldInput
                  label={t("auth.confirmPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: value
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.confirmPassword}
                />
                <AppButton
                  disabled={rotatePasswordMutation.isPending}
                  label={t("profile.updatePassword")}
                  onPress={() => {
                    void handlePasswordUpdate();
                  }}
                />
              </>
            ) : (
              <InlineNotice
                message={t("common.notAvailable")}
                tone="warning"
              />
            )}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.notifications")}
            </AppText>
            {notificationDraft ? (
              <>
                {[
                  { key: "depositEmails", label: t("profile.deposits") },
                  { key: "withdrawalEmails", label: t("profile.withdrawals") },
                  { key: "loanEmails", label: t("profile.loans") },
                  { key: "productUpdateEmails", label: t("profile.productUpdates") }
                ].map((item) => (
                  <View
                    key={item.key}
                    className="flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-4"
                  >
                    <AppText className="text-sm text-ink" weight="semibold">
                      {item.label}
                    </AppText>
                    <Switch
                      onValueChange={(nextValue) =>
                        setNotificationDraft((current) =>
                          current
                            ? {
                                ...current,
                                [item.key]: nextValue
                              }
                            : current
                        )
                      }
                      value={notificationDraft[item.key as keyof typeof notificationDraft]}
                    />
                  </View>
                ))}
                <AppButton
                  disabled={updatePreferencesMutation.isPending}
                  label={t("profile.savePreferences")}
                  onPress={() => {
                    void handlePreferencesSave();
                  }}
                />
              </>
            ) : (
              <InlineNotice
                message={t("profile.preferencesUnavailable")}
                tone="warning"
              />
            )}
          </SectionCard>

          <AppButton
            label={t("common.signOut")}
            onPress={() => {
              void signOut();
            }}
            variant="danger"
          />
        </>
      ) : null}
    </AppScreen>
  );
}
