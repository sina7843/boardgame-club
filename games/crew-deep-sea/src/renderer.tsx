// خدمه: اعماق دریا renderer — the shared Crew console in the sea theme. Card and task art is the deep-sea set delivered in
// design/games/group-c/art/crew-deep-sea; cards and conditions without delivered art keep the sprite / text label.
import type { GameRendererProps } from '@bg/ui';
import { CrewTable, type CrewArt } from '@bg/game-the-crew/renderer';
import type { CrewView } from '@bg/game-the-crew';
import bd from './art/bd-deep.webp'; // cut from a generated sheet (see DECISIONS.md)
import b1 from './art/crew-deep-sea-b1.png';
import b6 from './art/crew-deep-sea-b6.png';
import g5 from './art/crew-deep-sea-g5.png';
import g9 from './art/crew-deep-sea-g9.png';
import p2 from './art/crew-deep-sea-p2.png';
import p8 from './art/crew-deep-sea-p8.png';
import r2 from './art/crew-deep-sea-r2.png';
import y3 from './art/crew-deep-sea-y3.png';
import y4 from './art/crew-deep-sea-y4.png';
import y7 from './art/crew-deep-sea-y7.png';
import y9 from './art/crew-deep-sea-y9.png';
import radio from './art/crew-deep-sea-radio-available.png';
import radioUsed from './art/crew-deep-sea-radio-used.png';
import noNines from './art/crew-deep-sea-task-14.png';
import firstTrick from './art/crew-deep-sea-task-21.png';
import lastTrick from './art/crew-deep-sea-task-24.png';
import exactlyOne from './art/crew-deep-sea-task-28.png';
import { taskLabel } from './rules.ts';

const ART: CrewArt = {
  cards: { b1, b6, g5, g9, p2, p8, r2, y3, y4, y7, y9 },
  task: (t) => (t.cond === 'noNines' ? noNines : t.cond === 'firstTrick' ? firstTrick : t.cond === 'lastTrick' ? lastTrick : t.cond === 'tricksExact' && t.n === 1 ? exactlyOne : undefined),
  radio, radioUsed
};

export default function DeepSeaRenderer(props: GameRendererProps<CrewView>) {
  return <CrewTable {...props} label={taskLabel} theme="sea" backdrop={bd} art={ART} />;
}
