import { type HTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  motionAdminMultiplier,
  motionDelays,
  motionDistance,
  motionDurations,
  motionProfiles
} from "@stealth-trails-bank/ui-foundation";

function getAdminDuration(durationMs: number) {
  return (durationMs * motionAdminMultiplier) / 1000;
}

function useMotionDistance(distance: number) {
  const reduceMotion = useReducedMotion();

  return reduceMotion ? 0 : distance;
}

export function AdminStage({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const y = useMotionDistance(motionDistance.medium);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y }}
      {...props}
      transition={{
        duration: getAdminDuration(motionDurations.enterMs),
        ease: motionProfiles.admin.easing
      }}
    >
      {children}
    </motion.div>
  );
}

export function AdminReveal({
  children,
  className = "",
  delay = 0,
  ...props
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
} & HTMLAttributes<HTMLDivElement>) {
  const y = useMotionDistance(motionDistance.soft);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y }}
      {...props}
      transition={{
        delay,
        duration: getAdminDuration(motionDurations.enterMs),
        ease: motionProfiles.admin.easing
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: motionProfiles.admin.hoverScale,
              y: motionProfiles.admin.hoverLift
            }
      }
      whileTap={
        reduceMotion
          ? undefined
          : {
              scale: motionProfiles.admin.pressScale,
              y: 0
            }
      }
    >
      {children}
    </motion.div>
  );
}

export function AdminStagger({
  children,
  className = "",
  delay = 0,
  ...props
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
} & HTMLAttributes<HTMLDivElement>) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      {...props}
      transition={{
        delayChildren: reduceMotion ? 0 : delay,
        staggerChildren:
          reduceMotion ? 0 : (motionDelays.staggerMs * motionAdminMultiplier) / 1000
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

export function AdminStaggerItem({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const y = useMotionDistance(motionDistance.soft);

  return (
    <motion.div
      className={className}
      {...props}
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: getAdminDuration(motionDurations.enterMs),
            ease: motionProfiles.admin.easing
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}
