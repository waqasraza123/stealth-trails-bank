import { Children, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  motionDelays,
  motionDistance,
  motionDurations,
  motionProfiles
} from "@stealth-trails-bank/ui-foundation";

function useMotionDistance(distance: number) {
  const reduceMotion = useReducedMotion();

  return reduceMotion ? 0 : distance;
}

export function ScreenTransition({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const y = useMotionDistance(motionDistance.medium);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      className={className}
      initial={{
        filter: reduceMotion ? "blur(0px)" : "blur(10px)",
        opacity: 0,
        y
      }}
      transition={{
        duration: motionDurations.enterMs / 1000,
        ease: motionProfiles.customer.easing
      }}
    >
      {children}
    </motion.div>
  );
}

export function HeroReveal({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: reduceMotion ? 0 : motionDelays.heroMs / 1000,
        staggerChildren: reduceMotion ? 0 : motionDelays.staggerMs / 1000
      }
    }
  };

  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

export function HeroItem({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const y = useMotionDistance(motionDistance.strong);

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: motionDurations.heroMs / 1000,
            ease: motionProfiles.customer.easing
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({
  children,
  className = "",
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      transition={{
        delayChildren: reduceMotion ? 0 : delay,
        staggerChildren: reduceMotion ? 0 : motionDelays.staggerMs / 1000
      }}
      variants={{
        hidden: {},
        visible: {}
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const y = useMotionDistance(motionDistance.soft);

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: motionDurations.enterMs / 1000,
            ease: motionProfiles.customer.easing
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionSurface({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: motionProfiles.customer.hoverScale,
              y: motionProfiles.customer.hoverLift
            }
      }
      whileTap={
        reduceMotion
          ? undefined
          : {
              scale: motionProfiles.customer.pressScale,
              y: 0
            }
      }
    >
      {children}
    </motion.div>
  );
}

export function FilterReveal({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const wrappedChildren = Children.toArray(children);

  return (
    <StaggerGrid className={className} delay={motionDelays.sectionMs / 1000}>
      {wrappedChildren.map((child, index) => (
        <StaggerItem key={index}>{child}</StaggerItem>
      ))}
    </StaggerGrid>
  );
}
