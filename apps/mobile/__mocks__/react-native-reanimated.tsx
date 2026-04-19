import type { ReactNode } from "react";
import React from "react";
import { Image, ScrollView, Text, View } from "react-native";

function createAnimatedComponent(Component: typeof View) {
  return React.forwardRef(function MockAnimatedComponent(
    {
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    },
    ref
  ) {
    return (
      <Component {...props} ref={ref}>
        {children}
      </Component>
    );
  });
}

function createEnteringAnimation() {
  return {
    duration() {
      return this;
    },
    delay() {
      return this;
    },
    springify() {
      return this;
    },
    reduceMotion() {
      return this;
    }
  };
}

const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  Image: createAnimatedComponent(Image),
  ScrollView: createAnimatedComponent(ScrollView),
  createAnimatedComponent
};

export const FadeInDown = createEnteringAnimation();
export const FadeInUp = createEnteringAnimation();
export const ReduceMotion = {
  System: "system"
};
export const Easing = {
  linear: (value: number) => value,
  ease: (value: number) => value,
  quad: (value: number) => value,
  inOut: (easing: (value: number) => number) => easing,
  out: (easing: (value: number) => number) => easing
};
export function useSharedValue<T>(value: T) {
  return { value };
}
export function useAnimatedStyle(
  updater: () => Record<string, unknown>
) {
  return updater();
}
export function withTiming<T>(value: T) {
  return value;
}
export function withSequence<T>(...values: T[]) {
  return values[values.length - 1];
}
export function withRepeat<T>(value: T) {
  return value;
}

export default Animated;
