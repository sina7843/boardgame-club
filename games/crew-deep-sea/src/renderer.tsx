// خدمه: اعماق دریا renderer — the shared Crew console in the sea theme, with condition tasks as text.
import type { GameRendererProps } from '@bg/ui';
import { CrewTable } from '@bg/game-the-crew/renderer';
import type { CrewView } from '@bg/game-the-crew';
import bd from './art/bd-deep.webp'; // cut from a generated sheet (see DECISIONS.md)
import { taskLabel } from './rules.ts';

export default function DeepSeaRenderer(props: GameRendererProps<CrewView>) {
  return <CrewTable {...props} label={taskLabel} theme="sea" backdrop={bd} />;
}
