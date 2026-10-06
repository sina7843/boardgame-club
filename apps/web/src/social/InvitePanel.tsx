import { useState } from 'react';
import type { PublicProfile } from '@bg/contracts';
import { Avatar, Button, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';

/** Invite friends or a whole group to an open table. Server checks friendship/community, blocks and seats. */
export function InvitePanel({ tableId }: { tableId: string }) {
  const toast = useToast();
  const friends = useApi<{ friends: PublicProfile[] }>('/me/friends');
  const groups = useApi<{ items: { id: string; name: string; myStatus: string }[] }>('/me/groups');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const invite = async (key: string, body: object) => {
    try {
      const r = await api<{ invited: number }>(`/tables/${tableId}/invites`, { method: 'POST', body });
      setSent((s) => new Set(s).add(key));
      toast('success', r.invited ? `دعوت برای ${r.invited.toLocaleString('fa-IR')} نفر فرستاده شد.` : 'کسی برای دعوت باقی نماند.');
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'دعوت انجام نشد.'); }
  };
  const activeGroups = groups.data?.items.filter((g) => g.myStatus === 'active') ?? [];
  return (
    <section className="panel stack" aria-labelledby="invite-h" style={{ gap: 'var(--sp-2)' }}>
      <h2 id="invite-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>دعوت دوستان</h2>
      {friends.loading && !friends.data && <p className="muted" role="status">در حال بارگذاری…</p>}
      {friends.data && friends.data.friends.length === 0 && activeGroups.length === 0 && <p className="muted" style={{ margin: 0 }}>هنوز دوست یا گروهی ندارید؛ از لینک دعوت استفاده کنید.</p>}
      <ul className="list">
        {friends.data?.friends.map((f) => (
          <li key={f.id} className="list__item list__item--compact">
            <Avatar avatarKey={f.avatarKey} name={f.displayName} size={32} />
            <bdi style={{ flex: 1 }}>{f.displayName}</bdi>
            <Button size="sm" variant="secondary" disabled={sent.has(f.id)} onClick={() => invite(f.id, { userId: f.id })}>{sent.has(f.id) ? 'دعوت شد' : 'دعوت'}</Button>
          </li>
        ))}
        {activeGroups.map((g) => (
          <li key={g.id} className="list__item list__item--compact">
            <span style={{ flex: 1 }}>گروه {g.name}</span>
            <Button size="sm" variant="secondary" disabled={sent.has(g.id)} onClick={() => invite(g.id, { groupId: g.id })}>{sent.has(g.id) ? 'دعوت شد' : 'دعوت همه'}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
