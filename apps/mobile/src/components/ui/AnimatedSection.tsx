import type { ReactNode } from "react";
import Animated, {
  FadeInDown,
  FadeInUp,
  ReduceMotion
} from "react-native-reanimated";
import {
  motionDelays,
  motionDurations
} from "@stealth-trails-bank/ui-foundation";

type AnimatedSectionProps = {
  children: ReactNode;
  delayOrder?: number;
  variant?: "down" | "up";
  className?: string;
};

export function AnimatedSection({
  children,
  delayOrder = 0,
  variant = "down",
  className = ""
}: AnimatedSectionProps) {
  const delay = delayOrder * motionDelays.staggerMs;
  const entering =
    variant === "up"
      ? FadeInUp.duration(motionDurations.enterMs).delay(delay).springify()
      : FadeInDown.duration(motionDurations.enterMs).delay(delay).springify();

  return (
    <Animated.View
      className={className}
      entering={entering.reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}
