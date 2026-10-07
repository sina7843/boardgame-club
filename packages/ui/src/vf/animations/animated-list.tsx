// Copied from the VibeFarsi registry (https://vibefarsi.ir, MIT). Imports rewritten to relative paths.
import * as React from "react";
import { cn } from "../lib/utils.ts";

/** فهرست متحرک. Children enter one after another from the right. Needs the `slide-in` keyframes. */
export function AnimatedList({ children, stagger = 200, className }: { children: React.ReactNode; stagger?: number; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {React.Children.map(children, (child, i) => (
        <li style={{ animation: `slide-in 0.6s cubic-bezier(0.16,1,0.3,1) ${i * stagger}ms both` }}>{child}</li>
      ))}
    </ul>
  );
}