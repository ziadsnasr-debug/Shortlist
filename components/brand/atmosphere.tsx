import { cn } from "@/lib/utils";

// A deep navy field with a teal glow and three translucent bars taken from
// the logo, drifting slowly. Purely decorative: hidden from assistive
// technology and still under reduced motion.
export function Atmosphere({ className }: { className?: string }) {
  return (
    <div className={cn("atmosphere", className)} aria-hidden="true">
      <span className="atmo-bar atmo-bar-1" />
      <span className="atmo-bar atmo-bar-2" />
      <span className="atmo-bar atmo-bar-3" />
    </div>
  );
}
