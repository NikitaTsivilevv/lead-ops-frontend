import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

const fmt = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
// Today's date in America/New_York (en-CA formats as YYYY-MM-DD) — matches the backend's ET bucketing.
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function AdminClientBalance() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [clientId, setClientId] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [pay, setPay] = useState({ paid_on: today(), amount: '', note: '' });
  const [buy, setBuy] = useState({ purchased_on: today(), quantity: '', note: '' });

  const balance = useQuery({
    queryKey: ['client-balance', clientId, asOf],
    enabled: !!clientId,
    queryFn: () => apiClient.getClientBalance(clientId, asOf),
  });
  const payments = useQuery({
    queryKey: ['client-payments', clientId],
    enabled: !!clientId,
    queryFn: () => apiClient.listClientPayments(clientId).then((d) => d.payments || []),
  });
  const purchases = useQuery({
    queryKey: ['client-purchases', clientId],
    enabled: !!clientId,
    queryFn: () => apiClient.listClientPurchases(clientId).then((d) => d.purchases || []),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['client-balance'] });
    qc.invalidateQueries({ queryKey: ['client-payments'] });
    qc.invalidateQueries({ queryKey: ['client-purchases'] });
  };
  const onErr = (err) => toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed');

  const addPayMut = useMutation({
    mutationFn: () => apiClient.addClientPayment(clientId, {
      paid_on: pay.paid_on, amount_cents: Math.round(Number(pay.amount) * 100),
      note: pay.note || undefined,
    }),
    onSuccess: () => { refresh(); setPay({ paid_on: today(), amount: '', note: '' }); toast.success('Payment added'); },
    onError: onErr,
  });
  const delPayMut = useMutation({
    mutationFn: (id) => apiClient.deleteClientPayment(clientId, id),
    onSuccess: () => { refresh(); toast.success('Payment deleted'); }, onError: onErr,
  });
  const addBuyMut = useMutation({
    mutationFn: () => apiClient.addClientPurchase(clientId, {
      purchased_on: buy.purchased_on, quantity: Math.round(Number(buy.quantity)),
      note: buy.note || undefined,
    }),
    onSuccess: () => { refresh(); setBuy({ purchased_on: today(), quantity: '', note: '' }); toast.success('Purchase added'); },
    onError: onErr,
  });
  const delBuyMut = useMutation({
    mutationFn: (id) => apiClient.deleteClientPurchase(clientId, id),
    onSuccess: () => { refresh(); toast.success('Purchase deleted'); }, onError: onErr,
  });

  const list = clients.data?.clients || [];
  const b = balance.data;
  const moneyOwes = b && b.money_balance_cents < 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Client Balance</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Client & as-of</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <select className="border rounded h-9 px-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select a client</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="space-y-1.5"><Label>As of</Label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          </CardContent>
        </Card>

        {clientId && b && (
          <Card>
            <CardHeader><CardTitle className="text-base">Balance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>Collected<br /><span className="text-lg font-semibold">{fmt(b.collected_cents)}</span></div>
              <div>Owed (revenue)<br /><span className="text-lg font-semibold">{fmt(b.owed_cents)}</span></div>
              <div>Money balance<br /><span className={`text-lg font-semibold ${moneyOwes ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(b.money_balance_cents)} {moneyOwes ? '(owes us)' : '(prepaid credit)'}</span></div>
              <div>Purchased<br /><span className="text-lg font-semibold">{b.purchased}</span></div>
              <div>Delivered (shows)<br /><span className="text-lg font-semibold">{b.delivered}</span></div>
              <div>Appointment balance<br /><span className="text-lg font-semibold">{b.appointment_balance}</span></div>
            </CardContent>
          </Card>
        )}

        {clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1.5"><Label>Date</Label>
                  <Input type="date" value={pay.paid_on} onChange={(e) => setPay((s) => ({ ...s, paid_on: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Amount ($)</Label>
                  <Input type="number" value={pay.amount} onChange={(e) => setPay((s) => ({ ...s, amount: e.target.value }))} /></div>
                <div className="space-y-1.5 flex-1"><Label>Note</Label>
                  <Input value={pay.note} onChange={(e) => setPay((s) => ({ ...s, note: e.target.value }))} /></div>
                <Button onClick={() => addPayMut.mutate()} disabled={addPayMut.isPending || !pay.amount}>Add</Button>
              </div>
              {(payments.data || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b py-1.5">
                  <span>{p.paid_on} · {fmt(p.amount_cents)}{p.note ? ` · ${p.note}` : ''}</span>
                  <Button size="sm" variant="outline" disabled={delPayMut.isPending} onClick={() => delPayMut.mutate(p.id)}>Delete</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Appointment purchases</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1.5"><Label>Date</Label>
                  <Input type="date" value={buy.purchased_on} onChange={(e) => setBuy((s) => ({ ...s, purchased_on: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Quantity</Label>
                  <Input type="number" value={buy.quantity} onChange={(e) => setBuy((s) => ({ ...s, quantity: e.target.value }))} /></div>
                <div className="space-y-1.5 flex-1"><Label>Note</Label>
                  <Input value={buy.note} onChange={(e) => setBuy((s) => ({ ...s, note: e.target.value }))} /></div>
                <Button onClick={() => addBuyMut.mutate()} disabled={addBuyMut.isPending || !buy.quantity}>Add</Button>
              </div>
              {(purchases.data || []).map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm border-b py-1.5">
                  <span>{q.purchased_on} · {q.quantity} appts{q.note ? ` · ${q.note}` : ''}</span>
                  <Button size="sm" variant="outline" disabled={delBuyMut.isPending} onClick={() => delBuyMut.mutate(q.id)}>Delete</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
