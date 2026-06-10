import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import { fmt } from './utils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function OverheadTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [form, setForm] = useState({
    period_year:  String(now.getFullYear()),
    period_month: String(now.getMonth() + 1),
    amount: '',
    note:   '',
  });

  const expenses = useQuery({
    queryKey: ['managerial-expenses'],
    queryFn: () => apiClient.listManagerialExpenses(),
  });

  const saveMut = useMutation({
    mutationFn: () => apiClient.upsertManagerialExpense({
      period_year:  Number(form.period_year),
      period_month: Number(form.period_month),
      amount_cents: Math.round(Number(form.amount) * 100),
      note:         form.note || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managerial-expenses'] });
      setForm((f) => ({ ...f, amount: '', note: '' }));
      toast.success('Overhead saved');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const columns = [
    { key: 'period', header: 'Period', cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { key: 'amount', header: 'Amount', cell: (r) => fmt(r.amount_cents) },
    { key: 'note',   header: 'Note',   cell: (r) => r.note || '—' },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-sm">Enter monthly managerial overhead</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label>Year</Label>
            <Input type="number" min="2020" value={form.period_year}
              onChange={(e) => setForm((f) => ({ ...f, period_year: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Month</Label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
              value={form.period_month} onChange={(e) => setForm((f) => ({ ...f, period_month: e.target.value }))}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Total Amount ($)</Label>
            <Input type="number" min="0" step="0.01" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={form.note} placeholder="Optional"
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <Button className="sm:col-start-4"
            disabled={!form.amount || saveMut.isPending}
            onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      {expenses.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!expenses.isLoading && (
        <DataTable columns={columns} rows={expenses.data?.expenses || []} emptyMessage="No overhead entries yet." />
      )}
    </div>
  );
}
