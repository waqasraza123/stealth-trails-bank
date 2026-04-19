export const motionDurations = {
  fastMs: 220,
  enterMs: 550,
  heroMs: 800,
  ambientMs: 18000
} as const;

export const motionDelays = {
  staggerMs: 60,
  sectionMs: 120,
  heroMs: 180
} as const;

export const motionDistance = {
  soft: 14,
  medium: 22,
  strong: 32
} as const;

export const motionProfiles = {
  customer: {
    easing: [0.16, 1, 0.3, 1] as const,
    hoverScale: 1.012,
    hoverLift: -8,
    pressScale: 0.986
  },
  admin: {
    easing: [0.2, 0.96, 0.34, 1] as const,
    hoverScale: 1.006,
    hoverLift: -4,
    pressScale: 0.992
  },
  mobile: {
    damping: 18,
    stiffness: 170,
    pressScale: 0.97
  }
} as const;

export const motionAdminMultiplier = 0.82;
