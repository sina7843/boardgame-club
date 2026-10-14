import { createContext, useContext, type ReactNode } from 'react';

/**
 * Turn controls a game renderer wants in the table's action dock (design: one ActionDock under the felt).
 * The host (the table page) provides a function that renders into the dock (a React portal); without a host the
 * buttons stay where the renderer draws them, so renderers keep working anywhere.
 */
const DockCtx = createContext<((node: ReactNode) => ReactNode) | null>(null);
export const DockSlotHost = DockCtx.Provider;

export function DockSlot({ children }: { children: ReactNode }) {
  const toDock = useContext(DockCtx);
  return <>{toDock ? toDock(children) : children}</>;
}
