import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutUp, Layout } from "react-native-reanimated";
import { AppText } from "../ui/AppText";

export type AppFeedbackTone = "success" | "info" | "warning" | "error";

type AppFeedbackInput = {
  title?: string;
  message: string;
  tone?: AppFeedbackTone;
  durationMs?: number;
};

type AppFeedbackItem = Required<Omit<AppFeedbackInput, "durationMs">> & {
  id: string;
};

type AppFeedbackContextValue = {
  dismissFeedback: (id: string) => void;
  showFeedback: (input: AppFeedbackInput) => string;
};

type AppFeedbackProviderProps = {
  children: ReactNode;
};

type ScreenFeedbackOverrides = {
  durationMs?: number;
  title?: string;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);
const feedbackEntering =
  typeof FadeInDown?.duration === "function" ? FadeInDown.duration(220) : undefined;
const feedbackExiting =
  typeof FadeOutUp?.duration === "function" ? FadeOutUp.duration(180) : undefined;
const feedbackLayout =
  typeof Layout?.springify === "function"
    ? Layout.springify().damping(22).stiffness(180)
    : undefined;

function getFeedbackIcon(tone: AppFeedbackTone) {
  switch (tone) {
    case "success":
      return "check-decagram";
    case "warning":
      return "alert-decagram-outline";
    case "error":
      return "close-octagon";
    default:
      return "information-outline";
  }
}

function getFeedbackSurfaceClasses(tone: AppFeedbackTone) {
  switch (tone) {
    case "success":
      return {
        badgeSurface: "bg-mint/16",
        badgeText: "text-mint",
        iconColor: "#1f9d73",
        surface: "border-mint/25 bg-[#f3fff8]"
      };
    case "warning":
      return {
        badgeSurface: "bg-amber-100",
        badgeText: "text-amber-900",
        iconColor: "#7c4a03",
        surface: "border-amber-300/50 bg-[#fff8e8]"
      };
    case "error":
      return {
        badgeSurface: "bg-red-100",
        badgeText: "text-danger",
        iconColor: "#c0392b",
        surface: "border-danger/20 bg-[#fff5f5]"
      };
    default:
      return {
        badgeSurface: "bg-sea/14",
        badgeText: "text-sea",
        iconColor: "#0c7d7a",
        surface: "border-sea/16 bg-white/96"
      };
  }
}

function getToneLabel(tone: AppFeedbackTone) {
  switch (tone) {
    case "success":
      return "Resolved";
    case "warning":
      return "Heads up";
    case "error":
      return "Action needed";
    default:
      return "Update";
  }
}

function AppFeedbackViewport({
  items,
  onDismiss
}: {
  items: AppFeedbackItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();

  if (items.length === 0) {
    return null;
  }

  return (
    <View
      className="absolute inset-x-0 z-50 px-4"
      pointerEvents="box-none"
      style={{ top: insets.top + 10 }}
    >
      <View className="gap-3" pointerEvents="box-none">
        {items.map((item) => {
          const classes = getFeedbackSurfaceClasses(item.tone);

          return (
            <Animated.View
              entering={feedbackEntering}
              exiting={feedbackExiting}
              key={item.id}
              layout={feedbackLayout}
            >
              <View
                accessibilityLiveRegion="polite"
                className={`overflow-hidden rounded-[28px] border px-4 py-4 shadow-sm ${classes.surface}`}
              >
                <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-ink/5" />
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/80">
                    <MaterialCommunityIcons
                      color={classes.iconColor}
                      name={getFeedbackIcon(item.tone)}
                      size={22}
                    />
                  </View>
                  <View className="flex-1 gap-2">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-2">
                        <View className={`self-start rounded-full px-2.5 py-1 ${classes.badgeSurface}`}>
                          <AppText className={`text-[11px] uppercase tracking-[1.1px] ${classes.badgeText}`} weight="semibold">
                            {getToneLabel(item.tone)}
                          </AppText>
                        </View>
                        {item.title ? (
                          <AppText className="text-base text-ink" weight="bold">
                            {item.title}
                          </AppText>
                        ) : null}
                        <AppText className="text-sm leading-6 text-slate">
                          {item.message}
                        </AppText>
                      </View>
                      <Pressable
                        accessibilityLabel="Dismiss feedback"
                        className="h-9 w-9 items-center justify-center rounded-full bg-ink/5"
                        hitSlop={10}
                        onPress={() => onDismiss(item.id)}
                      >
                        <MaterialCommunityIcons color="#506071" name="close" size={18} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

export function AppFeedbackProvider({ children }: AppFeedbackProviderProps) {
  const [items, setItems] = useState<AppFeedbackItem[]>([]);
  const timeoutMap = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissFeedback = useCallback((id: string) => {
    const timeout = timeoutMap.current.get(id);

    if (timeout) {
      clearTimeout(timeout);
      timeoutMap.current.delete(id);
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showFeedback = useCallback(
    ({ durationMs, message, title, tone = "info" }: AppFeedbackInput) => {
      const id = `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nextItem: AppFeedbackItem = {
        id,
        message,
        title: title ?? "",
        tone
      };
      const timeoutDuration =
        durationMs ?? (tone === "error" ? 5600 : tone === "warning" ? 4600 : 3800);

      setItems((current) => [nextItem, ...current].slice(0, 4));

      if (timeoutDuration > 0) {
        const timeout = setTimeout(() => {
          dismissFeedback(id);
        }, timeoutDuration);
        timeoutMap.current.set(id, timeout);
      }

      return id;
    },
    [dismissFeedback]
  );

  useEffect(
    () => () => {
      for (const timeout of timeoutMap.current.values()) {
        clearTimeout(timeout);
      }
      timeoutMap.current.clear();
    },
    []
  );

  const value = useMemo(
    () => ({
      dismissFeedback,
      showFeedback
    }),
    [dismissFeedback, showFeedback]
  );

  return (
    <AppFeedbackContext.Provider value={value}>
      <View className="flex-1">
        {children}
        <AppFeedbackViewport items={items} onDismiss={dismissFeedback} />
      </View>
    </AppFeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);

  if (!context) {
    throw new Error("useAppFeedback must be used within AppFeedbackProvider");
  }

  return context;
}

function resolveErrorMessage(error: unknown, fallbackMessage?: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallbackMessage ?? "Something went wrong.";
}

export function useScreenFeedback(defaultTitle?: string) {
  const { dismissFeedback, showFeedback } = useAppFeedback();

  function show(message: string, tone: AppFeedbackTone, overrides?: ScreenFeedbackOverrides) {
    return showFeedback({
      title: overrides?.title ?? defaultTitle,
      message,
      tone,
      durationMs: overrides?.durationMs
    });
  }

  return {
    dismissFeedback,
    error: (message: string, overrides?: ScreenFeedbackOverrides) =>
      show(message, "error", overrides),
    errorFrom: (
      error: unknown,
      fallbackMessage?: string,
      overrides?: ScreenFeedbackOverrides
    ) => show(resolveErrorMessage(error, fallbackMessage), "error", overrides),
    info: (message: string, overrides?: ScreenFeedbackOverrides) =>
      show(message, "info", overrides),
    show: ({
      durationMs,
      message,
      title,
      tone = "info"
    }: AppFeedbackInput) =>
      showFeedback({
        durationMs,
        message,
        title: title ?? defaultTitle,
        tone
      }),
    success: (message: string, overrides?: ScreenFeedbackOverrides) =>
      show(message, "success", overrides),
    warning: (message: string, overrides?: ScreenFeedbackOverrides) =>
      show(message, "warning", overrides)
  };
}
