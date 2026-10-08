import type { ComponentType } from 'react';
import LineThreeCover from '@bg/game-line-three/cover';
import SealedBidsCover from '@bg/game-sealed-bids/cover';
import UnoCover from '@bg/game-uno/cover';
import ChessCover from '@bg/game-chess/cover';
import SnakesCover from '@bg/game-snakes-ladders/cover';
import LudoCover from '@bg/game-ludo/cover';
import AmlakCover from '@bg/game-amlak/cover';
import UnmatchedCover from '@bg/game-unmatched/cover';
import CatanCover from '@bg/game-catan/cover';
import RiskCover from '@bg/game-risk/cover';
import TtrCover from '@bg/game-ticket-to-ride/cover';
import BackgammonCover from '@bg/game-backgammon/cover';
import CheckersCover from '@bg/game-checkers/cover';
import OthelloCover from '@bg/game-othello/cover';
import QuoridorCover from '@bg/game-quoridor/cover';
import OnitamaCover from '@bg/game-onitama/cover';
import GoCover from '@bg/game-go/cover';
import SantoriniCover from '@bg/game-santorini/cover';
import TakCover from '@bg/game-tak/cover';
import AbaloneCover from '@bg/game-abalone/cover';
import HiveCover from '@bg/game-hive/cover';
import NoThanksCover from '@bg/game-no-thanks/cover';
import SixNimmtCover from '@bg/game-six-nimmt/cover';
import LoveLetterCover from '@bg/game-love-letter/cover';
import SkullCover from '@bg/game-skull/cover';
import CoupCover from '@bg/game-coup/cover';
import ForSaleCover from '@bg/game-for-sale/cover';
import HighSocietyCover from '@bg/game-high-society/cover';
import SushiGoCover from '@bg/game-sushi-go/cover';
import LostCitiesCover from '@bg/game-lost-cities/cover';
import TheMindCover from '@bg/game-the-mind/cover';
import SplendorCover from '@bg/game-splendor/cover';
import AzulCover from '@bg/game-azul/cover';
import JaipurCover from '@bg/game-jaipur/cover';
import PatchworkCover from '@bg/game-patchwork/cover';
import KingdominoCover from '@bg/game-kingdomino/cover';
import PointSaladCover from '@bg/game-point-salad/cover';
import CockroachPokerCover from '@bg/game-cockroach-poker/cover';
import ScoutCover from '@bg/game-scout/cover';
import CenturyCover from '@bg/game-century/cover';
import SeaSaltPaperCover from '@bg/game-sea-salt-paper/cover';
import HanabiCover from '@bg/game-hanabi/cover';
import CamelUpCover from '@bg/game-camel-up/cover';
import MachiKoroCover from '@bg/game-machi-koro/cover';
import KingOfTokyoCover from '@bg/game-king-of-tokyo/cover';
import CitadelsCover from '@bg/game-citadels/cover';
import CarcassonneCover from '@bg/game-carcassonne/cover';
import BohnanzaCover from '@bg/game-bohnanza/cover';
import WondersDuelCover from '@bg/game-wonders-duel/cover';
import DominionCover from '@bg/game-dominion/cover';
import StarRealmsCover from '@bg/game-star-realms/cover';
import TheCrewCover from '@bg/game-the-crew/cover';
import CrewDeepSeaCover from '@bg/game-crew-deep-sea/cover';
import SpaceBaseCover from '@bg/game-space-base/cover';

// Client-side registry of reviewed game renderers. Only covers for now; table renderers join in DRAGON-01.
const COVERS: Record<string, ComponentType<{ title: string }>> = {
  'line-three': LineThreeCover,
  'sealed-bids': SealedBidsCover,
  uno: UnoCover,
  unmatched: UnmatchedCover,
  catan: CatanCover,
  risk: RiskCover,
  'ticket-to-ride': TtrCover,
  chess: ChessCover,
  'snakes-ladders': SnakesCover,
  ludo: LudoCover,
  amlak: AmlakCover,
  backgammon: BackgammonCover,
  checkers: CheckersCover,
  othello: OthelloCover,
  quoridor: QuoridorCover,
  onitama: OnitamaCover,
  go: GoCover,
  santorini: SantoriniCover,
  tak: TakCover,
  abalone: AbaloneCover,
  hive: HiveCover,
  'no-thanks': NoThanksCover,
  'six-nimmt': SixNimmtCover,
  'love-letter': LoveLetterCover,
  skull: SkullCover,
  coup: CoupCover,
  'for-sale': ForSaleCover,
  'high-society': HighSocietyCover,
  'sushi-go': SushiGoCover,
  'lost-cities': LostCitiesCover,
  'the-mind': TheMindCover,
  splendor: SplendorCover,
  azul: AzulCover,
  jaipur: JaipurCover,
  patchwork: PatchworkCover,
  kingdomino: KingdominoCover,
  'point-salad': PointSaladCover,
  'cockroach-poker': CockroachPokerCover,
  scout: ScoutCover,
  century: CenturyCover,
  'sea-salt-paper': SeaSaltPaperCover,
  hanabi: HanabiCover,
  'camel-up': CamelUpCover,
  'machi-koro': MachiKoroCover,
  'king-of-tokyo': KingOfTokyoCover,
  citadels: CitadelsCover,
  carcassonne: CarcassonneCover,
  bohnanza: BohnanzaCover,
  'wonders-duel': WondersDuelCover,
  dominion: DominionCover,
  'star-realms': StarRealmsCover,
  'the-crew': TheCrewCover,
  'crew-deep-sea': CrewDeepSeaCover,
  'space-base': SpaceBaseCover
};

export function GameCover({ gameId, title }: { gameId: string; title: string }) {
  const Cover = COVERS[gameId];
  return Cover ? <Cover title={title} /> : <div style={{ inlineSize: '100%', blockSize: '100%', background: 'var(--surface-2)' }} aria-hidden />;
}
