// World map geometry for the renderer and cover (no React, no rules). Every landmass is authored from approximate
// longitude/latitude of its coastline, projected (equirectangular, northern latitudes compressed, 1.5x vertical stretch
// so territories are big enough to tap) and smoothed with centripetal Catmull-Rom splines. Each landmass is split between
// its territories by a weighted Voronoi (power) diagram of hand-placed seeds, so borders follow the coastlines.
// Computed once at import; the map area is MAP_W x MAP_H (longitude -168..180, latitude 75..-56).
import { ADJ, CONTINENT_OF, T, type ContinentId, type TerritoryId } from './board.ts';

export type Pt = [number, number];
export const MAP_W = 1000, MAP_H = 566;

const LON0 = -168, LON_SPAN = 348, LAT_TOP = 75, KY = 4.3;
const eq = (lat: number) => (lat > 66 ? 66 + (lat - 66) * 0.5 : lat);
/** Longitude/latitude (degrees) to map units. */
export const project = (lon: number, lat: number): Pt => [((lon - LON0) * MAP_W) / LON_SPAN, (LAT_TOP - eq(lat)) * KY];
/** Flat [lon, lat, lon, lat, …] to projected points. */
const geo = (a: number[]): Pt[] => Array.from({ length: a.length / 2 }, (_, i) => project(a[2 * i]!, a[2 * i + 1]!));

interface Landmass {
  outline: Pt[];
  /** More pieces of the same single territory (island groups). */
  parts?: Pt[][];
  /** One or more power-diagram seeds per territory; several seeds make an L-shaped (non-convex) territory. */
  seeds: Partial<Record<TerritoryId, Seed | Seed[]>>;
}
type Seed = [number, number, number];
const seed = (lon: number, lat: number, w = 0): Seed => { const [x, y] = project(lon, lat); return [x, y, w]; };

export const LANDMASSES: Landmass[] = [
  { // The Americas: Alaska to Patagonia, joined by the isthmus
    outline: geo([
      -168, 65.6, -166, 68.3, -161, 70.6, -156.5, 71.3, -148, 70.3, -141, 69.7, -135, 69, -128, 70, -121, 69.3, -115, 68, -108, 68, -100, 67.8,
      -95, 71.6, -91, 69.2, -86, 70, -82, 69, -85, 66.5, -88, 64.2, -93, 61.3, -94.2, 58.7, -92, 57, -88, 56.5, -85, 55.2, -82.3, 53, -80, 51.5,
      -79, 53, -78.5, 56, -77, 58.5, -78, 60.8, -77.5, 62.4, -73, 62.2, -70, 61.5, -68, 58.7, -65.5, 60.3, -62, 57.5, -60.5, 55.3, -57, 52.5,
      -56, 51.5, -60, 50.2, -66, 50, -69.5, 48.5, -64.5, 48.9, -64.5, 46.5, -61.5, 45.8, -60.2, 46.3, -63.5, 44.5, -66, 43.7, -66, 45, -67.2, 44.8,
      -70.2, 43.7, -70, 41.9, -72.5, 41.2, -74, 40.4, -75.5, 38.2, -76, 37, -75.5, 35.2, -78, 33.8, -79.5, 32.5, -81, 31.2, -81.3, 29.8, -80.5, 28.3,
      -80, 25.8, -81, 25.1, -81.9, 26.4, -82.8, 27.8, -83.7, 29.9, -85, 29.7, -87.3, 30.3, -89, 30.2, -89.3, 29, -91, 29.4, -93.5, 29.7, -95, 29,
      -97.2, 27.6, -97.3, 25.8, -97.8, 22.5, -96.2, 19.4, -94.5, 18.2, -92, 18.6, -90.5, 20, -90.3, 21.2, -87, 21.5, -87.6, 19.4, -88.2, 17.4,
      -88.3, 15.8, -85.5, 15.9, -83.3, 15, -83.7, 12, -83.6, 10.6, -82.4, 9.4, -80, 9.5, -77.8, 8.8, -76.8, 8.4, -76.3, 9.4, -75.3, 10.7,
      -74.2, 11.1, -71.8, 12.4, -71.4, 10.9, -70.2, 11.9, -68.3, 10.5, -66.7, 10.6, -64.2, 10.4, -62, 10.6, -61, 8.8, -58, 6.4, -55, 5.8, -52, 4.6,
      -50.5, 1.8, -49.8, -0.5, -48, -1, -44.5, -2.5, -40.5, -2.8, -37, -4.8, -35.2, -5.5, -34.8, -7.2, -35.2, -9.5, -37.5, -12, -38.8, -14, -39, -17.5,
      -40.5, -20.5, -41.8, -22.8, -44.5, -23.4, -46.5, -24, -48.5, -26.3, -48.6, -28, -50.5, -30.5, -52.5, -33.2, -54.5, -34.7, -56.2, -34.9,
      -57.8, -34.4, -57.3, -36.2, -57.5, -38.2, -61, -38.8, -62.2, -40.6, -64.3, -41.2, -63.6, -42.6, -65.2, -44.5, -67.5, -46.2, -66, -48.2,
      -67.8, -50, -69, -51.7, -68.4, -52.5, -66, -54.5, -69.5, -55, -72.5, -53.6, -74.5, -51, -75.5, -47.8, -74, -44, -73.7, -40.5, -73.5, -37.2,
      -72, -33.5, -71.5, -30, -70.6, -25, -70.2, -19.6, -71.5, -17.3, -75.5, -14.6, -76.8, -12.4, -79, -8, -81.2, -5.8, -81.2, -4.2, -80, -2.7,
      -80.5, -0.7, -79.8, 1.5, -78.6, 2.5, -77.4, 4, -77.4, 6.5, -78.3, 8.1, -79.6, 8.9, -80.6, 7.4, -82.2, 8.1, -83.4, 8.5, -85.7, 10, -87.2, 12.8,
      -90, 13.8, -92.5, 14.6, -94.5, 16.2, -96, 15.7, -98, 16.2, -100, 16.8, -102, 17.9, -105.5, 19.9, -105.3, 21, -106.5, 23.2, -109, 25.5,
      -110.7, 27.9, -112.8, 30, -114.8, 31.8, -114.3, 30.2, -112.8, 28.2, -111.3, 26.2, -110.2, 24.2, -109.9, 22.9, -112, 24.5, -114.4, 27.5,
      -115.8, 30, -117.1, 32.5, -118.5, 34, -120.5, 34.5, -121.9, 36.6, -122.5, 37.8, -123.8, 39.5, -124.4, 40.4, -124, 43, -124, 46.2, -124.7, 48.4,
      -123.3, 48.6, -125, 50, -127.5, 51.3, -128.6, 52.7, -130, 54.5, -132, 56, -135, 58.5, -138, 59.2, -141, 60, -144, 60, -147, 60.8, -150, 59.5,
      -151.7, 59.2, -151.5, 60.8, -153.5, 59.8, -154.2, 58.5, -157, 57, -160, 55.8, -163, 54.8, -164.6, 54.7, -162.5, 55.8, -159.5, 56.9, -158.2, 58.6,
      -161.5, 58.7, -162.2, 60, -165, 61.4, -165.8, 62.6, -162.5, 63.6, -161, 64.4, -164.5, 64.6]),
    seeds: {
      alaska: seed(-151, 64, 0), northwestTerritory: seed(-113, 66, 0), alberta: seed(-117, 54, 0), ontario: seed(-88, 51, 0), quebec: seed(-69, 53, 0),
      westernUS: seed(-114, 40, 0), easternUS: seed(-86, 36, 0), centralAmerica: seed(-100, 19, 0),
      venezuela: seed(-68, 5, 0), peru: seed(-75, -9, 0), brazil: seed(-51, -10, 0), argentina: seed(-66, -35, 0)
    }
  },
  { // Greenland
    outline: geo([-34, 83.4, -22, 82, -18, 80, -19.5, 77, -19, 74.5, -22, 71, -25, 69, -30.5, 68, -35, 66.3, -38.5, 65, -41.5, 63.2, -43.5, 60.4, -46, 60.3,
      -48, 61.4, -50, 64, -52.3, 65, -53.5, 67, -53.5, 69, -55.5, 70.8, -56, 72.8, -58.5, 75.2, -66, 76.2, -72, 78, -68, 80, -60, 82, -50, 82.4, -41, 83.4]),
    seeds: { greenland: seed(-42, 74) }
  },
  { // Iceland
    outline: geo([-24, 65.5, -22, 64.1, -19, 63.4, -15.5, 64.2, -13.6, 65.2, -14.8, 66.3, -18, 66.2, -21, 65.9, -22.8, 66.4]),
    seeds: { iceland: seed(-19, 65) }
  },
  { // Great Britain and Ireland
    outline: geo([-5.5, 50, -3.5, 50.6, 0, 50.8, 1.4, 51.3, 1.7, 52.7, 0, 53.4, -0.2, 54.5, -1.5, 55.6, -2.6, 56, -2, 57.5, -3.5, 57.7, -5, 58.6, -6.3, 57.4,
      -5.7, 56, -4.8, 55.3, -3.2, 54.8, -3, 53.5, -4.6, 53.3, -5, 52, -3.5, 51.5, -5.2, 51.7]),
    parts: [geo([-10, 51.7, -6.3, 52.1, -6, 53.5, -5.8, 54.6, -7.5, 55.2, -9.8, 54.2, -10.2, 52.6])],
    seeds: { greatBritain: seed(-2.5, 53) }
  },
  { // Europe and Asia, to the Sinai
    outline: geo([
      -5.5, 36.3, -6.3, 36.6, -9, 37, -9.4, 38.7, -8.8, 41.2, -9.3, 43, -8, 43.7, -4, 43.4, -1.8, 43.4, -1.2, 45.5, -1.3, 46.5, -4.7, 48.4, -1.6, 48.7,
      -1.3, 49.7, 1.5, 50.2, 1.8, 51, 3.5, 51.5, 4.5, 52.7, 5, 53.3, 7, 53.6, 8.7, 54, 8.1, 55.5, 8.2, 56.8, 10.6, 57.7, 10.3, 56.4, 9.8, 55, 10.2, 54.4,
      12, 54.2, 13.5, 54.4, 16.5, 54.6, 18.8, 54.5, 20, 54.9, 21, 56, 21.5, 57.3, 23.5, 57.5, 24.2, 58.4, 23.5, 59.2, 26, 59.5, 30, 59.9, 25, 60.2,
      22.5, 60.1, 21.4, 61.5, 21.5, 63, 24, 65, 25.5, 65.6, 22, 65.5, 21, 64, 18.5, 62.8, 17.2, 61, 17.5, 60, 18.9, 59.5, 16.5, 57.7, 16.2, 56.3,
      14.2, 55.5, 12.8, 55.5, 12.5, 56.5, 11.8, 58, 10.7, 59.5, 8, 58.1, 6, 58.7, 5.2, 60.5, 5, 62, 7, 63.2, 10, 64, 12.5, 66, 14.5, 68, 17, 69.5,
      20, 70, 25, 71, 28, 71, 31, 70.2, 33, 69.5, 36, 69, 41, 67, 40.5, 66.2, 38, 66.1, 34.5, 65.5, 35, 64.5, 37.5, 64, 40, 64.8, 41.5, 66, 44, 66.5,
      44, 68.7, 46, 68, 50, 68, 54, 68.5, 60, 69, 66.5, 69.2, 67.5, 71, 70, 73, 73, 72, 72.5, 69, 74, 68.5, 77.5, 71, 80, 73, 87, 74.5, 86, 75.5,
      92, 76, 100, 77.7, 104, 77.7, 110, 76.5, 113, 74.5, 118, 73.5, 126, 73.5, 130, 71.2, 140, 72.5, 150, 71.5, 160, 69.7, 170, 70, 179, 68.8,
      180, 65.5, 178.5, 64.5, 177, 62.5, 174, 61.7, 170, 60, 164, 59.5, 163, 57.5, 162.5, 56, 161, 54, 158.5, 52.5, 156.7, 51, 156, 52.5, 156.5, 54.5,
      156, 57, 158, 58.5, 160, 60.5, 162, 61.5, 158, 61.5, 155, 59.5, 150, 59.5, 143, 59.3, 140, 58.5, 136, 54.5, 137, 54, 141, 53.5, 140.5, 51,
      140, 48, 135, 43.8, 132, 43, 130, 42.5, 129.5, 41, 128.5, 39.5, 127.5, 37.5, 129.4, 36, 129, 35, 126.5, 34.5, 126.5, 37, 125, 38, 124.5, 39.8,
      122, 39, 121.5, 40.7, 119, 39.2, 117.8, 39, 119, 37.5, 120.8, 37.8, 122.5, 37.4, 120.5, 36.2, 119.3, 35, 121, 32.5, 121.8, 31, 121.8, 30,
      121, 28.5, 119.5, 26, 118, 24.5, 116, 22.8, 114, 22.3, 111, 21.5, 110.2, 20.2, 108, 21.5, 106.5, 20.5, 105.8, 19, 106.5, 17.5, 108.5, 15.5,
      109.3, 13, 109.2, 11.5, 107, 10.4, 105, 8.6, 104.8, 10, 103, 11.5, 101, 12.6, 100.5, 13.5, 99.8, 12, 99.2, 10, 100.3, 8.5, 100.5, 7, 102.4, 6,
      103.4, 4.5, 103.5, 2.5, 104.2, 1.4, 103, 1.5, 101.5, 2.8, 100.4, 5, 100, 6.5, 98.5, 8, 98.3, 10, 98.7, 12.5, 97.7, 16.5, 96, 16.7, 94.5, 16,
      94.2, 18.5, 92.5, 20.5, 91.5, 22.5, 90, 22, 88.5, 21.8, 87, 21.5, 85, 19.8, 82.5, 17, 80.2, 15.5, 80.3, 13, 79.8, 10.5, 78, 8.5, 76.3, 9.5, 76, 10.5,
      74.8, 13, 73.8, 15.5, 72.8, 19, 72.7, 21.2, 70.5, 20.8, 69, 22.3, 70, 23, 68.5, 23.5, 67, 24.8, 64, 25.3, 61.5, 25.1, 58, 25.6, 56.5, 27,
      54, 26.6, 51, 28, 49.5, 30, 48.3, 30, 48, 29.5, 50, 26.5, 51.5, 25.5, 52.5, 24.2, 56, 26, 56.3, 26.4, 56.7, 24.5, 58.5, 23.6, 59.8, 22.5, 58, 20.5,
      55.5, 17.5, 52, 16, 49, 14.4, 45, 12.8, 43.3, 12.8, 42.7, 15, 42.5, 17, 41, 19.5, 39.2, 21.5, 38, 24, 35.5, 27.5, 35, 28.8, 34.3, 27.7, 33.6, 28.6,
      32.9, 29.9, 33.2, 31.1, 34.3, 31.4, 34.9, 32.6, 35.5, 33.9, 35.9, 35.5, 36.2, 36.7, 34.6, 36.7, 30.7, 36.8, 28, 36.7, 27.4, 37, 26.8, 38.4,
      26.2, 40, 26.6, 40.8, 24, 40.8, 23, 40.6, 23.5, 38, 23.8, 37.9, 23, 36.4, 21.7, 36.8, 21.2, 38, 20.7, 39.5, 19.5, 41.5, 18.5, 42.5, 16, 43.5,
      14, 45, 13.7, 45.7, 12.4, 45.3, 12.4, 44.2, 13.5, 43.6, 16, 41.9, 18.5, 40.1, 17, 40.3, 16.5, 39, 15.7, 38, 16, 39, 15.5, 40, 14.2, 40.8,
      12.5, 41.5, 11, 42.5, 10.3, 43.5, 8.9, 44.4, 7.5, 43.8, 6, 43.1, 5, 43.3, 3.5, 43.2, 3.2, 42, 2, 41.3, 0.7, 40.8, -0.3, 39.4, 0.2, 38.7, -0.7, 37.6,
      -1.2, 37.5, -2.5, 36.7, -4.4, 36.7, -5.2, 36.2]),
    seeds: {
      scandinavia: seed(18, 63, 0), northernEurope: seed(13, 51, 0), westernEurope: seed(-2, 44, 0), southernEurope: seed(17, 42.5, 0), ukraine: seed(39, 53, 0),
      ural: [seed(66, 60, 0), seed(72, 48, 0)], siberia: [seed(96, 66, 0), seed(88, 51, 0)], yakutsk: seed(130, 66, 0), kamchatka: [seed(165, 62, 0), seed(138, 55, 0)], irkutsk: seed(112, 55, 0),
      mongolia: seed(116, 45, 0), afghanistan: seed(62, 38, 0), china: [seed(105, 32, 0), seed(84, 37, 0)], middleEast: seed(43, 28, 0), india: seed(78, 22, 0), siam: seed(100, 17, 0)
    }
  },
  { // Japan: Honshu, Hokkaido, Kyushu, Shikoku
    outline: geo([130.9, 34, 133, 35.5, 135.5, 35.7, 136.8, 37.2, 138.5, 37.5, 139.8, 39.5, 140, 41.4, 141.5, 41.3, 141.9, 39.5, 140.9, 36.7, 140.2, 35.3,
      139.2, 34.9, 137.2, 34.6, 135.8, 33.5, 134.8, 34.3, 133, 34.3]),
    parts: [
      geo([140.1, 41.8, 140.1, 43.2, 141.5, 45.3, 143.5, 44.1, 145.5, 43.3, 143.4, 42, 141, 42.3]),
      geo([129.8, 33.2, 131, 33.9, 132, 33.2, 131.3, 31.4, 130.2, 31.2]),
      geo([132.5, 33.6, 134.4, 34.1, 134.6, 33.3, 133, 32.8])
    ],
    seeds: { japan: seed(137, 36) }
  },
  { // Africa
    outline: geo([
      -5.9, 35.8, -2.5, 35.2, 0, 35.9, 3, 36.8, 8, 37, 10.3, 37.2, 11, 36.8, 10.5, 35.3, 10, 33.9, 11.5, 33.1, 13, 32.9, 15.2, 32.4, 17.5, 30.7, 19.5, 30.3,
      20.1, 32.1, 22.5, 32.9, 24, 32, 25.2, 31.6, 27.5, 31.1, 29.9, 31.2, 31, 31.6, 31.6, 31, 31.6, 30, 32.5, 29.5, 33.4, 27.8, 34.5, 26, 35.5, 24, 36.8, 22,
      37.2, 20, 38.5, 18, 39.5, 15.6, 41, 14, 42.7, 12.6, 43.2, 11.6, 44, 10.6, 47, 11.2, 49, 11.3, 51.2, 11.8, 50.9, 10.2, 49.8, 8, 48, 5, 45.5, 2, 42, -1, 40, -3,
      39.3, -6.8, 40.5, -10.5, 40.5, -15, 37, -17.9, 34.8, -19.8, 35.5, -23.5, 32.9, -26, 30.5, -30, 27.9, -33, 25.6, -34, 20, -34.8, 18.4, -34, 17.5, -30.5,
      15.5, -27, 14.5, -22.9, 12, -18, 13.4, -12, 13.2, -8.8, 12.3, -6, 11.8, -4, 9.3, -1, 9.5, 1.5, 9.7, 3.8, 6, 4.3, 3.4, 6.4, 0, 5.6, -2, 4.8, -5, 5.2, -8, 4.5,
      -10.5, 6.2, -13, 8, -14.5, 10.5, -16.8, 13.5, -17.5, 14.7, -16.6, 16.5, -16.3, 19.5, -17, 21, -15, 24.5, -13, 27.5, -10, 29.5, -9.7, 30.5, -8.5, 33,
      -6.5, 34.2]),
    seeds: { northAfrica: seed(8, 24, 0), egypt: seed(28, 26, 0), eastAfrica: seed(38, 5, 0), congo: seed(18, -2, 0), southAfrica: seed(26, -23, 0) }
  },
  { // Madagascar
    outline: geo([49.3, -12.2, 50.4, -15.4, 49.5, -18, 47.7, -22.5, 45.2, -25.4, 43.8, -23, 44.3, -19.5, 44.2, -16.5, 46.5, -15.5, 47.5, -14, 48.2, -13.5]),
    seeds: { madagascar: seed(47, -19) }
  },
  { // Indonesia: Sumatra, Java, Borneo, Sulawesi
    outline: geo([109, 1.5, 111.5, 2.2, 113, 3.2, 115.5, 5, 117.5, 7, 119, 5.3, 118, 4.2, 117.5, 1, 116.5, -1.5, 116, -3.8, 114.5, -3.6, 111.8, -3.2, 110.2, -2.9,
      109, -1]),
    parts: [
      geo([95.3, 5.6, 97.7, 5, 100, 2.5, 102, 1, 104, -1.5, 106, -3, 106, -5.8, 104, -5.8, 102.3, -4, 100, -1.5, 98.5, 1, 96, 3.5]),
      geo([105.2, -6.8, 108, -6.3, 111, -6.5, 114.4, -7.7, 114.4, -8.7, 111, -8.2, 108, -7.8, 105.5, -7]),
      geo([119.4, -5.4, 119.6, -3, 118.9, -1, 119.8, 0.6, 122, 1, 125, 1.5, 123, 0.3, 121.4, 0.4, 120.6, -1, 121.5, -1.8, 123.2, -1.2, 122.4, -3.3, 122.9, -4.6,
        121.5, -4.2, 120.4, -5.5])
    ],
    seeds: { indonesia: seed(113, 0) }
  },
  { // New Guinea
    outline: geo([131, -0.8, 133.5, -0.7, 134.2, -3.2, 135.9, -3.9, 138.1, -1.7, 141, -2.6, 144.5, -3.8, 147.5, -6, 150.3, -10.4, 147.6, -9.7, 145.3, -7.8, 143.6, -8.3,
      142, -9.1, 139.8, -8.1, 138, -8.4, 137.8, -5.2, 135, -4.5, 132.4, -3.2, 131.2, -1.5]),
    seeds: { newGuinea: seed(141, -5) }
  },
  { // Australia
    outline: geo([113.5, -22, 113.4, -26, 115, -30, 115, -34.2, 118, -35, 122, -34, 124, -33.5, 129, -31.5, 132, -32, 134, -33, 135.8, -34.8, 137.5, -33.5,
      137.8, -35.5, 139.5, -36.5, 140.5, -38, 144, -38.3, 146.5, -39, 148, -37.8, 150, -37, 150.3, -35.5, 151.3, -33.8, 153, -31, 153.5, -28, 153, -26,
      150.5, -22.5, 148.8, -20.5, 146.5, -19, 145.5, -15, 143.5, -14, 142.5, -10.7, 141.5, -13, 141.5, -16, 139, -17.5, 136, -15, 135.5, -12.3, 132.5, -11.5,
      130.8, -12.4, 129.5, -15, 127, -14, 125, -15.5, 122.5, -17.5, 121, -19.5, 116, -20.7, 114, -22]),
    seeds: { westernAustralia: seed(122, -26), easternAustralia: seed(143, -25) }
  }
];

/** Inland water drawn over the land (Black Sea, Caspian, Great Lakes, Baikal, Lake Victoria). */
export const LAKES: Pt[][] = [
  geo([28, 41.3, 27.5, 42.5, 28, 43.5, 28.9, 44.2, 29.7, 45.2, 30.7, 46.4, 32, 46.2, 33.3, 45.2, 33.6, 44.5, 35, 44.8, 36.5, 45.3, 37.5, 44.7, 39.5, 43.4, 41.6, 41.7,
    39.7, 41, 36.3, 41.3, 35.1, 42, 31.5, 41.1, 29.2, 41.2]),
  geo([47.3, 44.5, 47, 46.4, 49, 46.8, 51, 46.4, 53, 45.8, 51.2, 44.5, 50.2, 44.4, 51, 43, 53, 42, 53, 40, 53.8, 37.5, 51, 36.8, 49, 37.5, 49.2, 38.5, 49.9, 40.4,
    48.3, 42, 47.5, 43]),
  geo([103.8, 51.5, 105.5, 51.7, 108, 52.5, 109.8, 53.8, 109.8, 55.5, 108.5, 54.5, 106.5, 53.3, 104.5, 52]),
  geo([32.2, -2.7, 33.8, -2.6, 34.4, -0.6, 33.5, 0.2, 32.2, -0.4, 31.8, -1.6]),
  geo([-92.1, 46.8, -90.5, 46.6, -88, 46.9, -85, 46.7, -84.7, 47.8, -86.5, 48.7, -88.5, 48.4, -90.8, 47.6]),
  geo([-87.5, 41.7, -86.4, 42.1, -86.2, 43.6, -85.5, 45, -85, 45.8, -86.5, 46, -87.5, 45.5, -87.8, 44.5, -87.8, 43, -87.8, 42]),
  geo([-84.5, 45.8, -82.5, 45.3, -81.7, 44.5, -81.6, 43.3, -82.4, 43, -83.5, 44, -83.8, 45.3, -83.5, 46.2, -81.5, 46.1, -80.2, 45.5, -80.1, 44.8, -81.3, 44.7]),
  geo([-83.4, 41.7, -82.5, 41.4, -81, 41.5, -79, 42.8, -80.5, 42.7, -82.5, 42.1, -83.2, 42.1]),
  geo([-79.8, 43.4, -77.5, 43.3, -76.2, 43.5, -76.4, 44.2, -78.5, 43.9])
];

/** Islands drawn for geography only (no territory): tinted like the continent they belong to. */
export const DECOR: { c: ContinentId; pts: Pt[] }[] = ([
  ['na', [-84.9, 21.9, -82.5, 23, -80, 23, -77.5, 21.8, -74.2, 20.2, -77.5, 19.9, -79.5, 21.5, -82, 22.2]],
  ['na', [-74.4, 19.7, -72.5, 19.9, -69.9, 19.7, -68.4, 18.6, -70.5, 18.2, -72.5, 18.2, -74.4, 18.4]],
  ['na', [-80, 73.7, -74, 72.8, -68, 70.5, -62, 67, -62.5, 66, -66, 62.8, -70, 63.5, -73.5, 64.5, -77, 65.3, -74.5, 67.5, -78, 69.2, -82, 70.5]],
  ['na', [-118, 71.5, -110, 73, -104, 73, -101, 70, -107, 68.8, -114, 69, -118, 70]],
  ['na', [-59.3, 47.6, -56, 46.8, -52.7, 47.5, -53.5, 49.5, -55.5, 51.6, -57.5, 50.5, -59, 48.5]],
  ['eu', [11, 78.5, 16, 80, 22, 79.5, 27, 79, 20, 77.5, 16, 76.8]],
  ['as', [51.5, 71.5, 54, 73.5, 58, 75, 63, 76.5, 68, 77, 66, 75, 60, 73.5, 56, 71.5, 54, 70.6]],
  ['as', [142.7, 54.3, 143.2, 52.5, 143, 50.5, 142.5, 49, 143.5, 46.5, 142, 46, 141.7, 48, 141.9, 50, 142.1, 52.5]],
  ['as', [121.5, 25.2, 122, 24.5, 121, 22, 120.2, 23]],
  ['as', [108.6, 19.2, 110.5, 20, 111, 19.5, 109.5, 18.2]],
  ['as', [79.8, 9.7, 81.8, 7.5, 81.2, 6, 80, 6, 79.8, 8]],
  ['as', [120.4, 18.5, 122.3, 18.4, 121.6, 16, 124, 13, 122, 13.2, 120.7, 14.2, 120, 16.2]],
  ['as', [122, 8, 124, 9.1, 126.4, 9.5, 126, 6.5, 125, 5.8, 123, 7]],
  ['au', [144.7, -40.7, 148.3, -40.9, 148, -43, 146, -43.6, 145.2, -42]],
  ['au', [172.7, -34.5, 175.5, -37, 177.9, -37.7, 178, -39.2, 176.2, -41.4, 174.8, -41.2, 174.6, -39.5, 173.8, -38, 174.5, -36.5]],
  ['au', [172.6, -40.6, 174.2, -41.3, 173.5, -43, 171.2, -44.5, 170.5, -46, 168.5, -46.6, 166.8, -45.7, 168.3, -44, 171.2, -42.3]]
] as [ContinentId, number[]][]).map(([c, a]) => ({ c, pts: geo(a) }));

/** Closed centripetal Catmull-Rom spline through the outline, sampled as a polygon (no loops on uneven spacing). */
export function smooth(pts: Pt[], steps = 5): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const knot = (a: Pt, b: Pt) => Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5, 1e-4);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let k = 0; k < steps; k++) {
      const u = t1 + ((t2 - t1) * k) / steps;
      const mix = (a: Pt, b: Pt, ta: number, tb: number): Pt => [(a[0] * (tb - u) + b[0] * (u - ta)) / (tb - ta), (a[1] * (tb - u) + b[1] * (u - ta)) / (tb - ta)];
      const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
      out.push(mix(mix(a1, a2, t0, t2), mix(a2, a3, t1, t3), t1, t2));
    }
  }
  return out;
}

/** Sutherland–Hodgman clip against the half-plane a·x + b·y <= c. */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const inside = (p: Pt) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    const pi = inside(p), qi = inside(q);
    if (pi) out.push(p);
    if (pi !== qi) {
      const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function centroid(poly: Pt[]): Pt {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    const k = p[0] * q[1] - q[0] * p[1];
    a += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k;
  }
  return a === 0 ? poly[0]! : [x / (3 * a), y / (3 * a)];
}

export const pathOf = (poly: Pt[]) => `M${poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;

const distToSeg = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const inside = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Interior point farthest from the border (grid search): where the army token sits. */
function labelPoint(poly: Pt[]): [Pt, number] {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  let best: Pt = centroid(poly), bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
      if (!inside([x, y], poly)) continue;
      let d = Infinity;
      for (let i = 0; i < poly.length && d > bestD; i++) d = Math.min(d, distToSeg([x, y], poly[i]!, poly[(i + 1) % poly.length]!));
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
  }
  return [best, bestD];
}

/** `poly` is every cell plus every extra piece (nearest-point sea lanes); `d` fills the territory; `edge` strokes its outline
 * without the zero-width bridges the clipping leaves across bays and straits and without cuts between its own cells. */
export interface Region { id: TerritoryId; poly: Pt[]; d: string; edge: string; center: Pt; land: number }

/** Region per territory (index-aligned with TERRITORY_IDS), plus which adjacent pairs share a drawn land border. */
const built = (() => {
  const regions: Region[] = [];
  const touching = new Map<string, number>();
  const continentLines: string[] = [];
  const fmt = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  LANDMASSES.forEach((lm, land) => {
    const shape = smooth(lm.outline);
    const extra = (lm.parts ?? []).map((p) => smooth(p, 4));
    const seeds = Object.entries(lm.seeds).flatMap(([id, v]) => (Array.isArray(v[0]) ? (v as Seed[]) : [v as Seed]).map((sd) => ({ id: id as TerritoryId, sd })));
    // Power-diagram bisector of s and o: |p-s|² - w <= |p-o|² - ow  ⇔  a·x + b·y <= c
    const bisector = ([x, y, w]: Seed, [ox, oy, ow]: Seed) => [2 * (ox - x), 2 * (oy - y), ox * ox + oy * oy - x * x - y * y + w - ow] as const;
    const acc = new Map<TerritoryId, { cells: Pt[][]; edges: string[]; centers: [Pt, number][] }>();
    for (const me of seeds) {
      let cell = shape;
      for (const o of seeds) if (o !== me) cell = clip(cell, ...bisector(me.sd, o.sd));
      const rec = acc.get(me.id) ?? { cells: [], edges: [], centers: [] };
      acc.set(me.id, rec);
      rec.cells.push(cell);
      rec.centers.push(labelPoint(cell));
      cell.forEach((p, i) => {
        const q = cell[(i + 1) % cell.length]!;
        let cut = false, partner: TerritoryId | null = null;
        for (const o of seeds) {
          if (o === me) continue;
          const [a, b, c] = bisector(me.sd, o.sd), n = Math.hypot(a, b);
          if (Math.abs(a * p[0] + b * p[1] - c) / n < 0.01 && Math.abs(a * q[0] + b * q[1] - c) / n < 0.01) {
            if (o.id === me.id) { cut = true; break; }
            partner = o.id; break;
          }
        }
        if (cut) return;
        if (partner) {
          // A border only where the edge runs over land: otherwise it is a bridge across water.
          if (!inside([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], shape)) return;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]), k = [T[me.id], T[partner]].sort((x, y) => x - y).join('-');
          touching.set(k, (touching.get(k) ?? 0) + len);
          if (CONTINENT_OF[T[me.id]] !== CONTINENT_OF[T[partner]] && T[me.id] < T[partner]) continentLines.push(`M${fmt(p)}L${fmt(q)}`);
        }
        rec.edges.push(`M${fmt(p)}L${fmt(q)}`);
      });
    }
    for (const [id, rec] of acc) {
      const parts = [...rec.cells, ...extra];
      const best = rec.centers.reduce((a, b) => (b[1] > a[1] ? b : a));
      regions[T[id]] = { id, poly: parts.flat(), d: parts.map(pathOf).join(''), edge: rec.edges.join('') + extra.map(pathOf).join(''), center: best[0], land };
    }
  });
  return { regions, touching, continentLines: continentLines.join('') };
})();
export const REGIONS: Region[] = built.regions;
/** True when two territories share a drawn land border. */
export const touches = (a: number, b: number) => (built.touching.get([a, b].sort((x, y) => x - y).join('-')) ?? 0) > 2;
/** Path of every border between two continents (drawn heavier than territory borders). */
export const CONTINENT_LINES: string = built.continentLines;

/** Coastline path per landmass (drawn under the regions). */
export const COASTS: string[] = LANDMASSES.map((lm) => [smooth(lm.outline), ...(lm.parts ?? []).map((p) => smooth(p, 4))].map(pathOf).join(''));
export const LAKE_PATHS: string[] = LAKES.map((l) => pathOf(smooth(l, 4)));
export const DECOR_PATHS = DECOR.map((d) => ({ c: d.c, d: pathOf(smooth(d.pts, 4)) }));

export const WRAP_LANE: [number, number] = [T.alaska, T.kamchatka];
/** Adjacent pairs without a shared land border, drawn as dashed sea lanes between the nearest coast points. */
export const SEA_LANES: { a: number; b: number; p: Pt; q: Pt }[] = ADJ.flatMap((ns, a) => ns
  .filter((b) => b > a && !touches(a, b) && !(a === WRAP_LANE[0] && b === WRAP_LANE[1]))
  .map((b) => {
    let p: Pt = REGIONS[a]!.center, q: Pt = REGIONS[b]!.center, d = Infinity;
    for (const x of REGIONS[a]!.poly) for (const y of REGIONS[b]!.poly) {
      const k = Math.hypot(x[0] - y[0], x[1] - y[1]);
      if (k < d) { d = k; p = x; q = y; }
    }
    return { a, b, p, q };
  }));

/** Where each continent's name and bonus banner sits (in the ocean next to it). */
export const CONTINENT_LABEL: Record<ContinentId, Pt> = {
  na: project(-146, 24), sa: project(-98, -28), eu: project(-30, 52), af: project(75, -17), as: project(158, 24), au: project(100, -46)
};
