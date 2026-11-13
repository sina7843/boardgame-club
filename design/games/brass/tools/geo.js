// Measured geometry of the night board (boards/board-night.png, 4000x4000) in a 0..1000 frame, and of the night player
// mat. Slots: tools/find-slots2.py (dark interiors, then matched to content/ slot order by their printed icons).
// Track, markets, merchants, links: grid crops (tools/strip.py) read by eye, checked with tools/overlay.py.
const SLOT = 46.25; // slot frame side (units)
const SLOTS = {
  leek: [[530.2, 73.2], [577.2, 73.2]],
  'stoke-on-trent': [[413.1, 99.5], [389.2, 145.8], [436.5, 145.8]],
  belper: [[706.6, 87.8], [753.5, 87.8], [800.0, 87.8]],
  derby: [[762.0, 210.4], [738.8, 257.4], [785.2, 257.2]],
  uttoxeter: [[542.6, 234.2], [590.0, 234.2]],
  stone: [[285.1, 251.5], [331.4, 251.5]],
  stafford: [[378.4, 345.4], [425.0, 345.4]],
  'burton-on-trent': [[660.8, 374.5], [707.4, 374.4]],
  'farm-cannock': [[299.0, 435.2]],
  cannock: [[452.2, 447.5], [498.5, 447.5]],
  tamworth: [[676.0, 499.8], [721.2, 499.8]],
  coalbrookdale: [[232.8, 536.8], [209.4, 583.8], [255.9, 583.4]],
  wolverhampton: [[347.4, 539.8], [393.5, 539.8]],
  walsall: [[508.6, 562.9], [555.0, 562.8]],
  nuneaton: [[765.9, 600.8], [812.8, 600.6]],
  dudley: [[393.8, 662.5], [440.0, 662.2]],
  birmingham: [[606.5, 654.0], [653.0, 654.0], [606.5, 701.2], [653.0, 701.2]],
  coventry: [[812.0, 685.8], [788.8, 732.5], [835.5, 732.5]],
  kidderminster: [[324.0, 765.8], [370.2, 765.9]],
  redditch: [[559.6, 819.5], [606.6, 819.5]],
  'farm-worcester': [[259.9, 840.6]],
  worcester: [[337.0, 895.6], [383.8, 895.6]]
};
// merchant tile spaces, beer barrel spots, bonus plaque
const MERCHANTS = {
  warrington: { spaces: [[255, 127], [304, 127]], beer: [[245, 162.5], [311, 162.5]], bonus: [285, 170] },
  nottingham: { spaces: [[880.6, 191], [928, 191]], beer: [[873, 226.6], [937, 226.6]], bonus: [905, 228] },
  shrewsbury: { spaces: [[88, 570]], beer: [[125, 557.5]], bonus: [159, 559] },
  oxford: { spaces: [[803.5, 853.5], [850.3, 853]], beer: [[793.3, 813.3], [858.3, 813.3]], bonus: [826, 807] },
  gloucester: { spaces: [[581.4, 927.8], [628, 928]], beer: [[570, 890], [638, 890]], bonus: [603, 888] }
};
const MERCHANT_W = 47; // tile frame width (units)
// markets: price rows y (price 1..8), two columns each; cubes fill the most expensive spaces first
const ROW_Y = (p) => 516.7 - (p - 1) * 29.45;
const COAL_X = [843.3, 866.7], IRON_X = [900, 920.7];
const CUBE = 15; // cube side on the board (units)
// progress track 0..99 (VP and income markers share it)
const TRACK = {
  0: [15, 928], 1: [15, 887.7], 2: [15, 851], 3: [15, 816.5], 4: [15, 784], 5: [15, 745], 6: [15, 711], 7: [15, 676], 8: [15, 641.5], 9: [15, 605], 10: [15, 568.5], 11: [15, 528], 12: [15, 495.5],
  13: [15, 440], 14: [15, 411], 15: [15, 371], 16: [15, 344], 17: [15, 308], 18: [15, 276], 19: [15, 236.5], 20: [15, 206], 21: [15, 169], 22: [15, 140], 23: [15, 102], 24: [15, 75],
  25: [65.4, 15.4], 26: [94.2, 15.4], 27: [134.6, 15.4], 28: [163.5, 15.4], 29: [207.7, 15.4], 30: [236.5, 15.4], 31: [290.4, 15.4], 32: [319.2, 15.4], 33: [347.3, 15.4], 34: [405, 15.4], 35: [434.6, 15.4], 36: [463.5, 15.4],
  37: [520.4, 15.4], 38: [551.2, 15.4], 39: [579.2, 15.4], 40: [636.9, 15.4], 41: [666.5, 15.4], 42: [695.4, 15.4], 43: [755.8, 15.4], 44: [785, 15.4], 45: [813.8, 15.4], 46: [872.3, 15.4], 47: [901.9, 15.4], 48: [930.8, 15.4],
  49: [984, 80.8], 50: [984, 108.5], 51: [984, 134.6], 52: [984, 199], 53: [984, 225], 54: [984, 252], 55: [984, 314.6], 56: [984, 340], 57: [984, 367], 58: [984, 425], 59: [984, 451], 60: [984, 486],
  61: [984, 549], 62: [984, 575], 63: [984, 603], 64: [984, 632], 65: [984, 686], 66: [984, 713], 67: [984, 743], 68: [984, 774], 69: [984, 828], 70: [984, 855], 71: [984, 884], 72: [984, 914],
  73: [930, 984], 74: [901, 984], 75: [872.3, 984], 76: [843.5, 984], 77: [797.3, 984], 78: [768.5, 984], 79: [740.8, 984], 80: [710.8, 984], 81: [660, 984], 82: [631, 984], 83: [602, 984], 84: [574, 984],
  85: [529, 984], 86: [498.5, 984], 87: [471, 984], 88: [442.3, 984], 89: [394.2, 984], 90: [365.4, 984], 91: [338.5, 984], 92: [309.6, 984], 93: [255.8, 984], 94: [227, 984], 95: [198, 984], 96: [169, 984],
  97: [122.3, 984], 98: [94.2, 984], 99: [63.5, 984]
};
// turn-order barrels 1..4 (character token on the barrel face), card frames (draw deck, wild location, wild industry)
const ORDER = [[176, 682.5], [176, 762.5], [176, 840], [176, 917.5]];
const FRAMES = { deck: [140.5, 152], wildLocation: [140.5, 291], wildIndustry: [140.5, 426] };
const FRAME_WH = [159, 116];
// links: centre + angle (deg) of the link tile on the printed line
const LINK_W = 52, LINK_H = 22;
const LINKS = {
  'stoke-on-trent~warrington': [347, 92, 22], 'leek~stoke-on-trent': [467.5, 73.3, -28], 'stoke-on-trent~stone': [363, 211, -60],
  'stone~uttoxeter': [438, 239, -5], 'burton-on-trent~stone': [555, 298, 12], 'stafford~stone': [313, 327.5, 49],
  'cannock~stafford': [467.5, 394, 72], 'cannock~farm-cannock': [376, 432.5, -2], 'burton-on-trent~cannock': [575, 395, -32],
  'belper~leek': [645, 67.5, 3], 'belper~derby': [768, 150, 78], 'derby~nottingham': [820, 206.7, -24], 'derby~uttoxeter': [666, 250, 8],
  'burton-on-trent~derby': [757.5, 323, -61], 'coalbrookdale~shrewsbury': [160, 535, -2], 'coalbrookdale~wolverhampton': [289.6, 535.4, 1],
  'cannock~wolverhampton': [393.8, 477, -45], 'walsall~wolverhampton': [450, 543.8, 10], 'cannock~walsall': [539.6, 504, 73],
  'coalbrookdale~kidderminster': [243.8, 683, 61], 'dudley~wolverhampton': [364.6, 616.7, 80], 'dudley~kidderminster': [356, 714.6, -59],
  'birmingham~dudley': [523, 664, 4], 'burton-on-trent~walsall': [590.4, 470.8, -69], 'burton-on-trent~tamworth': [698.8, 445.8, 82],
  'tamworth~walsall': [617.5, 545.8, -28], 'birmingham~tamworth': [696.7, 583.3, -70], 'nuneaton~tamworth': [782, 525, 65],
  'birmingham~walsall': [557, 629, 61], 'birmingham~nuneaton': [711, 614.6, -25], 'coventry~nuneaton': [860, 658, 85],
  'birmingham~coventry': [720.8, 720, 15], 'birmingham~redditch': [600.8, 758, 95], 'birmingham~oxford': [712, 765, 52],
  'kidderminster~worcester': [320.6, 838.8, -8], 'gloucester~worcester': [441, 917.6, 15], 'birmingham~worcester': [461.8, 806, -61],
  'gloucester~redditch': [523.5, 867.6, -70], 'oxford~redditch': [664.7, 826.5, 3]
};
// night player mat (2818x2280 source; 1000 units wide, 809 high): centre of each printed level frame (tools/find-frames.py)
const MAT_H = 1000 * 2280 / 2818;
const MAT = {
  manufacturer: { 1: [105, 285.3], 2: [105, 187.5], 3: [105, 86.2], 4: [262.6, 86.2], 5: [420.2, 86.4], 6: [577.7, 86.6], 7: [735.3, 86.6], 8: [892.8, 86.8] },
  cotton: { 1: [312.8, 558.9], 2: [312.8, 460.3], 3: [313, 360.5], 4: [313, 261] },
  pottery: { 1: [518.3, 559.1], 2: [518.3, 460.3], 3: [518.5, 360.7], 4: [518.5, 261], 5: [672.8, 261.2] },
  iron: { 1: [724.6, 561.4], 2: [881.3, 561.4], 3: [881.5, 459.7], 4: [881.5, 362.3] },
  brewery: { 1: [108.1, 719.7], 2: [108.2, 619.2], 3: [108.2, 518.6], 4: [108.2, 419.8] },
  coal: { 1: [362.5, 726.8], 2: [519.5, 726.9], 3: [679.6, 726.9], 4: [838.7, 727.1] }
};
const MAT_FRAME = 81.6;
module.exports = { MAT, MAT_H, MAT_FRAME, SLOT, SLOTS, MERCHANTS, MERCHANT_W, ROW_Y, COAL_X, IRON_X, CUBE, TRACK, ORDER, FRAMES, FRAME_WH, LINK_W, LINK_H, LINKS };
