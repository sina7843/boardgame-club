import { useEffect, useState } from 'react';
import type { AdminGameSettingsView } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Banner, Button, Card, ChipGroup, Icon, Select, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { COMPETITION_FA, durationFa, faNum, PACE_FA } from '../lib/format.ts';

type Current = AdminGameSettingsView['current'];
type OptValue = string | number | boolean;

function Chips({ title, hint, label, value, options, onChange }: { title: string; hint?: string; label: string; value: string[]; options: { value: string; label: string }[]; onChange: (v: string[]) => void }) {
  return (
    <div className="ac-row ac-row--stack">
      <div className="ac-chiprow"><b>{title}</b>{hint && <span>{hint}</span>}
        <ChipGroup size="sm" label={label} value={value} options={options} onChange={(v) => onChange(v as string[])} /></div>
    </div>
  );
}

/**
 * Per-game play settings. The game module defines what is possible; here the admin chooses what players are
 * offered. Saved changes apply to new tables only; running tables keep the settings they started with.
 */
export function GameSettingsAdmin({ gameId }: { gameId: string }) {
  const view = useApi<AdminGameSettingsView>(gameId ? `/admin/games/${gameId}/settings` : null);
  const toast = useToast();
  const [draft, setDraft] = useState<Current>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (view.data) setDraft(structuredClone(view.data.current)); }, [view.data]);

  const sup = view.data?.supported;
  const problems: string[] = [];
  if (draft) {
    if (!draft.paces.length) problems.push('حداقل یک حالت بازی');
    if (!draft.competitions.length) problems.push('حداقل یک نوع رقابت');
    if (draft.paces.includes('live') && !draft.liveSeconds.length) problems.push('حداقل یک زمان برای بازی زنده');
    if (draft.paces.includes('turn') && !draft.turnSeconds.length) problems.push('حداقل یک مهلت برای بازی نوبتی');
    if (draft.minPlayers > draft.maxPlayers) problems.push('حداقل بازیکن بیشتر از حداکثر است');
    for (const [k, o] of Object.entries(draft.options)) if (!o.allowed.length) problems.push(`حداقل یک گزینه برای «${sup?.options.find((x) => x.key === k)?.labelFa}»`);
  }

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      // Unused pace keeps a valid (non-empty) list so switching it back on later has sensible times.
      const body = { ...draft, liveSeconds: draft.liveSeconds.length ? draft.liveSeconds : [60], turnSeconds: draft.turnSeconds.length ? draft.turnSeconds : [86400], reason };
      await api(`/admin/games/${gameId}/settings`, { method: 'PUT', body });
      toast('success', 'تنظیمات بازی ذخیره شد؛ از میز بعدی اعمال می‌شود.');
      setReason('');
      view.reload();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); }
    finally { setBusy(false); }
  };

  const set = (patch: Partial<Current>) => setDraft((d) => d && { ...d, ...patch });
  const counts = sup ? Array.from({ length: sup.maxPlayers - sup.minPlayers + 1 }, (_, i) => sup.minPlayers + i) : [];
  const playerOptions = counts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }));

  return (
    <>
      <Card className="ac-sec" aria-labelledby="game-settings-h">
        <div className="ac-sec__head"><span className="ac-tile"><Icon name="sliders-horizontal" /></span><h2 id="game-settings-h" className="ac-h3">تنظیمات بازی</h2></div>
        <p className="ac-cap" style={{ padding: '14px 20px 0', textWrap: 'pretty' }}>
          حالت‌ها، تعداد بازیکن، زمان‌ها و گزینه‌های قانون. فقط گزینه‌هایی که خود بازی پشتیبانی می‌کند قابل انتخاب‌اند.
          تغییرات روی میزهای تازه اثر دارد؛ میزهای در جریان با تنظیمات شروع خود ادامه می‌دهند.
        </p>
        {view.error && <StateBlock kind="error" title="تنظیمات دریافت نشد" text={view.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={view.reload}>تلاش دوباره</Button>} />}
        {(!draft || !sup) && !view.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
        {draft && sup && (
          <>
            <Chips title="حالت بازی" label="حالت بازی" value={draft.paces} onChange={(paces) => set({ paces: paces as Current['paces'] })}
              options={sup.paces.map((p) => ({ value: p, label: PACE_FA[p] }))} />
            <Chips title="نوع رقابت" hint="رتبه‌دار فقط از حریف‌یابی ساخته می‌شود." label="نوع رقابت" value={draft.competitions} onChange={(competitions) => set({ competitions: competitions as Current['competitions'] })}
              options={sup.competitions.map((c) => ({ value: c, label: COMPETITION_FA[c] }))} />
            {counts.length > 1 && (
              <div className="ac-row" style={{ alignItems: 'flex-end' }}>
                <Select label="حداقل بازیکن" style={{ flex: '1 1 140px' }} value={String(draft.minPlayers)} onChange={(e) => set({ minPlayers: Number(e.target.value) })} options={playerOptions} />
                <Select label="حداکثر بازیکن" style={{ flex: '1 1 140px' }} value={String(draft.maxPlayers)} onChange={(e) => set({ maxPlayers: Number(e.target.value) })} options={playerOptions} />
              </div>
            )}
            {draft.paces.includes('live') && (
              <Chips title="زمان هر حرکت (زنده)" label="زمان زنده" value={draft.liveSeconds.map(String)} onChange={(v) => set({ liveSeconds: v.map(Number).sort((a, b) => a - b) })}
                options={sup.liveSeconds.map((s) => ({ value: String(s), label: durationFa(s) }))} />
            )}
            {draft.paces.includes('turn') && (
              <Chips title="مهلت هر نوبت (نوبتی)" label="زمان نوبتی" value={draft.turnSeconds.map(String)} onChange={(v) => set({ turnSeconds: v.map(Number).sort((a, b) => a - b) })}
                options={sup.turnSeconds.map((s) => ({ value: String(s), label: durationFa(s) }))} />
            )}
            {sup.options.map((o) => {
              const cur = draft.options[o.key] ?? { allowed: o.choices.map((c) => c.value), default: o.default, hostChooses: true };
              const idx = (v: OptValue) => String(o.choices.findIndex((c) => c.value === v));
              const update = (next: typeof cur) => set({ options: { ...draft.options, [o.key]: next } });
              const allowed = o.choices.filter((c) => cur.allowed.includes(c.value));
              return (
                <div key={o.key} className="ac-row ac-row--stack">
                  <section className="ac-opt" aria-labelledby={`opt-${o.key}-h`}>
                    <b id={`opt-${o.key}-h`} style={{ fontSize: 16, color: 'var(--heading)' }}>{o.labelFa}</b>
                    {o.descriptionFa && <p className="ac-cap" style={{ textWrap: 'pretty' }}>{o.descriptionFa}</p>}
                    <div className="ac-chiprow"><b style={{ fontSize: 14 }}>گزینه‌های مجاز</b>
                      <ChipGroup size="sm" label={`گزینه‌های مجاز ${o.labelFa}`} value={cur.allowed.map(idx)}
                        onChange={(v) => {
                          const next = o.choices.filter((_, i) => (v as string[]).includes(String(i))).map((c) => c.value);
                          update({ ...cur, allowed: next, default: next.includes(cur.default) ? cur.default : (next[0] ?? cur.default) });
                        }}
                        options={o.choices.map((c, i) => ({ value: String(i), label: c.labelFa }))} /></div>
                    {allowed.length > 0 && (
                      <Select label="پیش‌فرض" style={{ maxInlineSize: 280 }} value={idx(cur.default)} onChange={(e) => update({ ...cur, default: o.choices[Number(e.target.value)]!.value })}
                        options={allowed.map((c) => ({ value: idx(c.value), label: c.labelFa }))} />
                    )}
                    <Switch label="میزبان می‌تواند انتخاب کند" hint="خاموش: همه میزها با پیش‌فرض بالا ساخته می‌شوند." checked={cur.hostChooses} onChange={(hostChooses) => update({ ...cur, hostChooses })} />
                  </section>
                </div>
              );
            })}
          </>
        )}
      </Card>
      {draft && sup && (
        <Card className="ac-form">
          <TextField label="علت تغییر (در سابقه ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {problems.length > 0 && <Banner tone="warning" text={`لازم است: ${problems.join('، ')}`} />}
          <div className="bgv-row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setDraft(structuredClone(view.data!.current))}>بازگرداندن</Button>
            <Button variant="primary" icon="check" loading={busy} disabled={problems.length > 0 || reason.trim().length < 3} onClick={save}>ذخیره تنظیمات</Button>
          </div>
        </Card>
      )}
    </>
  );
}
