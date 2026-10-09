// Painted in-game art (one GPT-Image sheet cut into cells + one Mars surface texture). Numbers, names and every
// rules-relevant shape stay in code; these images are decoration and icons only (each use carries a text label).
import tileGreenery from './art/tile-greenery.webp';
import tileOcean from './art/tile-ocean.webp';
import tileCity from './art/tile-city.webp';
import tileSpecial from './art/tile-special.webp';
import resMc from './art/res-mc.webp';
import resSteel from './art/res-steel.webp';
import resTitanium from './art/res-titanium.webp';
import resPlants from './art/res-plants.webp';
import resEnergy from './art/res-energy.webp';
import resHeat from './art/res-heat.webp';
import crMicrobe from './art/cr-microbe.webp';
import crAnimal from './art/cr-animal.webp';
import crScience from './art/cr-science.webp';
import crFighter from './art/cr-fighter.webp';
import gpTemperature from './art/gp-temperature.webp';
import gpOxygen from './art/gp-oxygen.webp';
import marsSurface from './art/mars-surface.webp';
import type { CardRes, Res, TileKind } from './api.ts';

export const TILE_ART: Record<TileKind, string> = { greenery: tileGreenery, ocean: tileOcean, city: tileCity, special: tileSpecial };
export const RES_ART: Record<Res, string> = { mc: resMc, steel: resSteel, titanium: resTitanium, plants: resPlants, energy: resEnergy, heat: resHeat };
export const CARDRES_ART: Record<CardRes, string> = { microbe: crMicrobe, animal: crAnimal, science: crScience, fighter: crFighter };
export const PARAM_ART = { temperature: gpTemperature, oxygen: gpOxygen, ocean: tileOcean } as const;
export const MARS_ART = marsSurface;
