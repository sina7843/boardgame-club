import { useState } from 'react';
import type { AdminTableItem, AdminTables, GameSummary } from '@bg/contracts';
import { Badge, Button, Card, ChipGroup, Select, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { COMPETITION_FA, faNum, jalaliDateTime, PACE_FA } from '../lib/format.ts';

const STATUS_FA: Record<AdminTableItem['status'], string> = { open: 'در انتظار بازیکن', active: 'در جریان', paused: 'متوقف', finished: 'تمام‌شده', cancelled: 'لغوشده' };
const STATUS_TONE: Record<AdminTableItem['status'], 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = { open: 'info', active: 'success', paused: 'warning', finished: 'neutral', cancelled: 'danger' };
const KIND_FA: Record<AdminTableItem['kind'], string | null> = { normal: null, matchmade: 'بازی سریع', tournament: 'تورنمنت', tutorial: 'آموزش' };
const REASON_FA: Record<string, string> = { win: 'برد', draw: 'مساوی', score: 'امتیاز', timeout: 'تمام شدن وقت', resign: 'تسلیم' };
const STATUSES = ['all', 'open', 'active', 'paused', 'finished', 'cancelled'] as const;

/** Admin «میزها»: every table ever created, newest first, with status, players, placements and how it ended. */
export function TablesAdmin() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [gameId, setGameId] = useState('');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [tutorials, setTutorials] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [offset, setOffset] = useState(0);
  const games = useApi<{ items: GameSummary[] }>('/games');
  const list = useApi<AdminTables>(`/admin/tables?status=${status}&offset=${offset}&tutorials=${tutorials}&deleted=${deleted}${gameId ? `&gameId=${gameId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const counts = list.data?.counts;
  const all = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const reset = () => setOffset(0);
  return (
    <Card flush aria-labelledby="admin-tables-h">
      <form className="ac-adm__pick" onSubmit={(e) => { e.preventDefault(); reset(); setQ(draft.trim()); }}>
        <h2 id="admin-tables-h" className="ac-h3">میزها {list.data && <span className="ac-cap" style={{ display: 'inline' }}>({faNum(list.data.total)})</span>}</h2>
        <div className="ac-tblfilters">
          <TextField icon="search" type="search" aria-label="جست‌وجوی بازیکن" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="نام بازیکن، سپس Enter" />
          <Select aria-label="بازی" value={gameId} onChange={(e) => { reset(); setGameId(e.target.value); }}
            options={[{ value: '', label: 'همهٔ بازی‌ها' }, ...(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))]} />
          <Switch label="میزهای آموزش هم" checked={tutorials} onChange={(v) => { reset(); setTutorials(v); }} />
          <Switch label="میزهای کاربران حذف‌شده هم" checked={deleted} onChange={(v) => { reset(); setDeleted(v); }} />
        </div>
        <ChipGroup size="sm" label="وضعیت" value={status} onChange={(v) => { reset(); setStatus(v as typeof status); }}
          options={STATUSES.map((s) => ({ value: s, label: `${s === 'all' ? 'همه' : STATUS_FA[s]}${counts ? ` (${faNum(s === 'all' ? all : counts[s])})` : ''}` }))} />
      </form>
      {list.error ? <StateBlock kind="error" title="فهرست میزها بارگذاری نشد" text={list.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={list.reload}>تلاش دوباره</Button>} />
        : !list.data ? <StateBlock kind="loading" title="در حال بارگذاری…" />
        : list.data.items.length === 0 ? <StateBlock kind="empty" title="میزی پیدا نشد" />
        : <>
          <ul className="ac-tbllist">{list.data.items.map((t) => <Row key={t.id} t={t} />)}</ul>
          {(offset > 0 || list.data.hasMore) && (
            <div className="ac-tblpager">
              <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>قبلی</Button>
              <span className="ac-cap">{faNum(offset + 1)} تا {faNum(offset + list.data.items.length)}</span>
              <Button size="sm" variant="secondary" disabled={!list.data.hasMore} onClick={() => setOffset(offset + 50)}>بعدی</Button>
            </div>
          )}
        </>}
    </Card>
  );
}

function Row({ t }: { t: AdminTableItem }) {
  const kind = KIND_FA[t.kind];
  return (
    <li className="ac-tblrow">
      <div className="ac-tblrow__head">
        <b>{t.gameNameFa}</b>
        <Badge size="sm" tone={STATUS_TONE[t.status]}>{STATUS_FA[t.status]}</Badge>
        {kind && <Badge size="sm">{kind}</Badge>}
        <span className="ac-cap">{PACE_FA[t.pace]}<span className="bgv-sep" />{COMPETITION_FA[t.competition]}<span className="bgv-sep" />{t.visibility === 'public' ? 'عمومی' : 'خصوصی'}</span>
        <Button size="sm" variant="ghost" icon="eye" href={`/tables/${t.id}`}>باز کردن</Button>
      </div>
      <div className="ac-tblrow__seats">
        {t.seats.length === 0 ? <span className="ac-cap">هنوز کسی ننشسته</span> : t.seats.map((s) => (
          <span key={s.seat} className={`ac-tblseat${s.place === 1 ? ' is-first' : ''}`}>
            {s.place !== null && <b className="bgv-num">{faNum(s.place)}</b>}
            {s.userId ? <a href={`/admin?tab=players&player=${s.userId}`}><bdi>{s.name}</bdi></a> : <bdi>{s.name}</bdi>}
            {s.bot && <span className="ac-cap">ربات</span>}{s.left && <span className="ac-cap">رفته</span>}
          </span>
        ))}
        <span className="ac-cap">{faNum(t.seats.length)} از {faNum(t.capacity)}</span>
      </div>
      <div className="ac-cap ac-tblrow__meta">
        <span>ساخته: {jalaliDateTime(t.createdAt)}</span>
        {t.startedAt && <span>شروع: {jalaliDateTime(t.startedAt)}</span>}
        {t.finishedAt && <span>پایان: {jalaliDateTime(t.finishedAt)}</span>}
        <span>{faNum(t.moves)} حرکت</span>
        {t.resultReason && <span>نتیجه: {REASON_FA[t.resultReason] ?? t.resultReason}</span>}
        {t.host && <span>میزبان: <bdi>{t.host}</bdi></span>}
      </div>
    </li>
  );
}
