import type { ComponentType } from 'react';
import LineThreeRenderer from '@bg/game-line-three/renderer';
import SealedBidsRenderer from '@bg/game-sealed-bids/renderer';
import UnoRenderer from '@bg/game-uno/renderer';
import ChessRenderer from '@bg/game-chess/renderer';
import SnakesRenderer from '@bg/game-snakes-ladders/renderer';
import LudoRenderer from '@bg/game-ludo/renderer';
import AmlakRenderer from '@bg/game-amlak/renderer';
import UnmatchedRenderer from '@bg/game-unmatched/renderer';
import CatanRenderer from '@bg/game-catan/renderer';
import RiskRenderer from '@bg/game-risk/renderer';
import TtrRenderer from '@bg/game-ticket-to-ride/renderer';
import BackgammonRenderer from '@bg/game-backgammon/renderer';
import CheckersRenderer from '@bg/game-checkers/renderer';
import OthelloRenderer from '@bg/game-othello/renderer';
import QuoridorRenderer from '@bg/game-quoridor/renderer';
import OnitamaRenderer from '@bg/game-onitama/renderer';
import GoRenderer from '@bg/game-go/renderer';
import SantoriniRenderer from '@bg/game-santorini/renderer';
import TakRenderer from '@bg/game-tak/renderer';
import AbaloneRenderer from '@bg/game-abalone/renderer';
import HiveRenderer from '@bg/game-hive/renderer';
import NoThanksRenderer from '@bg/game-no-thanks/renderer';
import SixNimmtRenderer from '@bg/game-six-nimmt/renderer';
import LoveLetterRenderer from '@bg/game-love-letter/renderer';
import SkullRenderer from '@bg/game-skull/renderer';
import CoupRenderer from '@bg/game-coup/renderer';
import ForSaleRenderer from '@bg/game-for-sale/renderer';
import HighSocietyRenderer from '@bg/game-high-society/renderer';
import SushiGoRenderer from '@bg/game-sushi-go/renderer';
import LostCitiesRenderer from '@bg/game-lost-cities/renderer';
import TheMindRenderer from '@bg/game-the-mind/renderer';
import SplendorRenderer from '@bg/game-splendor/renderer';
import AzulRenderer from '@bg/game-azul/renderer';
import JaipurRenderer from '@bg/game-jaipur/renderer';
import PatchworkRenderer from '@bg/game-patchwork/renderer';
import KingdominoRenderer from '@bg/game-kingdomino/renderer';
import PointSaladRenderer from '@bg/game-point-salad/renderer';
import CockroachPokerRenderer from '@bg/game-cockroach-poker/renderer';
import ScoutRenderer from '@bg/game-scout/renderer';
import CenturyRenderer from '@bg/game-century/renderer';
import SeaSaltPaperRenderer from '@bg/game-sea-salt-paper/renderer';
import HanabiRenderer from '@bg/game-hanabi/renderer';
import CamelUpRenderer from '@bg/game-camel-up/renderer';
import MachiKoroRenderer from '@bg/game-machi-koro/renderer';
import KingOfTokyoRenderer from '@bg/game-king-of-tokyo/renderer';
import CitadelsRenderer from '@bg/game-citadels/renderer';
import CarcassonneRenderer from '@bg/game-carcassonne/renderer';
import type { GameRendererProps } from '@bg/ui';

/**
 * Reviewed UI bundles keyed by the clientBundleRef pinned on each table. A table only renders with the bundle it
 * was started with; when a new rules version ships with a new bundle, add it here and keep the old key until no
 * active table uses it (docs/ADDING_A_GAME.md).
 */
export const RENDERERS: Record<string, ComponentType<GameRendererProps<never>>> = {
  'line-three@1.0.0': LineThreeRenderer as ComponentType<GameRendererProps<never>>,
  'sealed-bids@1.0.0': SealedBidsRenderer as ComponentType<GameRendererProps<never>>,
  'uno@1.0.0': UnoRenderer as ComponentType<GameRendererProps<never>>,
  'unmatched@1.0.0': UnmatchedRenderer as ComponentType<GameRendererProps<never>>,
  'catan@1.0.0': CatanRenderer as ComponentType<GameRendererProps<never>>,
  'risk@1.0.0': RiskRenderer as ComponentType<GameRendererProps<never>>,
  'ticket-to-ride@1.0.0': TtrRenderer as ComponentType<GameRendererProps<never>>,
  'chess@1.0.0': ChessRenderer as ComponentType<GameRendererProps<never>>,
  'snakes-ladders@1.0.0': SnakesRenderer as ComponentType<GameRendererProps<never>>,
  'ludo@1.0.0': LudoRenderer as ComponentType<GameRendererProps<never>>,
  'amlak@1.0.0': AmlakRenderer as ComponentType<GameRendererProps<never>>,
  'backgammon@1.0.0': BackgammonRenderer as ComponentType<GameRendererProps<never>>,
  'checkers@1.0.0': CheckersRenderer as ComponentType<GameRendererProps<never>>,
  'othello@1.0.0': OthelloRenderer as ComponentType<GameRendererProps<never>>,
  'quoridor@1.0.0': QuoridorRenderer as ComponentType<GameRendererProps<never>>,
  'onitama@1.0.0': OnitamaRenderer as ComponentType<GameRendererProps<never>>,
  'go@1.0.0': GoRenderer as ComponentType<GameRendererProps<never>>,
  'santorini@1.0.0': SantoriniRenderer as ComponentType<GameRendererProps<never>>,
  'tak@1.0.0': TakRenderer as ComponentType<GameRendererProps<never>>,
  'abalone@1.0.0': AbaloneRenderer as ComponentType<GameRendererProps<never>>,
  'hive@1.0.0': HiveRenderer as ComponentType<GameRendererProps<never>>,
  'no-thanks@1.0.0': NoThanksRenderer as ComponentType<GameRendererProps<never>>,
  'six-nimmt@1.0.0': SixNimmtRenderer as ComponentType<GameRendererProps<never>>,
  'love-letter@1.0.0': LoveLetterRenderer as ComponentType<GameRendererProps<never>>,
  'skull@1.0.0': SkullRenderer as ComponentType<GameRendererProps<never>>,
  'coup@1.0.0': CoupRenderer as ComponentType<GameRendererProps<never>>,
  'for-sale@1.0.0': ForSaleRenderer as ComponentType<GameRendererProps<never>>,
  'high-society@1.0.0': HighSocietyRenderer as ComponentType<GameRendererProps<never>>,
  'sushi-go@1.0.0': SushiGoRenderer as ComponentType<GameRendererProps<never>>,
  'lost-cities@1.0.0': LostCitiesRenderer as ComponentType<GameRendererProps<never>>,
  'the-mind@1.0.0': TheMindRenderer as ComponentType<GameRendererProps<never>>,
  'splendor@1.0.0': SplendorRenderer as ComponentType<GameRendererProps<never>>,
  'azul@1.0.0': AzulRenderer as ComponentType<GameRendererProps<never>>,
  'jaipur@1.0.0': JaipurRenderer as ComponentType<GameRendererProps<never>>,
  'patchwork@1.0.0': PatchworkRenderer as ComponentType<GameRendererProps<never>>,
  'kingdomino@1.0.0': KingdominoRenderer as ComponentType<GameRendererProps<never>>,
  'point-salad@1.0.0': PointSaladRenderer as ComponentType<GameRendererProps<never>>,
  'cockroach-poker@1.0.0': CockroachPokerRenderer as ComponentType<GameRendererProps<never>>,
  'scout@1.0.0': ScoutRenderer as ComponentType<GameRendererProps<never>>,
  'century@1.0.0': CenturyRenderer as ComponentType<GameRendererProps<never>>,
  'sea-salt-paper@1.0.0': SeaSaltPaperRenderer as ComponentType<GameRendererProps<never>>,
  'hanabi@1.0.0': HanabiRenderer as ComponentType<GameRendererProps<never>>,
  'camel-up@1.0.0': CamelUpRenderer as ComponentType<GameRendererProps<never>>,
  'machi-koro@1.0.0': MachiKoroRenderer as ComponentType<GameRendererProps<never>>,
  'king-of-tokyo@1.0.0': KingOfTokyoRenderer as ComponentType<GameRendererProps<never>>,
  'citadels@1.0.0': CitadelsRenderer as ComponentType<GameRendererProps<never>>,
  'carcassonne@1.0.0': CarcassonneRenderer as ComponentType<GameRendererProps<never>>
};
