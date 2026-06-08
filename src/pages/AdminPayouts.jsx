import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/LeadOpsAuthContext';

const fmt = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function AdminPayouts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [clientId, setClientId] = useState('');
  const [model, setModel] = useState({ show_amount: '', booked_amount: '', sold_amount: '' });

  useQuery({
    queryKey: ['payout-model', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { payout_model } = await apiClient.getPayoutModel(clientId);
      setModel({
        show_amount: payout_model?.show_amount_cents != null ? String(payout_model.show_amount_cents / 100) : '',
        booked_amount: payout_model?.booked_amount_cents != null ? String(payout_model.booked_amount_cents / 100) : '',
        sold_amount: payout_model?.sold_amount_cents != null ? String(payout_model.sold_amount_cents / 100) : '',
      });
      return payout_model;
    },
  });

  const pending = useQuery({
    queryKey: ['payouts-pending', clientId],
    queryFn: () => apiClient.listPendingPayouts(clientId || undefined).then((d) => d.pending || []),
  });
  const payouts = useQuery({
    queryKey: ['payouts-list', clientId],
    queryFn: () => apiClient.listTeamPayouts({ client_id: clientId || undefined }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['payouts-pending'] });
    qc.invalidateQueries({ queryKey: ['payouts-list'] });
  };

  const saveMut = useMutation({
    mutationFn: () => apiClient.putPayoutModel(clientId, {
      show_amount_cents: model.show_amount ? Math.round(Number(model.show_amount) * 100) : null,
      booked_amount_cents: model.booked_amount ? Math.round(Number(model.booked_amount) * 100) : null,
      sold_amount_cents: model.sold_amount ? Math.round(Number(model.sold_amount) * 100) : null,
    }),
    onSuccess: () => { refresh(); toast.success('Payout model saved'); },
    onError: (err) => toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed'),
  });
  const approveMut = useMutation({
    mutationFn: (appointmentId) => apiClient.approvePayout(appointmentId),
    onSuccess: () => { refresh(); toast.success('Payout approved'); },
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });
  const paidMut = useMutation({
    mutationFn: (id) => apiClient.markPayoutPaid(id),
    onSuccess: () => { refresh(); toast.success('Marked paid'); },
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });
  const revokeMut = useMutation({
    mutationFn: (id) => apiClient.revokePayout(id),
    onSuccess: () => { refresh(); toast.success('Revoked'); },
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });

  const list = clients.data?.clients || [];
  const pendingRows = pending.data || [];
  const payoutRows = payouts.data?.payouts || [];
  const unpaid = payouts.data?.unpaid_balance || 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Team Payouts</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Client filter</CardTitle></CardHeader>
          <CardContent>
            <select className="border rounded h-9 px-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </CardContent>
        </Card>

        {isAdmin && clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payout model (per client)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5"><Label>Show ($)</Label>
                <Input type="number" value={model.show_amount} placeholder="100"
                  onChange={(e) => setModel((m) => ({ ...m, show_amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Booked add-on ($)</Label>
                <Input type="number" value={model.booked_amount}
                  onChange={(e) => setModel((m) => ({ ...m, booked_amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Sold add-on ($)</Label>
                <Input type="number" value={model.sold_amount}
                  onChange={(e) => setModel((m) => ({ ...m, sold_amount: e.target.value }))} /></div>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? 'Saving…' : 'Save model'}</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Pending approval ({pendingRows.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingRows.length === 0 && <div className="text-sm text-muted-foreground">No shows awaiting approval.</div>}
            {pendingRows.map((p) => (
              <div key={p.appointment_id} className="flex items-center justify-between text-sm border-b py-1.5">
                <span>Appt #{p.appointment_id} · {fmt(p.amount_cents)}</span>
                {isAdmin && (
                  <Button size="sm" variant="outline" disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate(p.appointment_id)}>Approve</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payouts · Unpaid balance: {fmt(unpaid)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payoutRows.length === 0 && <div className="text-sm text-muted-foreground">No payouts yet.</div>}
            {payoutRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b py-1.5">
                <span>Appt #{p.appointment_id} · {fmt(p.amount_cents)} · {p.status}</span>
                {isAdmin && p.status === 'approved' && (
                  <span className="flex gap-2">
                    <Button size="sm" disabled={paidMut.isPending} onClick={() => paidMut.mutate(p.id)}>Mark paid</Button>
                    <Button size="sm" variant="outline" disabled={revokeMut.isPending} onClick={() => revokeMut.mutate(p.id)}>Revoke</Button>
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
