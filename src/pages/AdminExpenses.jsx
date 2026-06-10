import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CATEGORIES = ['data', 'software', 'dialer', 'sms', 'ai', 'other'];
const CAT_LABELS  = { data: 'Data', software: 'Software', dialer: 'Dialer', sms: 'SMS', ai: 'AI', other: 'Other' };

const fmt = (cents) =>
  `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const EMPTY_FORM = {
  client_id: '', operational_group: '', category: 'data',
  amount: '', expense_date: new Date().toISOString().slice(0, 10), note: '',
};

export default function AdminExpenses() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });

  const [form, setForm] = useState(EMPTY_FORM);
  const [isOpsOverhead, setIsOpsOverhead] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters
  const now = new Date();
  const [filterClient, setFilterClient] = useState('');
  const [filterFrom, setFilterFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`);
  const [filterTo, setFilterTo] = useState(new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0,10));
  const [filterCat, setFilterCat] = useState('');

  const expenses = useQuery({
    queryKey: ['campaign-expenses', filterClient, filterFrom, filterTo, filterCat],
    queryFn: () => apiClient.listCampaignExpenses({
      client_id: filterClient || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
      category: filterCat || undefined,
    }),
  });

  const createMut = useMutation({
    mutationFn: () => apiClient.createCampaignExpense({
      client_id:         !isOpsOverhead && form.client_id ? Number(form.client_id) : null,
      operational_group: isOpsOverhead  && form.operational_group ? form.operational_group : null,
      category:    form.category,
      amount_cents: Math.round(Number(form.amount) * 100),
      expense_date: form.expense_date,
      note:         form.note || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-expenses'] });
      setForm(EMPTY_FORM);
      setIsOpsOverhead(false);
      toast.success('Expense added');
    },
    onError: (err) => toast.error(err?.payload?.error || err?.payload?.message || err.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => apiClient.updateCampaignExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-expenses'] });
      setEditingId(null);
      toast.success('Expense updated');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiClient.deleteCampaignExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-expenses'] });
      setDeleteTarget(null);
      toast.success('Deleted');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const clientLookup = Object.fromEntries(
    (clients.data?.clients || []).map((c) => [String(c.id), c.name])
  );

  const rows = expenses.data?.expenses || [];

  // Group totals by client for the subtotal rows
  const totalByCategoryAndClient = rows.reduce((acc, r) => {
    const key = r.client_id ? `client:${r.client_id}` : `group:${r.operational_group}`;
    acc[key] = (acc[key] || 0) + Number(r.amount_cents);
    return acc;
  }, {});
  const grandTotal = rows.reduce((s, r) => s + Number(r.amount_cents), 0);

  const columns = [
    { key: 'date',     header: 'Date',     cell: (r) => r.expense_date },
    { key: 'target',   header: 'Client',   cell: (r) => r.client_name || r.operational_group || '—' },
    { key: 'category', header: 'Category', cell: (r) => CAT_LABELS[r.category] || r.category },
    { key: 'amount',   header: 'Amount',   cell: (r) => fmt(r.amount_cents) },
    { key: 'note',     header: 'Note',     cell: (r) => r.note || '—' },
  ];

  const canSubmit = form.amount && form.expense_date && form.category &&
    (isOpsOverhead ? !!form.operational_group : !!form.client_id);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Campaign Expenses</h1>

        {/* Add expense form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Add expense</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isOpsOverhead}
                  onChange={(e) => setIsOpsOverhead(e.target.checked)} className="rounded" />
                Operational overhead (no client)
              </label>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
            
              <div className='flex flex-col md:flex-row flex-wrap gap-4'>
                  {!isOpsOverhead ? (
                <div className="space-y-1 ">
                  <Label>Client *</Label>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                    value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Group *</Label>
                  <Input value={form.operational_group} placeholder="e.g. Ops"
                    onChange={(e) => setForm((f) => ({ ...f, operational_group: e.target.value }))} />
                </div>
              )}
              <div className="space-y-1 w-full md:w-auto">
                <Label>Category *</Label>
                <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                  value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1 w-full md:w-auto">
                <Label>Amount ($) *</Label>
                <Input type="number" min="0.01" step="0.01" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1 w-full md:w-auto">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="space-y-1 w-full md:w-auto">
                <Label>Note</Label>
                <Input value={form.note} placeholder="Optional"
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
                  <div className="space-y-1 w-full md:w-auto self-end">
              <Button className="w-full "disabled={!canSubmit || createMut.isPending} onClick={() => createMut.mutate()}>
                {createMut.isPending ? 'Adding…' : 'Add'}
              </Button>
              </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter + list */}
        <Card>
          <CardHeader><CardTitle className="text-base">Expense list</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row flex-wrap gap-3 md:items-end">
              <div className="space-y-1">
                <Label>Client</Label>
                <select className="h-9 rounded-md border bg-background px-2 text-sm w-full md:min-w-[140px]"
                  value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
                  <option value="">All</option>
                  {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 ">
                <Label>From</Label>
                <Input type="date" value={filterFrom} className="w-[180px] md:w-36"
                  onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={filterTo} className="w-[180px] md:w-36"
                  onChange={(e) => setFilterTo(e.target.value)} />
              </div>
              <div className="space-y-1 flex flex-col gap-1">
                <Label>Category</Label>
                <select className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                  <option value="">All</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
            </div>

            {expenses.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {expenses.isError  && <p className="text-destructive">Failed to load expenses</p>}

            {!expenses.isLoading && !expenses.isError && (
              <>
                <DataTable
                  columns={columns}
                  rows={rows}
                  emptyMessage="No expenses for this period."
                  actions={(r) => (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"
                        onClick={() => {
                          setEditingId(r.id);
                          setForm({
                            client_id: r.client_id ? String(r.client_id) : '',
                            operational_group: r.operational_group || '',
                            category: r.category,
                            amount: String(r.amount_cents / 100),
                            expense_date: r.expense_date,
                            note: r.note || '',
                          });
                          setIsOpsOverhead(!r.client_id);
                        }}>Edit</Button>
                      <Button variant="outline" size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(r)}>Delete</Button>
                    </div>
                  )}
                />
                {rows.length > 0 && (
                  <div className="flex justify-end pt-1 text-sm font-medium">
                    Total: {fmt(grandTotal)}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
            onClick={() => setEditingId(null)}>
            <div className="bg-background rounded-lg shadow-xl p-6 w-[420px] space-y-4 max-w-[95vw]"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="font-semibold">Edit expense</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>Category</Label>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                    value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Amount ($)</Label>
                  <Input type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.expense_date}
                    onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Note</Label>
                  <Input value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button disabled={!form.amount || updateMut.isPending}
                  onClick={() => updateMut.mutate({
                    id: editingId,
                    data: {
                      category:     form.category,
                      amount_cents: Math.round(Number(form.amount) * 100),
                      expense_date: form.expense_date,
                      note:         form.note || null,
                    },
                  })}>
                  {updateMut.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && `${CAT_LABELS[deleteTarget.category]} — ${fmt(deleteTarget.amount_cents)} on ${deleteTarget.expense_date}`}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
