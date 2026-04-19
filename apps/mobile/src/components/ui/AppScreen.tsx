import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedSection } from "./AnimatedSection";
import { AppText } from "./AppText";

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  trailing?: ReactNode;
};

export function AppScreen({
  title,
  subtitle,
  children,
  trailing
}: AppScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-parchment">
      <ScrollView
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <AnimatedSection className="gap-3 pt-2" delayOrder={0} variant="up">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-2">
              <AppText className="text-3xl text-ink" weight="bold">
                {title}
              </AppText>
              {subtitle ? (
                <AppText className="text-sm leading-6 text-slate">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {trailing}
          </View>
        </AnimatedSection>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
