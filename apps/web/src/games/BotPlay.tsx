import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BOT_LEVEL_FA } from '@bg/contracts';
import { Button, Segmented, Select } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';

type BotLevel = keyof typeof BOT_LEVEL_FA;

/** «بازی با ربات»: choose a level (and table size for multi-player games), then start at once. */
export function BotPlay({ gameId, minPlayers, maxPlayers, players: fixedPlayers }: { gameId: string; minPlayers: number; maxPlayers: number; players?: number }) {
  const navigate = useNavigate();
  const [level, setLevel] = useState<BotLevel>('medium');
  const [players, setPlayers] = useState(fixedPlayers ?? Math.max(2, minPlayers));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const start = async () => {
    setBusy(true); setError(undefined);
    try { navigate(`/tables/${(await api<{ id: string }>('/tables/bot', { method: 'POST', body: { gameId, level, playerCount: players } })).id}`); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'بازی با ربات شروع نشد.'); setBusy(false); }
  };
  const first = Math.max(2, minPlayers);
  return (
    <div className="pg-stack">
      <div className="pg-field">
        <span className="bgv-label">سطح ربات</span>
        <Segmented label="سطح ربات" block value={level} onChange={(v) => setLevel(v as BotLevel)}
          options={(['easy', 'medium', 'hard'] as const).map((l) => ({ value: l, label: BOT_LEVEL_FA[l] }))} />
      </div>
      {fixedPlayers === undefined && maxPlayers > first && (
        <Select label="تعداد بازیکن (شما و ربات‌ها)" value={String(players)} onChange={(e) => setPlayers(Number(e.target.value))}
          options={Array.from({ length: maxPlayers - first + 1 }, (_, i) => first + i).map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
      )}
      <Button block loading={busy} onClick={start} icon="bot">بازی با ربات</Button>
      <p className="bgv-hint">حریف ربات است و با نشان ربات دیده می‌شود. بازی دوستانه است، روی رتبه اثری ندارد و ۳۰٪ امتیاز تجربه می‌دهد.</p>
      {error && <p className="bgv-hint bgv-hint--error" role="alert">{error}</p>}
    </div>
  );
}
