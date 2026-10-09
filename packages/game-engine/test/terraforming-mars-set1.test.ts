import { describe, expect, it } from 'vitest';
import { MARS, legalSpaces, score, terraformingMarsModule, type TmState } from '@bg/game-terraforming-mars';
import { applyAction, projectFor, startGame, type EngineSnapshot } from '../src/index.ts';

const m = terraformingMarsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TmState;
const hints = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** Rejected without mutating the state. */
const refuse = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const before = JSON.stringify(st(snap));
  const e = reject(snap, seat, action);
  expect(JSON.stringify(st(snap))).toBe(before);
  return e;
};
function begin(players = 2, seed = 1) {
  let snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
  for (let k = 0; k < players; k++) snap = act(snap, k, { type: 'corp', corp: st(snap).players[k]!.corpOffer[0], cards: [] });
  return snap;
}
function clean(players = 2, mc = 100): EngineSnapshot {
  const snap = begin(players, 7);
  const s = st(snap);
  s.current = 0; s.firstPlayer = 0; s.actionsTaken = 0;
  for (const pl of s.players) {
    pl.corp = null; pl.firstActionDone = true; pl.hand = []; pl.played = []; pl.cardRes = {};
    pl.res = { mc, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0 };
    pl.prod = { mc: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0 };
  }
  return snap;
}
const firstSpace = (snap: EngineSnapshot, seat: number) => (hints(snap, seat).find((x) => x.type === 'respond')!.options as string[])[0]!;
const again = (snap: EngineSnapshot) => { Object.assign(st(snap), { current: 0, actionsTaken: 0 }); return snap; };
const me = (snap: EngineSnapshot, seat = 0) => st(snap).players[seat]!;
/** Clean state with `cards` in seat 0's hand. */
const withHand = (cards: string[], mc = 100, players = 2) => { const s = clean(players, mc); me(s).hand = cards; return s; };
const vp = (snap: EngineSnapshot, seat = 0) => score(st(snap), seat).cards;

describe('terraforming-mars set1: requirements, production and VP', () => {
  it('001 Colonizer Training Camp: oxygen max 5 %, 2 VP', () => {
    let snap = withHand(['001']);
    st(snap).oxygen = 6;
    expect(refuse(snap, 0, { type: 'play', card: '001' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 5;
    snap = act(snap, 0, { type: 'play', card: '001' });
    expect(me(snap).res.mc).toBe(92);
    expect(vp(snap)).toBe(2);
  });

  it('002 Asteroid Mining Consortium: needs titanium production; any titanium production −1, own +1; 1 VP', () => {
    let snap = withHand(['002']);
    expect(refuse(snap, 0, { type: 'play', card: '002' })).toBe('REQUIREMENTS_NOT_MET');
    me(snap).prod.titanium = 1; me(snap, 1).prod.titanium = 1;
    snap = act(snap, 0, { type: 'play', card: '002' });
    expect(me(snap).prod.titanium).toBe(2);
    expect(hints(snap, 0)[0]).toMatchObject({ type: 'respond', kind: 'player', options: [0, 1], optional: false });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(me(snap, 1).prod.titanium).toBe(0);
    expect(vp(snap)).toBe(1);
  });

  it('004 Cloud Seeding: 3 oceans; M€ prod −1, any heat prod −1, plant prod +2', () => {
    let snap = withHand(['004']);
    st(snap).oceans = 2; me(snap, 1).prod.heat = 1;
    expect(refuse(snap, 0, { type: 'play', card: '004' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oceans = 3; me(snap, 1).prod.heat = 0;
    expect(refuse(snap, 0, { type: 'play', card: '004' })).toBe('NO_TARGET');
    me(snap, 1).prod.heat = 1; me(snap).prod.mc = -5;
    expect(refuse(snap, 0, { type: 'play', card: '004' })).toBe('PRODUCTION_TOO_LOW');
    me(snap).prod.mc = 0;
    snap = act(snap, 0, { type: 'play', card: '004' });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(me(snap).prod).toMatchObject({ mc: -1, plants: 2 });
    expect(me(snap, 1).prod.heat).toBe(0);
  });

  it('016 Domed Crater: oxygen max 7 %, energy prod needed; city, 3 plants, prod; 1 VP', () => {
    let snap = withHand(['016']);
    me(snap).prod.energy = 1; st(snap).oxygen = 8;
    expect(refuse(snap, 0, { type: 'play', card: '016' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 7; me(snap).prod.energy = 0;
    expect(refuse(snap, 0, { type: 'play', card: '016' })).toBe('PRODUCTION_TOO_LOW');
    me(snap).prod.energy = 1;
    snap = act(snap, 0, { type: 'play', card: '016' });
    expect(st(snap).queue[0]).toMatchObject({ kind: 'space', tile: 'city', card: '016' });
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(st(snap).tiles['05']).toMatchObject({ kind: 'city', owner: 0 });
    expect(me(snap).res.plants).toBe(3);
    expect(me(snap).prod).toMatchObject({ energy: 0, mc: 3 });
    expect(vp(snap)).toBe(1);
  });

  it('017 Noctis City: only on the reserved Noctis area', () => {
    let snap = withHand(['017']);
    me(snap).prod.energy = 1;
    snap = act(snap, 0, { type: 'play', card: '017' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'space', options: ['31'] });
    snap = act(snap, 0, { type: 'respond', space: '31' });
    expect(st(snap).tiles['31']).toMatchObject({ kind: 'city', owner: 0 });
    expect(me(snap).prod).toMatchObject({ energy: 0, mc: 3 });
    snap = again(snap);
    me(snap).hand = ['017']; me(snap).prod.energy = 1;
    expect(refuse(snap, 0, { type: 'play', card: '017' })).toBe('NO_SPACE');
  });

  it('018 Methane From Titan: oxygen min 2 %; heat and plant prod +2; 2 VP', () => {
    let snap = withHand(['018']);
    st(snap).oxygen = 1;
    expect(refuse(snap, 0, { type: 'play', card: '018' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 2; me(snap).res.titanium = 2;
    snap = act(snap, 0, { type: 'play', card: '018' });
    expect(me(snap).res).toMatchObject({ titanium: 0, mc: 100 - 22 });
    expect(me(snap).prod).toMatchObject({ heat: 2, plants: 2 });
    expect(vp(snap)).toBe(2);
  });

  it('021 Phobos Space Haven: titanium prod, off-map city, 3 VP; not a city on Mars', () => {
    let snap = withHand(['021']);
    snap = act(snap, 0, { type: 'play', card: '021' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'space', options: ['02'] });
    snap = act(snap, 0, { type: 'respond', space: '02' });
    expect(st(snap).tiles['02']).toMatchObject({ kind: 'city', owner: 0, card: '021' });
    expect(me(snap).prod.titanium).toBe(1);
    expect(vp(snap)).toBe(3);
    expect(score(st(snap), 0).city).toBe(0);
  });

  it('022 Black Polar Dust: M€ prod −2, heat prod +3, an ocean', () => {
    let snap = withHand(['022']);
    me(snap).prod.mc = -4;
    expect(refuse(snap, 0, { type: 'play', card: '022' })).toBe('PRODUCTION_TOO_LOW');
    me(snap).prod.mc = 0;
    snap = act(snap, 0, { type: 'play', card: '022' });
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(me(snap).prod).toMatchObject({ mc: -2, heat: 3 });
    expect(st(snap).oceans).toBe(1);
    expect(me(snap).tr).toBe(21);
  });

  it('026 Eos Chasma National Park: temperature −12; animal to an own card, 3 plants, M€ prod +2; 1 VP', () => {
    let snap = withHand(['026']);
    st(snap).temperature = -14;
    expect(refuse(snap, 0, { type: 'play', card: '026' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).temperature = -12;
    snap = act(snap, 0, { type: 'play', card: '026' }); // no animal card: nothing to add
    expect(st(snap).queue).toHaveLength(0);
    expect(me(snap).res.plants).toBe(3);
    expect(me(snap).prod.mc).toBe(2);
    expect(vp(snap)).toBe(1);
    snap = withHand(['026']);
    st(snap).temperature = -12;
    me(snap).played = ['052', '024'];
    snap = act(snap, 0, { type: 'play', card: '026' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'card', options: ['052', '024'] });
    snap = act(snap, 0, { type: 'respond', card: '024' });
    expect(me(snap).cardRes['024']).toBe(1);
  });

  it('027 Interstellar Colony Ship: needs 5 science tags; 4 VP as an event', () => {
    let snap = withHand(['027']);
    me(snap).played = ['005', '006', '014', '033'];
    expect(refuse(snap, 0, { type: 'play', card: '027' })).toBe('REQUIREMENTS_NOT_MET');
    me(snap).played.push('034');
    snap = act(snap, 0, { type: 'play', card: '027' });
    expect(vp(snap)).toBe(4);
  });

  it('029 Cupola City, 032 Underground City, 030 Lunar Beam', () => {
    let snap = withHand(['029', '032', '030']);
    me(snap).prod.energy = 1; st(snap).oxygen = 10;
    expect(refuse(snap, 0, { type: 'play', card: '029' })).toBe('REQUIREMENTS_NOT_MET');
    expect(refuse(snap, 0, { type: 'play', card: '032' })).toBe('PRODUCTION_TOO_LOW');
    st(snap).oxygen = 9;
    snap = act(snap, 0, { type: 'play', card: '029' });
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(me(snap).prod).toMatchObject({ energy: 0, mc: 3 });
    me(snap).prod.energy = 2;
    snap = act(snap, 0, { type: 'play', card: '032' });
    snap = act(snap, 0, { type: 'respond', space: firstSpace(snap, 0) });
    expect(me(snap).prod).toMatchObject({ energy: 0, steel: 2 });
    expect(Object.values(st(snap).tiles).filter((t) => t.kind === 'city' && t.owner === 0)).toHaveLength(2);
    snap = again(snap);
    me(snap).prod.mc = -4;
    expect(refuse(snap, 0, { type: 'play', card: '030' })).toBe('PRODUCTION_TOO_LOW');
    me(snap).prod.mc = 3;
    snap = act(snap, 0, { type: 'play', card: '030' });
    expect(me(snap).prod).toMatchObject({ mc: 1, heat: 2, energy: 2 });
  });
});

describe('terraforming-mars set1: events', () => {
  it('010 Comet: temperature +1, an ocean, remove up to 3 plants', () => {
    let snap = withHand(['010']);
    me(snap, 1).res.plants = 5;
    snap = act(snap, 0, { type: 'play', card: '010' });
    expect(st(snap).temperature).toBe(-28);
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'player', options: [1], optional: true });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(me(snap, 1).res.plants).toBe(2);
    expect(me(snap).tr).toBe(22);
  });

  it('011 Big Asteroid: temperature +2, 4 titanium, remove up to 4 plants (skippable)', () => {
    let snap = withHand(['011']);
    me(snap, 1).res.plants = 3;
    snap = act(snap, 0, { type: 'play', card: '011' });
    expect(st(snap).temperature).toBe(-26);
    expect(me(snap).res.titanium).toBe(4);
    snap = act(snap, 0, { type: 'respond', skip: true });
    expect(me(snap, 1).res.plants).toBe(3);
    expect(me(snap).tr).toBe(22);
  });

  it('039 Deimos Down: temperature +3, 4 steel, remove up to 8 plants', () => {
    let snap = withHand(['039']);
    me(snap, 1).res.plants = 10;
    snap = act(snap, 0, { type: 'play', card: '039' });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).temperature).toBe(-24);
    expect(me(snap).prod.heat).toBe(1); // −24 bonus
    expect(me(snap).res.steel).toBe(4);
    expect(me(snap, 1).res.plants).toBe(2);
    expect(me(snap).tr).toBe(23);
  });

  it('036 Release of Inert Gases: TR +2', () => {
    let snap = withHand(['036']);
    snap = act(snap, 0, { type: 'play', card: '036' });
    expect(me(snap).tr).toBe(22);
    expect(me(snap).res.mc).toBe(86);
  });

  it('037 Nitrogen-Rich Asteroid: TR +2, temperature +1, plant prod +1 or +4 with 3 plant tags', () => {
    let snap = withHand(['037']);
    snap = act(snap, 0, { type: 'play', card: '037' });
    expect(me(snap).tr).toBe(23);
    expect(me(snap).prod.plants).toBe(1);
    snap = withHand(['037']);
    me(snap).played = ['023', '026', '023'];
    snap = act(snap, 0, { type: 'play', card: '037' });
    expect(me(snap).prod.plants).toBe(4);
  });

  it('019 Imported Hydrogen: 3 plants without targets; otherwise a choice; always an ocean', () => {
    let snap = withHand(['019']);
    snap = act(snap, 0, { type: 'play', card: '019' });
    expect(me(snap).res.plants).toBe(3);
    expect(st(snap).queue).toHaveLength(1);
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(st(snap).oceans).toBe(1);
    snap = withHand(['019']);
    me(snap).played = ['033', '052'];
    snap = act(snap, 0, { type: 'play', card: '019' });
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'choice', options: [0, 1, 2] });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', card: '033' });
    expect(me(snap).cardRes['033']).toBe(3);
    expect(me(snap).res.plants).toBe(0);
    snap = withHand(['019']);
    me(snap).played = ['052'];
    snap = act(snap, 0, { type: 'play', card: '019' });
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(st(snap).queue[0]).toMatchObject({ kind: 'choice', options: ['۳ گیاه', '۲ جانور به کارتی دیگر'] });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', card: '052' });
    expect(me(snap).cardRes['052']).toBe(2);
  });
});

describe('terraforming-mars set1: actions', () => {
  const inPlay = (cards: string[], mc = 100) => { const s = clean(2, mc); me(s).played = cards; return s; };

  it('005 Search For Life: oxygen max 6 %; 1 M€ reveals; microbe tag adds science; 3 VP with ≥1', () => {
    let snap = withHand(['005']);
    st(snap).oxygen = 7;
    expect(refuse(snap, 0, { type: 'play', card: '005' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 6;
    snap = act(snap, 0, { type: 'play', card: '005' });
    expect(vp(snap)).toBe(0);
    st(snap).deck = ['141', '035'];
    snap = act(snap, 0, { type: 'cardAction', card: '005' });
    expect(st(snap).revealed).toBe('141');
    expect(st(snap).discard).toContain('141');
    expect(me(snap).res.mc).toBe(100 - 3 - 1);
    expect(me(snap).cardRes['005'] ?? 0).toBe(0);
    snap = again(snap);
    expect(refuse(snap, 0, { type: 'cardAction', card: '005' })).toBe('ACTION_USED');
    me(snap).used = [];
    snap = act(snap, 0, { type: 'cardAction', card: '005' });
    expect(me(snap).cardRes['005']).toBe(1);
    expect(vp(snap)).toBe(3);
    me(snap).used = []; me(snap).res.mc = 0;
    expect(refuse(snap, 0, { type: 'cardAction', card: '005' })).toBe('CANNOT_AFFORD');
  });

  it("006 Inventors' Guild: look at the top card, buy it for 3 M€ or discard it", () => {
    let snap = inPlay(['006']);
    st(snap).deck = ['141', '003'];
    snap = act(snap, 0, { type: 'cardAction', card: '006' });
    expect(st(snap).queue[0]).toMatchObject({ kind: 'cards', cards: ['141'], min: 0, max: 1 });
    expect(JSON.stringify(projectFor(m, snap, p(1)).view)).not.toContain('"141"');
    snap = act(snap, 0, { type: 'respond', cards: ['141'] });
    expect(me(snap).hand).toEqual(['141']);
    expect(me(snap).res.mc).toBe(97);
    snap = inPlay(['006'], 2);
    st(snap).deck = ['141'];
    snap = act(snap, 0, { type: 'cardAction', card: '006' });
    expect(refuse(snap, 0, { type: 'respond', cards: ['141'] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'respond', cards: [] });
    expect(me(snap).hand).toEqual([]);
    expect(st(snap).discard).toContain('141');
    expect(me(snap).res.mc).toBe(2);
  });

  it('007 Martian Rails: 1 energy → 1 M€ per city on Mars', () => {
    let snap = inPlay(['007']);
    expect(refuse(snap, 0, { type: 'cardAction', card: '007' })).toBe('CANNOT_USE');
    me(snap).res.energy = 1;
    st(snap).tiles['05'] = { kind: 'city', owner: 1 };
    st(snap).tiles['20'] = { kind: 'city', owner: 0 };
    st(snap).tiles['02'] = { kind: 'city', owner: 0, card: '021' };
    snap = act(snap, 0, { type: 'cardAction', card: '007' });
    expect(me(snap).res).toMatchObject({ energy: 0, mc: 102 });
  });

  it('013 Space Elevator: titanium prod +1; 1 steel → 5 M€; 2 VP', () => {
    let snap = withHand(['013']);
    snap = act(snap, 0, { type: 'play', card: '013' });
    expect(me(snap).prod.titanium).toBe(1);
    expect(vp(snap)).toBe(2);
    expect(refuse(snap, 0, { type: 'cardAction', card: '013' })).toBe('CANNOT_USE');
    me(snap).res.steel = 1;
    snap = act(snap, 0, { type: 'cardAction', card: '013' });
    expect(me(snap).res).toMatchObject({ steel: 0, mc: 100 - 27 + 5 });
  });

  it('014 Development Center: 1 energy → draw 1', () => {
    let snap = inPlay(['014']);
    expect(refuse(snap, 0, { type: 'cardAction', card: '014' })).toBe('CANNOT_USE');
    me(snap).res.energy = 2;
    st(snap).deck = ['141'];
    snap = act(snap, 0, { type: 'cardAction', card: '014' });
    expect(me(snap).hand).toEqual(['141']);
    expect(me(snap).res.energy).toBe(1);
    expect(refuse(snap, 0, { type: 'cardAction', card: '014' })).toBe('ACTION_USED');
  });

  it('015 Equatorial Magnetizer: energy prod −1 → TR +1', () => {
    let snap = inPlay(['015']);
    expect(refuse(snap, 0, { type: 'cardAction', card: '015' })).toBe('CANNOT_USE');
    me(snap).prod.energy = 1;
    snap = act(snap, 0, { type: 'cardAction', card: '015' });
    expect(me(snap).prod.energy).toBe(0);
    expect(me(snap).tr).toBe(21);
  });

  it('024 Predators: oxygen 11 %; takes 1 animal from any other card; 1 VP per animal', () => {
    let snap = withHand(['024']);
    st(snap).oxygen = 10;
    expect(refuse(snap, 0, { type: 'play', card: '024' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 11;
    snap = act(snap, 0, { type: 'play', card: '024' });
    expect(refuse(snap, 0, { type: 'cardAction', card: '024' })).toBe('CANNOT_USE');
    me(snap, 1).played = ['052'];
    me(snap, 1).cardRes['052'] = 2;
    snap = act(snap, 0, { type: 'cardAction', card: '024' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'card', options: ['052'] });
    snap = act(snap, 0, { type: 'respond', card: '052' });
    expect(me(snap, 1).cardRes['052']).toBe(1);
    expect(me(snap).cardRes['024']).toBe(1);
    expect(vp(snap)).toBe(1);
    expect(vp(snap, 1)).toBe(1); // Fish: 1 animal
  });

  it('028 Security Fleet: 1 titanium → 1 fighter; 1 VP per fighter', () => {
    let snap = inPlay(['028']);
    expect(refuse(snap, 0, { type: 'cardAction', card: '028' })).toBe('CANNOT_USE');
    me(snap).res.titanium = 1;
    snap = act(snap, 0, { type: 'cardAction', card: '028' });
    expect(me(snap).res.titanium).toBe(0);
    expect(vp(snap)).toBe(1);
  });

  it('033 Regolith Eaters: add a microbe, or remove 2 to raise oxygen', () => {
    let snap = inPlay(['033']);
    snap = act(snap, 0, { type: 'cardAction', card: '033' });
    expect(me(snap).cardRes['033']).toBe(1);
    expect(st(snap).queue).toHaveLength(0);
    snap = again(snap);
    me(snap).used = []; me(snap).cardRes['033'] = 2;
    snap = act(snap, 0, { type: 'cardAction', card: '033' });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'choice', options: [0, 1] });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(me(snap).cardRes['033']).toBe(0);
    expect(st(snap).oxygen).toBe(1);
    expect(me(snap).tr).toBe(21);
  });

  it('034 GHG Producing Bacteria: oxygen 4 %; add a microbe, or remove 2 to raise temperature', () => {
    let snap = withHand(['034']);
    st(snap).oxygen = 3;
    expect(refuse(snap, 0, { type: 'play', card: '034' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 4;
    snap = act(snap, 0, { type: 'play', card: '034' });
    me(snap).cardRes['034'] = 3;
    snap = act(snap, 0, { type: 'cardAction', card: '034' });
    snap = act(snap, 0, { type: 'respond', index: 0 });
    expect(me(snap).cardRes['034']).toBe(4);
    snap = again(snap);
    me(snap).used = [];
    snap = act(snap, 0, { type: 'cardAction', card: '034' });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(me(snap).cardRes['034']).toBe(2);
    expect(st(snap).temperature).toBe(-28);
  });
});

describe('terraforming-mars set1: ongoing effects', () => {
  it('020 Research Outpost: isolated city; every card 1 M€ cheaper', () => {
    let snap = withHand(['020', '141']);
    snap = act(snap, 0, { type: 'play', card: '020' });
    expect(me(snap).res.mc).toBe(82);
    const opts = hints(snap, 0)[0]!.options as string[];
    expect(opts).toEqual(legalSpaces(st(snap), 0, 'isolatedCity'));
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(st(snap).tiles[opts[0]!]).toMatchObject({ kind: 'city', card: '020' });
    me(snap).res.steel = 0; // area bonus steel would pay part of the building card
    const mc = me(snap).res.mc;
    snap = act(snap, 0, { type: 'play', card: '141' });
    expect(me(snap).res.mc).toBe(mc - 3);
    snap = withHand(['020']);
    for (const sp of MARS) if (!sp.ocean && !st(snap).tiles[sp.id]) st(snap).tiles[sp.id] = { kind: 'greenery', owner: 1 };
    expect(refuse(snap, 0, { type: 'play', card: '020' })).toBe('NO_SPACE');
  });

  it('031 Optimal Aerobraking: own space events give 3 M€ and 3 heat', () => {
    let snap = withHand(['031', '036', '010']);
    snap = act(snap, 0, { type: 'play', card: '031' });
    snap = act(snap, 0, { type: 'play', card: '036' }); // no tag
    expect(me(snap).res.heat).toBe(0);
    snap = again(snap);
    snap = act(snap, 0, { type: 'play', card: '010' });
    expect(me(snap).res).toMatchObject({ heat: 3, mc: 100 - 7 - 14 - 21 + 3 });
    snap = act(snap, 0, { type: 'respond', space: '04' });
    me(snap, 1).hand = ['011'];
    snap = again(snap);
    Object.assign(st(snap), { current: 1 });
    snap = act(snap, 1, { type: 'play', card: '011' });
    expect(me(snap).res.heat).toBe(3);
  });

  it('038 Rover Construction: 2 M€ whenever any city is placed; 1 VP', () => {
    let snap = withHand(['038']);
    snap = act(snap, 0, { type: 'play', card: '038' });
    expect(vp(snap)).toBe(1);
    snap = act(snap, 0, { type: 'project', project: 'city' });
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(me(snap).res.mc).toBe(100 - 8 - 25 + 2);
    snap = act(snap, 1, { type: 'project', project: 'city' });
    snap = act(snap, 1, { type: 'respond', space: firstSpace(snap, 1) });
    expect(me(snap).res.mc).toBe(100 - 8 - 25 + 4);
    me(snap, 1).hand = ['021'];
    snap = act(snap, 1, { type: 'play', card: '021' });
    snap = act(snap, 1, { type: 'respond', space: '02' });
    expect(me(snap).res.mc).toBe(100 - 8 - 25 + 6);
  });
});
