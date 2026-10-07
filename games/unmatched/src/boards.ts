// Battlefields. Space centres + zones come from published map geometry; adjacency lines, start spaces, secret
// passages and zones missing from that geometry were read by hand from the board art (see DECISIONS.md).
// Coordinates are in a 1337×866 frame.

export interface Space { x: number; y: number; zones: string[] }
export interface Board {
  id: string; nameFa: string; nameEn: string;
  zones: { id: string; color: string; nameFa: string }[];
  spaces: Space[]; edges: [number, number][]; starts: number[];
  /** Secret passages: mutually adjacent for movement only. */
  passages: number[];
}

const ZONE_FA: Record<string, string> = { gray: 'خاکستری', green: 'سبز', blue: 'آبی', violet: 'بنفش روشن', purple: 'ارغوانی', red: 'قرمز', brown: 'قهوه‌ای', yellow: 'زرد', orange: 'نارنجی', navy: 'سرمه‌ای' };

const b_marmoreal: Board = {
  id: 'marmoreal', nameFa: 'مارموریال', nameEn: 'Marmoreal',
  zones: [{"id":"gray","color":"#C5D1D3"},{"id":"green","color":"#C3D5C4"},{"id":"blue","color":"#C4CDD4"},{"id":"violet","color":"#CBC4D4"},{"id":"purple","color":"#D6C2CD"},{"id":"red","color":"#E1B7B8"},{"id":"brown","color":"#D5C8C4"},{"id":"yellow","color":"#E6CDB2"}].map((z) => ({ ...z, nameFa: ZONE_FA[z.id] ?? z.id })),
  spaces: [
    { x: 517, y: 72, zones: ["gray"] }, // 0
    { x: 1013, y: 73, zones: ["gray"] }, // 1
    { x: 356, y: 74, zones: ["gray"] }, // 2
    { x: 845, y: 74, zones: ["gray"] }, // 3
    { x: 190, y: 91, zones: ["gray","yellow"] }, // 4
    { x: 672, y: 114, zones: ["gray","green","blue"] }, // 5
    { x: 1180, y: 187, zones: ["blue"] }, // 6
    { x: 159, y: 238, zones: ["green","red","yellow"] }, // 7
    { x: 317, y: 253, zones: ["green","yellow"] }, // 8
    { x: 1020, y: 255, zones: ["green","blue"] }, // 9
    { x: 492, y: 263, zones: ["green","blue"] }, // 10
    { x: 849, y: 266, zones: ["green","blue"] }, // 11
    { x: 673, y: 315, zones: ["green","blue"] }, // 12
    { x: 1181, y: 352, zones: ["blue","violet"] }, // 13
    { x: 396, y: 381, zones: ["green","blue"] }, // 14
    { x: 158, y: 382, zones: ["red","yellow"] }, // 15
    { x: 949, y: 385, zones: ["green","blue"] }, // 16
    { x: 558, y: 440, zones: ["green","blue","purple"] }, // 17
    { x: 792, y: 441, zones: ["green","blue","purple"] }, // 18
    { x: 1177, y: 501, zones: ["violet"] }, // 19
    { x: 177, y: 528, zones: ["red","yellow"] }, // 20
    { x: 675, y: 529, zones: ["green","blue","purple"] }, // 21
    { x: 330, y: 543, zones: ["red"] }, // 22
    { x: 1048, y: 569, zones: ["violet"] }, // 23
    { x: 514, y: 639, zones: ["green","blue","brown"] }, // 24
    { x: 830, y: 642, zones: ["green","blue","brown"] }, // 25
    { x: 965, y: 725, zones: ["violet","brown"] }, // 26
    { x: 247, y: 743, zones: ["brown"] }, // 27
    { x: 600, y: 774, zones: ["purple","brown"] }, // 28
    { x: 424, y: 784, zones: ["brown"] }, // 29
    { x: 749, y: 786, zones: ["purple","brown"] }, // 30
  ],
  edges: [[4,2],[2,0],[0,5],[5,3],[3,1],[1,6],[4,7],[7,15],[15,20],[20,27],[7,8],[20,22],[5,12],[6,9],[6,13],[13,16],[13,19],[19,23],[23,26],[23,25],[22,24],[24,25],[21,28],[21,30],[27,29],[29,28],[28,30],[30,26],[8,10],[8,14],[10,14],[10,12],[10,17],[12,11],[11,9],[11,16],[9,16],[11,18],[14,17],[17,21],[18,21],[16,18]],
  starts: [15,26,0,9],
  passages: []
};

const b_sarpedon: Board = {
  id: 'sarpedon', nameFa: 'سارپدون', nameEn: 'Sarpedon',
  zones: [{"id":"green","color":"#D8FFB9"},{"id":"yellow","color":"#FEFFB9"},{"id":"brown","color":"#CEAD8D"},{"id":"red","color":"#D48D8C"},{"id":"purple","color":"#DABECB"},{"id":"blue","color":"#BFCFD9"}].map((z) => ({ ...z, nameFa: ZONE_FA[z.id] ?? z.id })),
  spaces: [
    { x: 233, y: 71, zones: ["green"] }, // 0
    { x: 508, y: 74, zones: ["green"] }, // 1
    { x: 1259, y: 78, zones: ["brown"] }, // 2
    { x: 681, y: 85, zones: ["yellow"] }, // 3
    { x: 80, y: 104, zones: ["green"] }, // 4
    { x: 370, y: 122, zones: ["green"] }, // 5
    { x: 1126, y: 138, zones: ["brown"] }, // 6
    { x: 766, y: 203, zones: ["yellow"] }, // 7
    { x: 212, y: 212, zones: ["green"] }, // 8
    { x: 1267, y: 236, zones: ["red"] }, // 9
    { x: 478, y: 238, zones: ["green"] }, // 10
    { x: 73, y: 259, zones: ["green"] }, // 11
    { x: 1048, y: 261, zones: ["brown"] }, // 12
    { x: 634, y: 263, zones: ["yellow"] }, // 13
    { x: 339, y: 271, zones: ["green"] }, // 14
    { x: 894, y: 279, zones: ["yellow"] }, // 15
    { x: 1257, y: 376, zones: ["red"] }, // 16
    { x: 994, y: 397, zones: ["yellow","brown","purple"] }, // 17
    { x: 535, y: 400, zones: ["yellow","purple"] }, // 18
    { x: 342, y: 414, zones: ["blue"] }, // 19
    { x: 71, y: 429, zones: ["blue"] }, // 20
    { x: 205, y: 483, zones: ["blue"] }, // 21
    { x: 907, y: 514, zones: ["yellow","brown","purple"] }, // 22
    { x: 1065, y: 517, zones: ["purple"] }, // 23
    { x: 1266, y: 521, zones: ["red"] }, // 24
    { x: 439, y: 534, zones: ["yellow","purple"] }, // 25
    { x: 77, y: 571, zones: ["blue"] }, // 26
    { x: 1166, y: 625, zones: ["red"] }, // 27
    { x: 575, y: 632, zones: ["purple"] }, // 28
    { x: 847, y: 644, zones: ["purple"] }, // 29
    { x: 218, y: 645, zones: ["blue"] }, // 30
    { x: 372, y: 673, zones: ["purple"] }, // 31
    { x: 90, y: 715, zones: ["blue"] }, // 32
    { x: 693, y: 717, zones: ["purple"] }, // 33
    { x: 1146, y: 768, zones: ["red"] }, // 34
    { x: 252, y: 786, zones: ["purple"] }, // 35
    { x: 824, y: 788, zones: ["purple"] }, // 36
    { x: 1007, y: 797, zones: ["red"] }, // 37
  ],
  edges: [[4,0],[0,5],[5,1],[1,3],[4,8],[4,11],[0,8],[5,14],[5,10],[1,10],[8,11],[8,14],[14,10],[10,13],[3,13],[11,20],[14,19],[10,18],[13,18],[19,18],[20,21],[20,26],[21,19],[21,26],[26,30],[26,32],[30,31],[30,32],[30,35],[32,35],[31,35],[31,25],[31,28],[19,25],[18,25],[18,28],[25,28],[28,33],[3,7],[13,7],[7,15],[15,12],[15,17],[12,6],[6,2],[6,9],[2,9],[9,16],[12,17],[17,22],[17,23],[22,23],[22,29],[23,27],[24,27],[16,24],[27,34],[29,36],[33,36],[36,37],[37,34]],
  starts: [19,29,5,12],
  passages: []
};

const b_soho: Board = {
  id: 'soho', nameFa: 'سوهو', nameEn: 'SoHo',
  zones: [{"id":"blue","color":"#C0D1D8"},{"id":"brown","color":"#D6C5C2"},{"id":"gray","color":"#D4CDC4"},{"id":"green","color":"#C6D7C2"},{"id":"orange","color":"#E6BDB3"},{"id":"yellow","color":"#EAD1AE"},{"id":"navy","color":"#8f9db8"}].map((z) => ({ ...z, nameFa: ZONE_FA[z.id] ?? z.id })),
  spaces: [
    { x: 568, y: 84, zones: ["blue","navy"] }, // 0
    { x: 98, y: 85, zones: ["blue"] }, // 1
    { x: 253, y: 85, zones: ["blue"] }, // 2
    { x: 404, y: 91, zones: ["blue"] }, // 3
    { x: 1083, y: 70, zones: ["brown","navy"] }, // 4
    { x: 1254, y: 80, zones: ["brown","navy"] }, // 5
    { x: 495, y: 297, zones: ["blue","gray"] }, // 6
    { x: 294, y: 303, zones: ["blue","gray"] }, // 7
    { x: 1203, y: 322, zones: ["brown"] }, // 8
    { x: 84, y: 333, zones: ["gray"] }, // 9
    { x: 659, y: 338, zones: ["gray"] }, // 10
    { x: 835, y: 301, zones: ["gray","navy"] }, // 11
    { x: 1001, y: 368, zones: ["brown","gray","navy"] }, // 12
    { x: 1259, y: 457, zones: ["brown"] }, // 13
    { x: 446, y: 463, zones: ["green"] }, // 14
    { x: 828, y: 438, zones: ["yellow","navy"] }, // 15
    { x: 1096, y: 487, zones: ["brown","yellow"] }, // 16
    { x: 274, y: 492, zones: ["green"] }, // 17
    { x: 1259, y: 612, zones: ["brown"] }, // 18
    { x: 97, y: 623, zones: ["orange"] }, // 19
    { x: 950, y: 646, zones: ["yellow"] }, // 20
    { x: 626, y: 648, zones: ["orange"] }, // 21
    { x: 469, y: 747, zones: ["green","orange"] }, // 22
    { x: 245, y: 756, zones: ["green","orange"] }, // 23
    { x: 1210, y: 764, zones: ["yellow"] }, // 24
    { x: 1029, y: 770, zones: ["orange","yellow"] }, // 25
    { x: 747, y: 772, zones: ["orange","yellow"] }, // 26
    { x: 742, y: 74, zones: ["navy"] }, // 27
    { x: 902, y: 74, zones: ["navy"] }, // 28
  ],
  edges: [[1,2],[2,3],[3,0],[0,27],[27,28],[28,4],[4,5],[1,9],[0,6],[28,11],[5,8],[9,7],[7,6],[6,10],[10,11],[11,12],[12,8],[8,13],[13,18],[16,18],[18,24],[9,19],[10,21],[12,20],[14,17],[14,15],[15,16],[17,19],[19,23],[23,22],[22,21],[21,26],[22,26],[26,25],[25,24],[20,25]],
  starts: [3,8,19,20],
  passages: []
};

const b_baskerville_manor: Board = {
  id: 'baskerville-manor', nameFa: 'عمارت باسکرویل', nameEn: 'Baskerville Manor',
  zones: [{"id":"blue","color":"#BCD4DC"},{"id":"brown","color":"#EFCAA9"},{"id":"yellow","color":"#DDD0BB"},{"id":"green","color":"#BCDCC8"},{"id":"violet","color":"#CBC4D4"},{"id":"gray","color":"#C6CBD2"},{"id":"navy","color":"#7f97a8"}].map((z) => ({ ...z, nameFa: ZONE_FA[z.id] ?? z.id })),
  spaces: [
    { x: 280, y: 74, zones: ["blue"] }, // 0
    { x: 519, y: 104, zones: ["brown"] }, // 1
    { x: 775, y: 107, zones: ["brown"] }, // 2
    { x: 1064, y: 116, zones: ["yellow"] }, // 3
    { x: 104, y: 117, zones: ["blue"] }, // 4
    { x: 1241, y: 121, zones: ["yellow"] }, // 5
    { x: 685, y: 223, zones: ["brown"] }, // 6
    { x: 380, y: 225, zones: ["blue","brown"] }, // 7
    { x: 922, y: 226, zones: ["brown","yellow","green"] }, // 8
    { x: 1147, y: 227, zones: ["yellow"] }, // 9
    { x: 85, y: 274, zones: ["blue"] }, // 10
    { x: 242, y: 289, zones: ["blue"] }, // 11
    { x: 430, y: 391, zones: ["blue","navy"] }, // 12
    { x: 1135, y: 392, zones: ["violet"] }, // 13
    { x: 746, y: 422, zones: ["green"] }, // 14
    { x: 921, y: 493, zones: ["green","violet"] }, // 15
    { x: 1231, y: 499, zones: ["violet"] }, // 16
    { x: 613, y: 502, zones: ["green"] }, // 17
    { x: 1068, y: 531, zones: ["violet"] }, // 18
    { x: 433, y: 596, zones: ["green","navy"] }, // 19
    { x: 668, y: 668, zones: ["green","gray"] }, // 20
    { x: 1251, y: 686, zones: ["violet","gray"] }, // 21
    { x: 846, y: 698, zones: ["gray"] }, // 22
    { x: 1020, y: 706, zones: ["gray"] }, // 23
    { x: 209, y: 672, zones: ["gray","navy"] }, // 24
    { x: 427, y: 757, zones: ["gray"] }, // 25
    { x: 569, y: 783, zones: ["gray"] }, // 26
    { x: 285, y: 793, zones: ["gray"] }, // 27
    { x: 1148, y: 793, zones: ["gray"] }, // 28
    { x: 731, y: 794, zones: ["gray"] }, // 29
    { x: 126, y: 489, zones: ["navy"] }, // 30
    { x: 281, y: 451, zones: ["navy"] }, // 31
  ],
  edges: [[4,0],[4,10],[0,7],[7,1],[7,12],[1,2],[1,6],[2,6],[2,8],[6,8],[3,8],[8,9],[3,5],[3,9],[9,13],[8,15],[10,11],[11,12],[10,30],[30,31],[31,12],[30,24],[24,19],[19,17],[24,27],[17,14],[14,15],[15,13],[15,18],[13,16],[18,16],[16,21],[15,22],[15,23],[17,20],[20,22],[22,23],[23,21],[20,26],[20,29],[29,22],[26,25],[25,27],[26,29],[23,28],[28,21]],
  starts: [18,7,20,31],
  passages: [4,5,14,27]
};

export const BOARDS: Record<string, Board> = { 'marmoreal': b_marmoreal, 'sarpedon': b_sarpedon, 'soho': b_soho, 'baskerville-manor': b_baskerville_manor };
export const BOARD_IDS = Object.keys(BOARDS);
