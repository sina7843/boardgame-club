import { StateBlock } from '@bg/ui/bgv';

/** A page that needs an account, reached by a guest from the dock or the header (design system «guest» state). */
export function GuestState({ title, text, next }: { title: string; text: string; next: string }) {
  return (
    <StateBlock kind="guest" title={title} text={text} loginHref={`/login?next=${encodeURIComponent(next)}`} quickHref="/play"
      perks={[{ icon: 'message-circle', title: 'گفت‌وگو با دوستان' }, { icon: 'dices', title: 'میزهای نوبتی و زنده' }, { icon: 'trophy', title: 'رتبه، لیگ و پیشرفت' }]} />
  );
}
