"use client";
import { LazyMotion, MotionConfig } from "motion/react";

// Reorder animation needs layout support, which lives in domMax rather than
// domAnimation. It is loaded on demand so it stays out of the first bundle.
const loadFeatures = () =>
  import("motion/react").then((module) => module.domMax);

/** Matches --ease-out. Motion cannot read CSS variables, so the curve is repeated here. */
export const easeOut = [0.23, 1, 0.32, 1] as const;
export const enterTransition = { duration: 0.2, ease: easeOut };
export const exitTransition = { duration: 0.14, ease: easeOut };
export const layoutSpring = {
  type: "spring",
  bounce: 0,
  duration: 0.35,
} as const;

export function CriteriaMotion({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
