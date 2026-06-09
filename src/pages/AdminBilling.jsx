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
// Today's date in America/New_York (en-CA formats as YYYY-MM-DD) — matches the backend's ET bucketing.
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

// Human-readable billing model label for an existing rate version.
const modelLabel = (v) => {
  if (v.combine_mode === 'max') return 'Hybrid';
  if (v.per_event_trigger != null) return v.sale_percentage != null ? 'Per-event + Sale %' : 'Per-event';
  return 'Sale %';
};

export default function AdminBilling() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [clientId, setClientId] = useState('');
  const [form, setForm] = useState({ effective_from: todayISO(), billing_model: 'per_event', per_event_trigger: 'show', per_event_amount: '', sale_percentage: '' });
  const [billDate, setBillDate] = useState(todayISO());

  const modelQ = useQuery({
    queryKey: ['billing-model', clientId], enabled: !!clientId,
    queryFn: () => apiClient.getBillingModel(clientId),
  });
  const revenueQ = useQuery({
    queryKey: ['revenue', clientId, billDate], enabled: !!clientId,
    queryFn: () => apiClient.getRevenue(clientId, billDate).then((d) => d.revenue),
  });
  const runsQ = useQuery({
    queryKey: ['billing-runs', clientId], enabled: !!clientId,
    queryFn: () => apiClient.listBillingRuns(clientId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['billing-model', clientId] });
    qc.invalidateQueries({ queryKey: ['revenue', clientId] });
    qc.invalidateQueries({ queryKey: ['billing-runs', clientId] });
  };
  const onErr = (err) => toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed');

  const saveMut = useMutation({
    mutationFn: () => {
      const m = form.billing_model;
      const usePerEvent = (m === 'per_event' || m === 'hybrid') && form.per_event_amount;
      const useSale = (m === 'sale' || m === 'hybrid') && form.sale_percentage;
      return apiClient.putBillingModel(clientId, {
        effective_from: form.effective_from,
        per_event_trigger: usePerEvent ? form.per_event_trigger : null,
        per_event_amount_cents: usePerEvent ? Math.round(Number(form.per_event_amount) * 100) : null,
        sale_percentage: useSale ? Number(form.sale_percentage) : null,
        combine_mode: m === 'hybrid' ? 'max' : 'single',
      });
    },
    onSuccess: () => { invalidate(); toast.success('Rate version saved'); },
    onError: onErr,
  });
  const delVersionMut = useMutation({
    mutationFn: (versionId) => apiClient.deleteBillingModelVersion(clientId, versionId),
    onSuccess: () => { invalidate(); toast.success('Version deleted'); }, onError: onErr,
  });
  const billMut = useMutation({
    mutationFn: () => apiClient.recordBillingRun(clientId, billDate),
    onSuccess: () => { invalidate(); toast.success('Bill recorded'); }, onError: onErr,
  });
  const undoMut = useMutation({
    mutationFn: (runId) => apiClient.deleteBillingRun(clientId, runId),
    onSuccess: () => { invalidate(); toast.success('Bill undone'); }, onError: onErr,
  });

  const list = clients.data?.clients || [];
  const versions = modelQ.data?.versions || [];
  const rev = revenueQ.data;
  const runs = runsQ.data;

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
            <CardHeader><CardTitle className="text-base">Rate versions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">Effective from</th><th>Model</th><th>Trigger</th><th>Amount</th><th>Sale %</th><th></th>
                </tr></thead>
                <tbody>
                  {versions.length === 0 && <tr><td colSpan={6} className="py-2 text-muted-foreground">No rate versions yet.</td></tr>}
                  {versions.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-1">{v.effective_from}</td>
                      <td>{modelLabel(v)}</td>
                      <td>{v.per_event_trigger || '—'}</td>
                      <td>{v.per_event_amount_cents != null ? fmt(v.per_event_amount_cents) : '—'}</td>
                      <td>{v.sale_percentage != null ? `${v.sale_percentage}%` : '—'}</td>
                      <td className="text-right">
                        {isAdmin && <Button variant="ghost" size="sm" onClick={() => delVersionMut.mutate(v.id)}>Delete</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end border-t pt-4">
                  <div className="space-y-1.5">
                    <Label>Effective from</Label>
                    <Input type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Billing model</Label>
                    <select className="border rounded h-9 px-2 text-sm w-full" value={form.billing_model}
                      onChange={(e) => setForm((f) => ({ ...f, billing_model: e.target.value }))}>
                      <option value="per_event">Per-event only</option>
                      <option value="sale">Sale % only</option>
                      <option value="hybrid">Hybrid (whichever greater)</option>
                    </select>
                  </div>
                  {form.billing_model !== 'sale' && (
                    <div className="space-y-1.5">
                      <Label>Per-event trigger</Label>
                      <select className="border rounded h-9 px-2 text-sm w-full" value={form.per_event_trigger}
                        onChange={(e) => setForm((f) => ({ ...f, per_event_trigger: e.target.value }))}>
                        <option value="show">Pay per show</option>
                        <option value="booked">Pay per booked</option>
                        <option value="qualified">Pay per qualified</option>
                      </select>
                    </div>
                  )}
                  {form.billing_model !== 'sale' && (
                    <div className="space-y-1.5">
                      <Label>Per-event amount ($)</Label>
                      <Input type="number" value={form.per_event_amount} placeholder="400"
                        onChange={(e) => setForm((f) => ({ ...f, per_event_amount: e.target.value }))} />
                    </div>
                  )}
                  {form.billing_model !== 'per_event' && (
                    <div className="space-y-1.5">
                      <Label>Sale share (%)</Label>
                      <Input type="number" value={form.sale_percentage} placeholder="10"
                        onChange={(e) => setForm((f) => ({ ...f, sale_percentage: e.target.value }))} />
                    </div>
                  )}
                  <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    {saveMut.isPending ? 'Saving…' : 'Add / update rate version'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {clientId && (
          <Card>
            <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rev && (
                <div className="text-sm space-y-1">
                  <div>Per-event side: <strong>{fmt(rev.flat_total_cents)}</strong></div>
                  <div>Sale side: <strong>{fmt(rev.sale_total_cents)}</strong></div>
                  <div className="text-base">Cumulative revenue: <strong>{fmt(rev.cumulative_revenue_cents)}</strong></div>
                  <div>Already billed: <strong>{fmt(rev.already_billed_cents)}</strong></div>
                  <div>To bill now: <strong>{fmt(rev.to_bill_cents)}</strong></div>
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label>Bill as of</Label>
                    <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={() => billMut.mutate()} disabled={billMut.isPending || !rev || rev.to_bill_cents <= 0}>
                    {billMut.isPending ? 'Billing…' : 'Bill now'}
                  </Button>
                </div>
              )}
              {runs?.runs?.length > 0 && (
                <table className="w-full text-sm pt-2">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">As of</th><th>Cumulative</th><th>Billed</th><th></th>
                  </tr></thead>
                  <tbody>
                    {runs.runs.map((r, i) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1">{r.as_of_date}</td>
                        <td>{fmt(r.cumulative_revenue_cents)}</td>
                        <td>{fmt(r.amount_billed_cents)}</td>
                        <td className="text-right">
                          {isAdmin && i === 0 && <Button variant="ghost" size="sm" onClick={() => undoMut.mutate(r.id)}>Undo last</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
