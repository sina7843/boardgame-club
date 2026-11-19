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

/**
 * Shared table frame of groups A–D (apps/web Table.tsx FrameView). `useInFrame()` tells a renderer it sits inside that
 * frame ('duel' = two player bars, 'seats' = opponent seat strip) so it can leave out what the shell already draws
 * (player panels, whose-turn text, clocks). Outside the frame it returns null and the renderer keeps its own panels.
 */
export type FrameKind = 'duel' | 'seats';
const FrameCtx = createContext<FrameKind | null>(null);
export const FrameKindHost = FrameCtx.Provider;
export const useInFrame = () => useContext(FrameCtx);

/**
 * Guide card of the frame's rail («کارت راهنما»: the key rule or the hint for this moment). Same portal pattern as
 * DockSlot; a renderer that renders nothing into it gets no guide card, and outside the frame the content stays inline.
 */
const RailCtx = createContext<((node: ReactNode) => ReactNode) | null>(null);
export const RailSlotHost = RailCtx.Provider;

export function RailSlot({ children }: { children: ReactNode }) {
  const toRail = useContext(RailCtx);
  return <>{toRail ? toRail(children) : children}</>;
}
