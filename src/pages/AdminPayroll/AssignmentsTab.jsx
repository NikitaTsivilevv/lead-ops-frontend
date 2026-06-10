import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import { fmtDate } from './utils';

export default function AssignmentsTab({ callers, clients }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ caller_id: '', client_id: '', start_date: '' });

  const assignments = useQuery({
    queryKey: ['caller-assignments'],
    queryFn: () => apiClient.listCallerAssignments(),
  });

  const createMut = useMutation({
    mutationFn: () => apiClient.createCallerAssignment({
      caller_id: Number(form.caller_id),
      client_id: Number(form.client_id),
      start_date: form.start_date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caller-assignments'] });
      setShowForm(false);
      setForm({ caller_id: '', client_id: '', start_date: '' });
      toast.success('Assignment created');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const closeMut = useMutation({
    mutationFn: (id) => apiClient.closeCallerAssignment(id, new Date().toISOString().slice(0, 10)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caller-assignments'] });
      toast.success('Assignment closed');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const columns = [
    { key: 'caller', header: 'Caller', cell: (a) => `${a.caller_name || '—'}${a.caller_no ? ` (#${a.caller_no})` : ''}` },
    { key: 'client', header: 'Client', cell: (a) => a.client_name || a.client_id },
    { key: 'start',  header: 'Start',  cell: (a) => fmtDate(a.start_date) },
    { key: 'end',    header: 'End',    cell: (a) => a.end_date ? fmtDate(a.end_date) : <span className="text-green-700 font-medium">Active</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex ">
        {showForm ? (
          <Button size="sm" variant="destructive" onClick={() => setShowForm(false)}>Cancel</Button>
        ) : (
          <Button size="sm" onClick={() => setShowForm(true)}>Assign Caller</Button>
        )}
      </div>
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-sm">New assignment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>Caller *</Label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                value={form.caller_id} onChange={(e) => setForm((f) => ({ ...f, caller_id: e.target.value }))}>
                <option value="">Select caller…</option>
                {callers.filter((c) => c.active && !c.retired_at).map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}{c.caller_no ? ` (#${c.caller_no})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Client *</Label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {form.start_date
                      ? new Date(form.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span className="text-muted-foreground">Pick a date…</span>
                    }
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.start_date ? new Date(form.start_date + 'T00:00:00') : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      setForm((f) => ({ ...f, start_date: iso }));
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="sm:col-start-3"
              disabled={!form.caller_id || !form.client_id || !form.start_date || createMut.isPending}
              onClick={() => createMut.mutate()}>
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      )}
      {assignments.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!assignments.isLoading && (
        <DataTable
          columns={columns}
          rows={assignments.data?.assignments || []}
          emptyMessage="No assignments yet."
          actions={(a) => !a.end_date && (
            <Button variant="outline" size="sm" onClick={() => closeMut.mutate(a.id)} disabled={closeMut.isPending}>
              Close
            </Button>
          )}
        />
      )}
    </div>
  );
}
