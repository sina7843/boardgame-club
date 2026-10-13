import { Link } from 'react-router';
import { Gift, Link2 } from 'lucide-react';
import type { PublicProfile } from '@bg/contracts';
import { Button, buttonClass, useToast } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';

export interface Referral {
  code: string;
  reward: { inviterCoins: number; inviterDays: number; inviteeCoins: number; inviteeDays: number } | null;
  invited: { user: PublicProfile; createdAt: string; reward: { coins: number; days: number } | null }[];
}

export const referralUrl = (code: string) => `${location.origin}/login?ref=${code}`;
export const rewardFa = (coins: number, days: number) =>
  [coins > 0 && `${faNum(coins)} سکه`, days > 0 && `${faNum(days)} روز پریمیوم`].filter(Boolean).join(' و ');

export function useCopy() {
  const toast = useToast();
  return async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast('success', ok); }
    catch { toast('error', `کپی ممکن نشد؛ دستی کپی کنید: ${text}`); }
  };
}

/** «Invite your friends» call-to-action: copy the link right here, or open the full invite tab. Signed-in users only. */
export function InviteCard() {
  const data = useApi<Referral>('/me/referral');
  const copy = useCopy();
  if (!data.data) return null;
  const { code, reward, invited } = data.data;
  const mine = reward && rewardFa(reward.inviterCoins, reward.inviterDays);
  return (
    <section className="panel stack" aria-labelledby="invite-card-h" data-testid="invite-card">
      <h2 id="invite-card-h" className="section-title"><Gift className="size-5 text-primary" aria-hidden />دوستانت را دعوت کن</h2>
      <p className="muted" style={{ margin: 0 }}>
        هر کس با لینک تو عضو شود خودکار دوستت می‌شود{mine ? <> و تو <strong>{mine}</strong> هدیه می‌گیری</> : null}.
        {invited.length > 0 && <> تا حالا {faNum(invited.length)} نفر با لینک تو آمده‌اند.</>}
      </p>
      <div className="row">
        <Button onClick={() => copy(referralUrl(code), 'لینک دعوت کپی شد.')}><Link2 className="size-4" aria-hidden />کپی لینک دعوت</Button>
        <Link className={buttonClass('ghost', 'md')} to="/friends?tab=invite">دعوت‌شده‌ها و کد دعوت</Link>
      </div>
    </section>
  );
}
