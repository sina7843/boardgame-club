// Copied from the VibeFarsi registry (https://vibefarsi.ir, MIT). Imports rewritten to relative paths.
import { Button, type ButtonProps } from "../ui/button.tsx";
import { cn } from "../lib/utils.ts";

/** دکمه‌ی درخشان. A periodic glint for the one primary action on a page. */
export function ShineButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button className={cn("relative overflow-hidden", className)} {...props}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-black/25 to-transparent" style={{ animation: "shine 2.2s ease-in-out infinite" }} />
      {children}
    </Button>
  );
}