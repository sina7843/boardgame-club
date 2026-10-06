import { useState } from 'react';
import type { GameSummary } from '@bg/contracts';
import {
  Avatar, Badge, Button, DataTable, Dialog, Drawer, Input, LeagueBadge, Progress, Segmented, Select, StateBlock, Switch, Tabs, Timer, useToast
} from '@bg/ui';
import { GameCard } from '../games/GameCard.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

// Living design reference: every shared token and component rendered with real props.
// Sample data below is visibly labelled as sample; it is never presented as user data.
const SAMPLE_GAME: GameSummary = {
  id: 'line-three', nameFa: 'سه‌خطی (نمونه)', nameOriginal: 'Line Three', summaryFa: '', minPlayers: 2, maxPlayers: 2,
  minMinutes: 2, maxMinutes: 5, difficulty: 'easy', access: 'free', paces: ['live', 'turn'], competitions: ['friendly'], isTestGame: true, status: 'active', tutorialEnabled: true,
  liveSeconds: [60], turnSeconds: [86400]
};
const TOKENS = ['--bg', '--surface', '--surface-2', '--text', '--text-2', '--brand', '--action', '--gold', '--success', '--warning', '--danger', '--focus'];

export function Showcase() {
  usePageTitle('اجزای طراحی');
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [sw, setSw] = useState(true);
  const [deadline] = useState(() => new Date(Date.now() + 95_000));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">اجزای طراحی</h1>
          <p className="page-sub">مرجع زنده متغیرها و اجزای مشترک؛ داده‌های این صفحه نمونه هستند.</p>
        </div>
      </div>

      <section className="section" aria-labelledby="tok-h">
        <h2 id="tok-h" className="section-title">رنگ‌ها</h2>
        <div className="swatches">
          {TOKENS.map((t) => (
            <div key={t} className="swatch">
              <div className="swatch__color" style={{ background: `var(${t})` }} />
              <div className="swatch__meta"><bdi dir="ltr">{t}</bdi></div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="btn-h">
        <h2 id="btn-h" className="section-title">دکمه</h2>
        <div className="row">
          <Button onClick={() => toast('success', 'پیام موفقیت نمونه.')}>اقدام اصلی</Button>
          <Button variant="secondary" onClick={() => toast('info', 'پیام اطلاع نمونه.')}>ثانویه</Button>
          <Button variant="ghost" onClick={() => toast('error', 'پیام خطای نمونه.')}>کم‌رنگ</Button>
          <Button variant="danger">خطرناک</Button>
          <Button busy>در حال ارسال</Button>
          <Button disabled>غیرفعال</Button>
          <Button size="sm" icon="play">کوچک</Button>
        </div>
      </section>

      <section className="section" aria-labelledby="form-h">
        <h2 id="form-h" className="section-title">فیلد و انتخابگر</h2>
        <div className="grid-cards">
          <Input label="فیلد متن" placeholder="متن" hint="راهنمای فیلد" />
          <Input label="فیلد با خطا" defaultValue="؟" error="این مقدار معتبر نیست." />
          <Select label="انتخابگر" options={[{ value: '1', label: 'گزینه یک' }, { value: '2', label: 'گزینه دو' }]} />
        </div>
        <div className="row">
          <Segmented legend="گزینه‌های هم‌ارز" name="sample-seg" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'الف' }, { value: 'b', label: 'ب' }]} />
          <div style={{ minInlineSize: 260 }}><Switch label="کلید" hint="روشن / خاموش" checked={sw} onChange={setSw} /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="tabs-h">
        <h2 id="tabs-h" className="section-title">تب</h2>
        <Tabs label="تب نمونه" tabs={[
          { id: 'a', title: 'قوانین', content: <p style={{ margin: 0 }}>محتوای تب اول. با کلیدهای جهت جابه‌جا شوید.</p> },
          { id: 'b', title: 'آموزش', content: <p style={{ margin: 0 }}>محتوای تب دوم.</p> },
          { id: 'c', title: 'تاریخچه', content: <p style={{ margin: 0 }}>محتوای تب سوم.</p> }
        ]} />
      </section>

      <section className="section" aria-labelledby="status-h">
        <h2 id="status-h" className="section-title">نشان، پیشرفت، تایمر و نماد</h2>
        <div className="row">
          <Badge>معمولی</Badge><Badge tone="test" icon="alert">بازی آزمایشی</Badge><Badge tone="premium">پریمیوم</Badge>
          <Badge tone="success">فعال</Badge><Badge tone="danger">متوقف</Badge>
        </div>
        <div className="row">{(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const).map((l) => <LeagueBadge key={l} league={l} />)}</div>
        <div style={{ maxInlineSize: 420 }}><Progress label="پیشرفت نمونه" value={7} max={10} /></div>
        <div className="row"><Timer deadline={deadline} /><span className="muted">شمارش نمونه؛ در میز، موعد از سرور می‌آید.</span></div>
        <div className="row">{['meeple', 'dice', 'crown', 'pawn', 'card', 'star'].map((k) => <Avatar key={k} avatarKey={k} name={k} />)}</div>
      </section>

      <section className="section" aria-labelledby="card-h">
        <h2 id="card-h" className="section-title">کارت بازی</h2>
        <div className="grid-cards" style={{ maxInlineSize: 360 }}><GameCard game={SAMPLE_GAME} /></div>
      </section>

      <section className="section" aria-labelledby="table-h">
        <h2 id="table-h" className="section-title">جدول</h2>
        <DataTable caption="جدول نمونه" rowKey={(r) => r.n} rows={[{ n: '۱', name: 'نمونه الف', v: '۱۲' }, { n: '۲', name: 'نمونه ب', v: '۹' }]}
          columns={[{ key: 'n', title: 'رتبه', render: (r) => r.n }, { key: 'name', title: 'نام', render: (r) => r.name }, { key: 'v', title: 'امتیاز', render: (r) => r.v }]} />
      </section>

      <section className="section" aria-labelledby="ov-h">
        <h2 id="ov-h" className="section-title">پنجره و کشو</h2>
        <div className="row">
          <Button variant="secondary" onClick={() => setDialog(true)}>باز کردن پنجره</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>باز کردن کشو</Button>
        </div>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="تأیید حرکت" footer={<><Button variant="ghost" onClick={() => setDialog(false)}>انصراف</Button><Button onClick={() => setDialog(false)}>تأیید</Button></>}>
          حرکت قطعی حساس پیش از ارسال تأیید می‌گیرد.
        </Dialog>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="چت و تاریخچه">کشوی کناری برای ابزارهای جمع‌شونده میز در موبایل.</Drawer>
      </section>

      <section className="section" aria-labelledby="states-h">
        <h2 id="states-h" className="section-title">حالت‌های صفحه</h2>
        <div className="grid-cards">
          <div className="panel"><StateBlock kind="loading" title="بارگذاری" /></div>
          <div className="panel"><StateBlock kind="empty" title="خالی">موردی وجود ندارد.</StateBlock></div>
          <div className="panel"><StateBlock kind="error" title="خطا">توضیح خطا و راه رفع.</StateBlock></div>
          <div className="panel"><StateBlock kind="offline" title="قطع اتصال">پس از اتصال دوباره به‌روز می‌شود.</StateBlock></div>
          <div className="panel"><StateBlock kind="denied" title="دسترسی ناکافی">این بخش برای نقش شما نیست.</StateBlock></div>
        </div>
      </section>
    </>
  );
}
