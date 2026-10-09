import { useEffect, useState } from 'react';
import type { AdminGameSettingsView } from '@bg/contracts';
import { Button, CheckChips, Input, Select, StateBlock, Switch, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { COMPETITION_FA, durationFa, faNum, PACE_FA } from '../lib/format.ts';

type Current = AdminGameSettingsView['current'];
type OptValue = string | number | boolean;

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
    <section className="panel stack" aria-labelledby="game-settings-h">
      <h2 id="game-settings-h" className="section-title">تنظیمات بازی</h2>
      <p className="muted" style={{ margin: 0 }}>
        حالت‌ها، تعداد بازیکن، زمان‌ها و گزینه‌های قانون. فقط گزینه‌هایی که خود بازی پشتیبانی می‌کند قابل انتخاب‌اند.
        تغییرات روی میزهای تازه اثر دارد؛ میزهای در جریان با تنظیمات شروع خود ادامه می‌دهند.
      </p>
      {view.error && <StateBlock kind="error" title="تنظیمات دریافت نشد" action={<Button onClick={view.reload}>تلاش دوباره</Button>}>{view.error.messageFa}</StateBlock>}
      {(!draft || !sup) && !view.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
      {draft && sup && (
        <div className="stack">
          <CheckChips legend="حالت بازی" values={draft.paces} onChange={(paces) => set({ paces })}
            options={sup.paces.map((p) => ({ value: p, label: PACE_FA[p] }))} />
          <CheckChips legend="نوع رقابت" hint="رتبه‌دار فقط از حریف‌یابی ساخته می‌شود." values={draft.competitions} onChange={(competitions) => set({ competitions })}
            options={sup.competitions.map((c) => ({ value: c, label: COMPETITION_FA[c] }))} />
          {counts.length > 1 && (
            <div className="row" style={{ alignItems: 'end' }}>
              <div style={{ minInlineSize: 140 }}><Select label="حداقل بازیکن" value={String(draft.minPlayers)} onChange={(e) => set({ minPlayers: Number(e.target.value) })} options={playerOptions} /></div>
              <div style={{ minInlineSize: 140 }}><Select label="حداکثر بازیکن" value={String(draft.maxPlayers)} onChange={(e) => set({ maxPlayers: Number(e.target.value) })} options={playerOptions} /></div>
            </div>
          )}
          {draft.paces.includes('live') && (
            <CheckChips legend="زمان هر حرکت (زنده)" values={draft.liveSeconds.map(String)} onChange={(v) => set({ liveSeconds: v.map(Number).sort((a, b) => a - b) })}
              options={sup.liveSeconds.map((s) => ({ value: String(s), label: durationFa(s) }))} />
          )}
          {draft.paces.includes('turn') && (
            <CheckChips legend="مهلت هر نوبت (نوبتی)" values={draft.turnSeconds.map(String)} onChange={(v) => set({ turnSeconds: v.map(Number).sort((a, b) => a - b) })}
              options={sup.turnSeconds.map((s) => ({ value: String(s), label: durationFa(s) }))} />
          )}
          {sup.options.map((o) => {
            const cur = draft.options[o.key] ?? { allowed: o.choices.map((c) => c.value), default: o.default, hostChooses: true };
            const idx = (v: OptValue) => String(o.choices.findIndex((c) => c.value === v));
            const update = (next: typeof cur) => set({ options: { ...draft.options, [o.key]: next } });
            const allowed = o.choices.filter((c) => cur.allowed.includes(c.value));
            return (
              <section key={o.key} className="panel stack" style={{ margin: 0, background: 'var(--surface-2)' }} aria-labelledby={`opt-${o.key}-h`}>
                <h3 id={`opt-${o.key}-h`} className="section-title" style={{ fontSize: 'var(--fs-md)', margin: 0 }}>{o.labelFa}</h3>
                {o.descriptionFa && <p className="muted" style={{ margin: 0 }}>{o.descriptionFa}</p>}
                <CheckChips legend="گزینه‌های مجاز" values={cur.allowed.map(idx)}
                  onChange={(v) => {
                    const next = o.choices.filter((_, i) => v.includes(String(i))).map((c) => c.value);
                    update({ ...cur, allowed: next, default: next.includes(cur.default) ? cur.default : (next[0] ?? cur.default) });
                  }}
                  options={o.choices.map((c, i) => ({ value: String(i), label: c.labelFa }))} />
                {allowed.length > 0 && (
                  <Select label="پیش‌فرض" value={idx(cur.default)} onChange={(e) => update({ ...cur, default: o.choices[Number(e.target.value)]!.value })}
                    options={allowed.map((c) => ({ value: idx(c.value), label: c.labelFa }))} />
                )}
                <Switch label="میزبان می‌تواند انتخاب کند" hint="خاموش: همه میزها با پیش‌فرض بالا ساخته می‌شوند." checked={cur.hostChooses} onChange={(hostChooses) => update({ ...cur, hostChooses })} />
              </section>
            );
          })}
          <Input label="علت تغییر (در سابقه ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {problems.length > 0 && <div className="banner banner--warn" role="status" style={{ margin: 0 }}>لازم است: {problems.join('، ')}</div>}
          <div className="row">
            <Button busy={busy} disabled={problems.length > 0 || reason.trim().length < 3} onClick={save}>ذخیره تنظیمات</Button>
            <Button variant="ghost" onClick={() => setDraft(structuredClone(view.data!.current))}>بازگرداندن</Button>
          </div>
        </div>
      )}
    </section>
  );
}
