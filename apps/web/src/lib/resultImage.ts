// Shareable result card as a PNG, drawn on a canvas (no dependency). Colours and fonts are read from the DS tokens at
// runtime (the active theme), never hard-coded. Public outcome only: game, places, names, public scores, date.
import { faNum, jalaliDate } from './format.ts';

export interface ResultImageInput {
  gameNameFa: string;
  gameNameLatin: string;
  /** Sorted by place. */
  places: { place: number; name: string; score?: number | undefined }[];
  date: string;
}

const W = 1200, H = 630, PAD = 64;

export async function drawResultImage(o: ResultImageInput): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const tok = (n: string) => css.getPropertyValue(n).trim();
  const fa = tok('--font-fa'), latin = tok('--font-latin') || fa;
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const box = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  };
  const text = (s: string, x: number, y: number, font: string, color: string, dir: CanvasDirection = 'rtl', align: CanvasTextAlign = 'right') => {
    ctx.font = font; ctx.fillStyle = color; ctx.direction = dir; ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const radius = parseFloat(tok('--radius-lg')) || 20;

  ctx.fillStyle = tok('--bg'); ctx.fillRect(0, 0, W, H);
  box(PAD / 2, PAD / 2, W - PAD, H - PAD, radius);
  ctx.fillStyle = tok('--surface'); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = tok('--line'); ctx.stroke();

  const right = W - PAD - 16, left = PAD + 16;
  ctx.textBaseline = 'alphabetic';
  text(o.gameNameFa, right, 140, `800 60px ${fa}`, tok('--heading'));
  if (o.gameNameLatin) text(o.gameNameLatin, right, 186, `600 28px ${latin}`, tok('--text-muted'), 'ltr', 'right');

  const rows = o.places.slice(0, 5);
  let y = 260;
  for (const p of rows) {
    const first = p.place === 1;
    // Place token: the winner's in the selection navy (cream in dark), the rest outlined.
    ctx.beginPath(); ctx.arc(right - 24, y - 14, 24, 0, Math.PI * 2);
    if (first) { ctx.fillStyle = tok('--selected'); ctx.fill(); } else { ctx.lineWidth = 2; ctx.strokeStyle = tok('--line'); ctx.stroke(); }
    ctx.textBaseline = 'middle';
    text(faNum(p.place), right - 24, y - 12, `800 26px ${fa}`, first ? tok('--on-selected') : tok('--text'), 'rtl', 'center');
    text(p.name, right - 68, y - 12, `${first ? 800 : 600} 34px ${fa}`, tok('--text'));
    if (p.score !== undefined) text(`${faNum(p.score)} امتیاز`, left, y - 12, `600 30px ${fa}`, tok('--text-muted'), 'rtl', 'left');
    ctx.textBaseline = 'alphabetic';
    y += 64;
  }
  if (o.places.length > rows.length) text(`و ${faNum(o.places.length - rows.length)} بازیکن دیگر`, right, y, `500 24px ${fa}`, tok('--text-muted'));

  ctx.beginPath(); ctx.moveTo(left, H - 120); ctx.lineTo(right, H - 120); ctx.lineWidth = 2; ctx.strokeStyle = tok('--line'); ctx.stroke();
  text(jalaliDate(o.date), right, H - 74, `600 26px ${fa}`, tok('--text-muted'));
  text('boardgameverse.ir', left, H - 74, `700 26px ${latin}`, tok('--heading'), 'ltr', 'left');

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
}

/** Share sheet with the PNG where the browser can share files; otherwise download it. */
export async function shareResultImage(o: ResultImageInput, filename: string): Promise<void> {
  const file = new File([await drawResultImage(o)], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: o.gameNameFa }); } catch { /* share sheet dismissed */ }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
