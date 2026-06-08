import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

const now = new Date();
const fmt = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function AdminBilling() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [clientId, setClientId] = useState('');
  const [model, setModel] = useState({ per_event_trigger: 'show', per_event_amount: '', sale_percentage: '', combine_mode: 'single' });
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  // Load the selected client's existing model into the form.
  useQuery({
    queryKey: ['billing-model', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { billing_model } = await apiClient.getBillingModel(clientId);
      if (billing_model) {
        setModel({
          per_event_trigger: billing_model.per_event_trigger || 'show',
          per_event_amount: billing_model.per_event_amount_cents != null ? String(billing_model.per_event_amount_cents / 100) : '',
          sale_percentage: billing_model.sale_percentage != null ? String(billing_model.sale_percentage) : '',
          combine_mode: billing_model.combine_mode || 'single',
        });
      }
      return billing_model;
    },
  });

  const revenue = useQuery({
    queryKey: ['revenue', clientId, period.year, period.month],
    enabled: !!clientId,
    queryFn: () => apiClient.getRevenue({ client_id: clientId, year: period.year, month: period.month }).then((d) => d.revenue),
  });

  const saveMut = useMutation({
    mutationFn: () => apiClient.putBillingModel(clientId, {
      per_event_trigger: model.per_event_amount ? model.per_event_trigger : null,
      per_event_amount_cents: model.per_event_amount ? Math.round(Number(model.per_event_amount) * 100) : null,
      sale_percentage: model.sale_percentage ? Number(model.sale_percentage) : null,
      combine_mode: model.combine_mode,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue', clientId] }); toast.success('Billing model saved'); },
    onError: (err) => toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed'),
  });

  const lockMut = useMutation({
    mutationFn: () => apiClient.lockRevenueMonth({ client_id: clientId, year: period.year, month: period.month }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue', clientId] }); toast.success('Month locked'); },
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });

  const list = clients.data?.clients || [];
  const rev = revenue.data;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Billing &amp; Revenue</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent>
            <select className="border rounded h-9 px-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select a client…</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </CardContent>
        </Card>

        {clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment model</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Per-event trigger</Label>
                <select className="border rounded h-9 px-2 text-sm w-full" value={model.per_event_trigger}
                  onChange={(e) => setModel((m) => ({ ...m, per_event_trigger: e.target.value }))}>
                  <option value="show">Pay per show</option>
                  <option value="booked">Pay per booked</option>
                  <option value="qualified">Pay per qualified</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Per-event amount ($)</Label>
                <Input type="number" value={model.per_event_amount}
                  onChange={(e) => setModel((m) => ({ ...m, per_event_amount: e.target.value }))} placeholder="400" />
              </div>
              <div className="space-y-1.5">
                <Label>Sale share (%)</Label>
                <Input type="number" value={model.sale_percentage}
                  onChange={(e) => setModel((m) => ({ ...m, sale_percentage: e.target.value }))} placeholder="10" />
              </div>
              <div className="space-y-1.5">
                <Label>Combine</Label>
                <select className="border rounded h-9 px-2 text-sm w-full" value={model.combine_mode}
                  onChange={(e) => setModel((m) => ({ ...m, combine_mode: e.target.value }))}>
                  <option value="single">Single (one side)</option>
                  <option value="max">Whichever greater (max)</option>
                </select>
              </div>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? 'Saving…' : 'Save model'}
              </Button>
            </CardContent>
          </Card>
        )}

        {clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Year</Label>
                  <Input type="number" value={period.year}
                    onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))} className="w-28" />
                </div>
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <Input type="number" min="1" max="12" value={period.month}
                    onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))} className="w-20" />
                </div>
              </div>
              {rev && (
                <div className="text-sm space-y-1">
                  <div>Per-event side: <strong>{fmt(rev.flat_total_cents)}</strong></div>
                  <div>Sale side: <strong>{fmt(rev.sale_total_cents)}</strong></div>
                  <div className="text-base">Revenue: <strong>{fmt(rev.revenue_cents)}</strong> {rev.locked ? '🔒 (locked)' : ''}</div>
                </div>
              )}
              {rev && !rev.locked && (
                <Button variant="outline" onClick={() => lockMut.mutate()} disabled={lockMut.isPending}>
                  {lockMut.isPending ? 'Locking…' : 'Lock month'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
