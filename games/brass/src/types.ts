// Content data model for Brass: Birmingham. Every board location, link line, merchant tile, player-mat industry tile
// and draw-deck card is declared as plain data in src/content/<chunk>.ts; the engine (rules.ts) interprets it.
// See src/content/README.md for the authoring guide.

export const INDUSTRIES = ['cotton', 'manufacturer', 'pottery', 'coal', 'iron', 'brewery'] as const;
export type Industry = (typeof INDUSTRIES)[number];
/** Industries flipped by the Sell action (the others flip when their last cube/barrel is taken). */
export const GOODS: readonly Industry[] = ['cotton', 'manufacturer', 'pottery'];

/** What a merchant pays out when its beer barrel is consumed during a Sell action. */
export type MerchantBonus =
  | { kind: 'money'; amount: number } // Warrington: +£5
  | { kind: 'vp'; amount: number } // Nottingham / Shrewsbury: VP
  | { kind: 'income'; amount: number } // Oxford: income marker +2 spaces
  | { kind: 'develop' }; // Gloucester: remove 1 lowest tile of one industry from the mat (no iron)

export interface LocationDef {
  /** Stable id, lower-case kebab (e.g. 'stoke-on-trent', 'farm-cannock', 'oxford'). */
  id: string;
  nameFa: string;
  nameEn: string;
  /** town: has build slots and location cards. farm: unnamed farm brewery (1 brewery slot, no card). merchant: edge market. */
  kind: 'town' | 'farm' | 'merchant';
  /** Board position in a 0..100 × 0..100 frame, north up (renderer only, no rules meaning). */
  pos: readonly [number, number];
  /** Location-banner colour (renderer only; card counts below are what the rules use). */
  color?: 'blue' | 'teal' | 'yellow' | 'red' | 'purple';
  /** Build slots in printed order; each lists the industries that slot accepts (1 or 2 icons). */
  slots?: readonly (readonly Industry[])[];
  /** Copies of this town's Location card in the draw deck with [2, 3, 4] players. */
  cards?: readonly [number, number, number];
  /** Merchant data (kind 'merchant' only). */
  merchant?: {
    /** Number of merchant-tile spaces printed at this merchant. */
    spaces: number;
    /** Minimum player count for tiles (and beer) to be placed here. The location always exists for connections. */
    minPlayers: number;
    bonus: MerchantBonus;
    /** Link VP icons printed at this merchant (scored by links adjacent to it). */
    linkVp: number;
  };
}

export interface LinkDef {
  /** Two end locations. */
  a: string;
  b: string;
  /** Line can hold a canal link (Canal Era) / a rail link (Rail Era). */
  canal: boolean;
  rail: boolean;
  /** Extra locations this one link also connects (Kidderminster–Worcester also reaches the southern farm brewery). */
  also?: readonly string[];
}
/** Canonical link id: the two end ids sorted, joined by "~" (declaration order does not matter). */
export const linkId = (l: Pick<LinkDef, 'a' | 'b'>) => [l.a, l.b].sort().join('~');

export interface MerchantTileDef {
  id: string;
  /** Goods this merchant buys; empty = blank tile (buys nothing, gets no beer). */
  goods: readonly Industry[];
  /** Tile is used with at least this many players (printed on the tile). */
  minPlayers: 2 | 3 | 4;
}

export interface IndustryTileDef {
  industry: Industry;
  level: number;
  /** Tiles of this level on each player mat. */
  count: number;
  cost: number;
  /** Coal / iron consumed to build. */
  coal: number;
  iron: number;
  /** Beer needed to sell (goods only). */
  beer: number;
  /** Cubes placed on the tile when built (coal mine, iron works) or beer barrels (brewery: per era). */
  produce: number | { canal: number; rail: number };
  /** VP when flipped (scored at the end of each era). */
  vp: number;
  /** Income-track spaces gained when the tile flips. */
  income: number;
  /** Link VP icons the flipped tile gives each adjacent link. */
  linkVp: number;
  /** Era-restricted tile ('canal' = may be built only in the Canal Era; 'rail' = only in the Rail Era). */
  era?: 'canal' | 'rail';
  /** Lightbulb icon: may not be removed by Develop (only by building it). */
  noDevelop?: boolean;
}

export interface IndustryCardDef {
  id: string;
  /** Industries the card may build (the Cotton Mill / Manufacturer card shows both). */
  industries: readonly Industry[];
  /** Copies in the draw deck with [2, 3, 4] players. */
  copies: readonly [number, number, number];
}

/** One content chunk. Every field is optional; src/content/index.ts concatenates all chunks. */
export interface ContentChunk {
  locations?: readonly LocationDef[];
  links?: readonly LinkDef[];
  merchantTiles?: readonly MerchantTileDef[];
  tiles?: readonly IndustryTileDef[];
  industryCards?: readonly IndustryCardDef[];
}
