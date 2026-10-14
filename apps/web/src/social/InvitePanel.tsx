import { useState } from 'react';
import type { PublicProfile } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button, Card, Identity, ListItem, Skeleton } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';

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
  const btn = (key: string, body: object, label = 'دعوت') => (
    <Button size="sm" variant="secondary" icon={sent.has(key) ? 'check' : 'user-plus'} disabled={sent.has(key)} onClick={() => invite(key, body)}>{sent.has(key) ? 'دعوت شد' : label}</Button>
  );
  return (
    <Card title="دعوت دوستان" aria-label="دعوت دوستان">
      <div className="bgv-stack" style={{ gap: 'var(--space-2)' }}>
        {friends.loading && !friends.data && <Skeleton lines={2} />}
        {friends.data && friends.data.friends.length === 0 && activeGroups.length === 0 && <p className="t-caption bgv-muted" style={{ margin: 0 }}>هنوز دوست یا گروهی ندارید؛ از لینک دعوت استفاده کنید.</p>}
        {friends.data?.friends.map((f) => <Identity key={f.id} {...userIdentity(f)} trailing={btn(f.id, { userId: f.id })} />)}
        {activeGroups.map((g) => <ListItem key={g.id} icon="users" title={<>گروه <bdi>{g.name}</bdi></>} trailing={btn(g.id, { groupId: g.id }, 'دعوت همه')} />)}
      </div>
    </Card>
  );
}
