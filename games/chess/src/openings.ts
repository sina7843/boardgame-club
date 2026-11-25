// Opening names for the move-list header (livefix U11). A small ECO table of common lines: the longest line that is a
// prefix of the game wins. Moves are SAN without check marks. No network: standard-start games only.
type Row = [moves: string, eco: string, fa: string, en: string];
const T: Row[] = [
  ['e4', 'B00', 'گشایش پیاده شاه', "King's Pawn Opening"],
  ['d4', 'A40', 'گشایش پیاده وزیر', "Queen's Pawn Opening"],
  ['c4', 'A10', 'گشایش انگلیسی', 'English Opening'],
  ['Nf3', 'A04', 'گشایش رتی', 'Réti Opening'],
  ['f4', 'A02', 'گشایش بیرد', "Bird's Opening"],
  ['b3', 'A01', 'گشایش لارسن', "Nimzo-Larsen Attack"],
  ['g3', 'A00', 'گشایش بنکو', 'Hungarian Opening'],
  ['e4 e5', 'C20', 'بازی پیاده شاه', "King's Pawn Game"],
  ['e4 e5 Nf3', 'C40', 'بازی شاه با اسب', "King's Knight Opening"],
  ['e4 e5 Nf3 Nc6', 'C44', 'بازی دو اسب‌ها', 'Open Game'],
  ['e4 e5 Nf3 Nc6 Bb5', 'C60', 'گشایش اسپانیایی (روی لوپز)', 'Ruy Lopez'],
  ['e4 e5 Nf3 Nc6 Bb5 a6', 'C68', 'اسپانیایی، دفاع مورفی', 'Ruy Lopez: Morphy Defense'],
  ['e4 e5 Nf3 Nc6 Bc4', 'C50', 'گشایش ایتالیایی', 'Italian Game'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'C50', 'ایتالیایی، جوکو پیانو', 'Giuoco Piano'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'C55', 'دفاع دو اسب', 'Two Knights Defense'],
  ['e4 e5 Nf3 Nc6 d4', 'C44', 'گشایش اسکاتلندی', 'Scotch Game'],
  ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'C46', 'بازی چهار اسب', 'Four Knights Game'],
  ['e4 e5 Nf3 Nf6', 'C42', 'دفاع روسی (پتروف)', 'Petrov Defense'],
  ['e4 e5 Nf3 d6', 'C41', 'دفاع فیلیدور', 'Philidor Defense'],
  ['e4 e5 f4', 'C30', 'گامبی شاه', "King's Gambit"],
  ['e4 e5 Nc3', 'C25', 'گشایش وین', 'Vienna Game'],
  ['e4 e5 Bc4', 'C23', 'گشایش فیل', "Bishop's Opening"],
  ['e4 c5', 'B20', 'دفاع سیسیلی', 'Sicilian Defense'],
  ['e4 c5 Nf3 d6', 'B50', 'سیسیلی، خط d6', 'Sicilian Defense: Modern Variations'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'B90', 'سیسیلی، نایدورف', 'Sicilian Defense: Najdorf Variation'],
  ['e4 c5 Nf3 Nc6', 'B30', 'سیسیلی، خط اسب c6', 'Sicilian Defense: Old Sicilian'],
  ['e4 c5 Nf3 e6', 'B40', 'سیسیلی، خط e6', 'Sicilian Defense: French Variation'],
  ['e4 c5 c3', 'B22', 'سیسیلی، آلاپین', 'Sicilian Defense: Alapin Variation'],
  ['e4 e6', 'C00', 'دفاع فرانسوی', 'French Defense'],
  ['e4 e6 d4 d5 Nc3', 'C10', 'فرانسوی، خط کلاسیک', 'French Defense: Classical'],
  ['e4 e6 d4 d5 e5', 'C02', 'فرانسوی، پیشروی', 'French Defense: Advance Variation'],
  ['e4 c6', 'B10', 'دفاع کاروکان', 'Caro-Kann Defense'],
  ['e4 c6 d4 d5 Nc3', 'B15', 'کاروکان، خط کلاسیک', 'Caro-Kann Defense: Main Line'],
  ['e4 c6 d4 d5 e5', 'B12', 'کاروکان، پیشروی', 'Caro-Kann Defense: Advance Variation'],
  ['e4 d5', 'B01', 'دفاع اسکاندیناوی', 'Scandinavian Defense'],
  ['e4 d6', 'B07', 'دفاع پیرتس', 'Pirc Defense'],
  ['e4 g6', 'B06', 'دفاع مدرن', 'Modern Defense'],
  ['e4 Nf6', 'B02', 'دفاع آلخین', "Alekhine's Defense"],
  ['d4 d5', 'D00', 'بازی پیاده وزیر', "Queen's Pawn Game"],
  ['d4 d5 c4', 'D06', 'گامبی وزیر', "Queen's Gambit"],
  ['d4 d5 c4 e6', 'D30', 'گامبی وزیر رد شده', "Queen's Gambit Declined"],
  ['d4 d5 c4 dxc4', 'D20', 'گامبی وزیر پذیرفته', "Queen's Gambit Accepted"],
  ['d4 d5 c4 c6', 'D10', 'دفاع اسلاو', 'Slav Defense'],
  ['d4 d5 Nf3', 'D02', 'گشایش پیاده وزیر، خط اسب', "Queen's Pawn Game: Zukertort"],
  ['d4 d5 Bf4', 'D00', 'سیستم لندن', 'London System'],
  ['d4 Nf6', 'A45', 'دفاع هندی', 'Indian Defense'],
  ['d4 Nf6 c4 e6', 'E00', 'دفاع هندی وزیر (کاتالان / نیمتسو)', 'Indian Game'],
  ['d4 Nf6 c4 e6 Nc3 Bb4', 'E20', 'دفاع نیمتسو-هندی', 'Nimzo-Indian Defense'],
  ['d4 Nf6 c4 e6 Nf3 b6', 'E12', 'دفاع هندی وزیر', "Queen's Indian Defense"],
  ['d4 Nf6 c4 g6', 'E60', 'دفاع هندی شاه', "King's Indian Defense"],
  ['d4 Nf6 c4 g6 Nc3 d5', 'D80', 'دفاع گرونفلد', 'Grünfeld Defense'],
  ['d4 Nf6 Bg5', 'A45', 'حملهٔ تروموفسکی', 'Trompowsky Attack'],
  ['d4 f5', 'A80', 'دفاع هلندی', 'Dutch Defense'],
  ['d4 e6', 'A40', 'دفاع فرانسوی وزیر', "Queen's Pawn: Franco-Indian"],
  ['c4 e5', 'A20', 'انگلیسی، شاه انگلیسی', "English Opening: King's English"],
  ['c4 c5', 'A30', 'انگلیسی، متقارن', 'English Opening: Symmetrical'],
  ['Nf3 d5', 'A06', 'گشایش رتی، خط d5', 'Réti Opening'],
  ['Nf3 Nf6 c4', 'A13', 'گشایش انگلیسی، رتی', 'English Opening']
];

/** The longest table line the game starts with, or null (the game left every known line, or has no moves). */
export function openingOf(history: readonly { san: string }[]): { eco: string; fa: string; en: string } | null {
  const line = history.map((h) => h.san.replace(/[+#]/g, '')).join(' ');
  let best: Row | null = null;
  for (const r of T) if ((line === r[0] || line.startsWith(r[0] + ' ')) && (!best || r[0].length > best[0].length)) best = r;
  return best ? { eco: best[1], fa: best[2], en: best[3] } : null;
}
