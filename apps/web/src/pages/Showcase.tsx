import { useState, type ReactNode } from 'react';
import {
  Avatar, Badge, Banner, BannerArt, Breadcrumbs, Button, Card, Checkbox, Chip, ChipGroup, Clock, Coin, Connection, CosmeticTile, DataTable, Dialog, Divider, Frame, GameCard,
  Hero, Icon, Identity, League, ListItem, Menu, Message, NotificationItem, OtpField, PageHead, PageTabs, Pagination, PhoneField, Popover, Progress, Radio, Rarity, Ring, Segmented,
  Select, Seat, Skeleton, Spectators, Stat, StateBlock, Strikes, Switch, Tabs, Tag, TextField, Textarea, Toast, Trophy, TurnPill, Logo, Composer
} from '@bg/ui/bgv';
import { usePrefs } from '../lib/prefs.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

// Living design reference: every design-system component rendered with real props. Sample data is visibly labelled as sample.
const TOKENS = ['--bg', '--surface', '--surface-raised', '--surface-sunken', '--surface-chrome', '--text', '--text-muted', '--heading', '--label', '--line', '--primary', '--invite', '--accent',
  '--success', '--warning', '--danger', '--info', '--felt', '--coin', '--seat-1', '--seat-2', '--seat-3', '--seat-4', '--seat-5'];

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="ac-show__sec" aria-labelledby={id}><h2 id={id} className="ac-h2">{title}</h2>{children}</section>;
}
const Row = ({ children }: { children: ReactNode }) => <div className="ac-show__row">{children}</div>;

export function Showcase() {
  usePageTitle('اجزای طراحی');
  const { prefs, update } = usePrefs();
  const [seg, setSeg] = useState('a');
  const [sw, setSw] = useState(true);
  const [chip, setChip] = useState<string | string[]>('a');
  const [tab, setTab] = useState('rules');
  const [page, setPage] = useState(3);
  const [code, setCode] = useState('');

  return (
    <div className="ac-show">
      <PageHead title="اجزای طراحی" sub="مرجع زنده بردگیم‌ورس: هر گروه از اجزای مشترک با داده‌های نمونه. پوسته را از اینجا عوض کنید."
        actions={<Segmented label="پوسته" value={prefs.theme} onChange={(theme) => update({ theme: theme as typeof prefs.theme })}
          options={[{ value: 'light', label: 'روشن', icon: 'eye' }, { value: 'dark', label: 'تیره', icon: 'moon' }, { value: 'system', label: 'دستگاه' }]} />} />

      <Sec id="brand-h" title="برند">
        <Row><Logo src="/brand/logo-fa-primary.svg" srcDark="/brand/logo-fa-reversed.svg" height={40} /><Logo src="/brand/symbol-primary-small.svg" srcDark="/brand/symbol-reversed-small.svg" height={40} alt="نماد" /></Row>
      </Sec>

      <Sec id="tok-h" title="رنگ‌ها و نوشتار">
        <div className="ac-swatches">{TOKENS.map((t) => <div key={t} className="ac-swatch"><i style={{ background: `var(${t})` }} /><bdi dir="ltr">{t}</bdi></div>)}</div>
        <Card>
          <p className="t-page" style={{ margin: 0 }}>تیتر صفحه</p><p className="t-h3" style={{ margin: 0 }}>تیتر بخش</p><p className="t-body" style={{ margin: 0 }}>متن اصلی با رنگ و اندازهٔ استاندارد.</p>
          <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>متن کوچک و کم‌رنگ</p><p className="t-num-lg" style={{ margin: 0 }}>۱٬۲۳۴٫۵</p>
        </Card>
      </Sec>

      <Sec id="act-h" title="دکمه و چیپ">
        <Row><Button variant="primary">اصلی</Button><Button>ثانویه</Button><Button variant="ghost">کم‌رنگ</Button><Button variant="leave">خروج از حساب</Button><Button variant="danger">حذف</Button>
          <Button variant="primary" loading>در حال ارسال</Button><Button disabled>غیرفعال</Button><Button size="sm" icon="play">کوچک</Button><Button size="lg" variant="primary" icon="zap">بزرگ</Button>
          <Button iconOnly icon="settings">تنظیمات</Button><Button count={3} icon="bell">اعلان‌ها</Button></Row>
        <Row><ChipGroup label="چیپ‌ها" value={chip} onChange={setChip} options={[{ value: 'a', label: 'همه', count: 12 }, { value: 'b', label: 'زنده', icon: 'zap' }, { value: 'c', label: 'نوبتی' }]} />
          <Chip variant="invite" icon="plus">دعوت</Chip></Row>
      </Sec>

      <Sec id="inp-h" title="ورودی‌ها">
        <div className="ac-grid2">
          <TextField label="فیلد متن" placeholder="متن" hint="راهنمای فیلد" icon="search" />
          <TextField label="فیلد با خطا" defaultValue="؟" error="این مقدار معتبر نیست." />
          <PhoneField label="شماره موبایل" hint="مثل ۹۱۲۳۴۵۶۷۸۹" />
          <Select label="انتخابگر" options={[{ value: '1', label: 'گزینه یک' }, { value: '2', label: 'گزینه دو' }]} />
          <Textarea label="متن چندخطی" rows={2} />
          <div className="ac-stack"><OtpField label="کد تأیید" value={code} onChange={setCode} /></div>
        </div>
        <Row><Segmented label="گزینه‌ها" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'الف' }, { value: 'b', label: 'ب' }, { value: 'c', label: 'پ' }]} />
          <Switch label="کلید" checked={sw} onChange={setSw} /><Switch label="غیرفعال" checked={false} disabled />
          <Checkbox label="چک‌باکس" defaultChecked /><Radio name="rd" label="رادیو" defaultChecked /></Row>
      </Sec>

      <Sec id="disp-h" title="نمایش">
        <Row><Badge>معمولی</Badge><Badge tone="you">شما</Badge><Badge tone="success" icon="check">فعال</Badge><Badge tone="warning">هشدار</Badge><Badge tone="danger" icon="ban">متوقف</Badge>
          <Badge tone="info">اطلاع</Badge><Badge tone="premium" icon="crown">پریمیوم</Badge><Badge tone="test">آزمایشی</Badge><Badge tone="count">۵</Badge><Tag>برچسب</Tag><Tag latin>Catan</Tag><Rarity level="epic" /></Row>
        <Row><Coin amount={2480} /><Coin amount={2480} size="lg" unit /><Coin chip amount={2480} href="/coins" /></Row>
        <Row><Avatar initials="م" size="sm" /><Avatar initials="م" you /><Avatar initials="ن" seat={3} status="online" /><Avatar initials="ر" size="lg" />
          <Frame tier="gold" avatar={{ initials: 'ا', size: 'lg' }} /><Seat n={1} label /><Seat n={2} /><Seat n={5} size="lg" /></Row>
        <Row><Identity name="مینا" initials="م" you league="gold" level={18} title="استاد معامله" /><Identity name="نیلوفر" initials="ن" seat={2} status="online" sub="آنلاین" /></Row>
        <Row>{(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const).map((l) => <League key={l} tier={l} />)}</Row>
        <div className="ac-grid2"><Stat label="بازی‌ها" value={128} delta={12} deltaText="این هفته" /><Stat label="امتیاز" value="۱٬۲۰۰" delta={-4} /></div>
        <div className="ac-grid2"><Progress label="پیشرفت" value={0.6} valueText="۶ از ۱۰" /><Row><Ring value={0.7} label="هفتاد درصد">۷۰٪</Ring><Skeleton circle width={40} /><Skeleton lines={3} width="60%" /></Row></div>
        <Card flush><DataTable caption="جدول نمونه" columns={[{ key: 'n', label: 'رتبه', strong: true }, { key: 'name', label: 'نام' }, { key: 'v', label: 'امتیاز', align: 'end' }]}
          rows={[{ n: '۱', name: 'نمونه الف', v: '۱۲' }, { n: '۲', name: 'مینا', v: '۹', you: true }]} /></Card>
        <Card flush><ListItem icon="bell" title="عنوان فهرست" sub="توضیح کوتاه" trailing={<Badge tone="count">۲</Badge>} /><ListItem icon="settings" title="تنظیمات" href="/settings" /></Card>
        <Divider label="جداکننده" />
      </Sec>

      <Sec id="nav-h" title="ناوبری">
        <PageTabs label="زبانه‌های صفحه" items={[{ value: 'rules', label: 'قوانین' }, { value: 'learn', label: 'آموزش', count: 2 }, { value: 'log', label: 'تاریخچه' }]} value={tab} onChange={setTab} />
        <Tabs label="زبانه" items={[{ value: 'rules', label: 'قوانین', icon: 'book-open' }, { value: 'learn', label: 'آموزش' }]} value={tab} onChange={setTab} />
        <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: 'بازی‌ها', href: '/games' }, { label: 'کاتان' }]} />
        <Pagination page={page} pages={8} onChange={setPage} />
        <Menu label="منو" items={[{ icon: 'pencil', label: 'ویرایش' }, { icon: 'copy', label: 'کپی', meta: 'Ctrl+C' }, '-', { icon: 'trash-2', label: 'حذف', danger: true }]} />
      </Sec>

      <Sec id="card-h" title="کارت و سرصفحه">
        <div className="bgv-grid bgv-grid--sm">
          <GameCard title="کاتان" latin="Catan" cover="/covers/catan.webp?v=2" meta={[{ icon: 'users', text: '۳ تا ۴ نفر' }, { icon: 'clock', text: '۶۰ دقیقه' }]} flags={[{ tone: 'premium', icon: 'crown', label: 'پریمیوم' }]} href="/games/catan" />
          <Card title="کارت با عنوان" actions={<Button size="sm" variant="ghost">همه</Button>}><p className="t-body-sm" style={{ margin: 0 }}>محتوای کارت.</p></Card>
          <Card raised><p className="t-body-sm" style={{ margin: 0 }}>کارت برجسته.</p></Card>
        </div>
        <Hero eyebrow="نمونه" title="سر میز، با همه." text="کارت قهرمان با پس‌زمینهٔ نمد." actions={<Button variant="primary">شروع</Button>} />
        <BannerArt variant="felt" height={80} />
      </Sec>

      <Sec id="ov-h" title="پنجره و پیام‌ها">
        <Dialog title="تأیید حرکت" icon="circle-help" onClose={() => undefined} footer={<><Button>انصراف</Button><Button variant="primary">تأیید</Button></>}>حرکت قطعی حساس پیش از ارسال تأیید می‌گیرد.</Dialog>
        <Dialog title="حذف همیشگی" danger icon="trash-2" footer={<><Button>انصراف</Button><Button variant="danger">حذف</Button></>}>این کار برگشت‌پذیر نیست.</Dialog>
        <Popover title="پاپ‌اور">متن کوتاه شناور.</Popover>
        <Banner tone="info" text="اطلاعیه" /><Banner tone="success" text="موفق" /><Banner tone="warning" text="هشدار" /><Banner tone="danger" text="خطا" />
        <Toast title="نوبت شماست" text="در کاتان" tone="turn" /><Toast title="پیام" text="ذخیره شد." />
        <NotificationItem kind="turn" icon="bell-ring" title="نوبت شماست" text="کاتان" time="الان" unread />
      </Sec>

      <Sec id="state-h" title="حالت‌های صفحه">
        <div className="ac-grid2">
          {(['loading', 'empty', 'error', 'denied', 'offline'] as const).map((k) => <Card key={k}><StateBlock kind={k} text="توضیح کوتاه و راه رفع." /></Card>)}
        </div>
      </Sec>

      <Sec id="table-h" title="میز: ساعت و وضعیت">
        <Row><Clock time={95} state="calm" p={0.8} sub="زمان شما" /><Clock time={30} state="warn" p={0.4} /><Clock time={6} state="critical" p={0.1} /><Clock time={60} state="paused" /></Row>
        <TurnPill who="نیلوفر" seat={2} initials="ن" clock={{ time: 45, p: 0.6 }} /><TurnPill mine initials="م" clock={{ time: 20, p: 0.2 }} />
        <Row><Strikes used={1} showLabel /><Connection state="ok" /><Connection state="retry" /><Spectators count={4} showLabel /></Row>
      </Sec>

      <Sec id="chat-h" title="گفت‌وگو">
        <Card><div className="ac-stack"><Message author="نیلوفر" initials="ن" seat={2} time="۱۸:۴۲" text="سلام، آماده‌اید؟" /><Message mine author="مینا" initials="م" time="۱۸:۴۳" text="بله!" seen />
          <Composer placeholder="پیام…" /></div></Card>
      </Sec>

      <Sec id="prof-h" title="پروفایل و فروشگاه">
        <Row><Trophy tier="gold" name="اولین برد" sub="۱ از ۱" /><Trophy tier="silver" locked name="قفل" sub="۳۲ از ۵۰" />
          <CosmeticTile art={<Icon name="crown" size="lg" />} name="تاج" state="owned" rarity="rare" /><CosmeticTile art={<Icon name="star" size="lg" />} name="ستاره" state="locked" price={200} /></Row>
      </Sec>
    </div>
  );
}
