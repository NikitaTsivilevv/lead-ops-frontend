import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import { fmt, fmtDate } from './utils';

export default function ProfilesTab({ callers }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // { caller_id, caller_name, ...form fields }

  const profileQueries = useQuery({
    queryKey: ['all-payroll-profiles'],
    queryFn: async () => {
      const results = await Promise.all(
        callers.map((c) =>
          apiClient.getPayrollProfile(c.id)
            .then((r) => ({ ...r.profile, caller_id: c.id, caller_name: c.full_name, caller_no: c.caller_no }))
            .catch(() => ({ caller_id: c.id, caller_name: c.full_name, caller_no: c.caller_no, salary_cents: null }))
        )
      );
      return results;
    },
    enabled: callers.length > 0,
  });

  const saveMut = useMutation({
    mutationFn: ({ callerId, data }) => apiClient.putPayrollProfile(callerId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-payroll-profiles'] });
      setEditing(null);
      toast.success('Profile saved');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Save failed'),
  });

  const openDialog = (profile) => {
    setEditing({
      caller_id:   profile.caller_id,
      caller_name: profile.caller_name,
      caller_no:   profile.caller_no,
      salary:      profile.salary_cents != null ? String(profile.salary_cents / 100) : '',
      dialer:      profile.dialer_cents != null ? String(profile.dialer_cents / 100) : '',
      hire_date:        profile.hire_date        ? String(profile.hire_date).slice(0, 10)        : '',
      termination_date: profile.termination_date ? String(profile.termination_date).slice(0, 10) : '',
    });
  };

  const handleSave = () => {
    if (!editing.salary || !editing.dialer || !editing.hire_date) {
      toast.error('Salary, dialer cost, and hire date are required');
      return;
    }
    saveMut.mutate({
      callerId: editing.caller_id,
      data: {
        salary_cents:     Math.round(Number(editing.salary) * 100),
        dialer_cents:     Math.round(Number(editing.dialer) * 100),
        hire_date:        editing.hire_date,
        termination_date: editing.termination_date || null,
      },
    });
  };

  const set = (field) => (e) => setEditing((prev) => ({ ...prev, [field]: e.target.value }));

  const profiles = profileQueries.data || [];
  const rows = callers.map((c) => {
    const p = profiles.find((pr) => pr?.caller_id === c.id);
    const base = { id: c.id, caller_id: c.id, caller_name: c.full_name, caller_no: c.caller_no };
    return (p && p.salary_cents != null) ? { ...p, ...base } : { ...base, salary_cents: null };
  });

  const columns = [
    { key: 'caller', header: 'Caller',        cell: (r) => `${r.caller_name || '—'}${r.caller_no ? ` (#${r.caller_no})` : ''}` },
    { key: 'salary', header: 'Monthly Salary', cell: (r) => fmt(r.salary_cents) },
    { key: 'dialer', header: 'Dialer Cost/Mo', cell: (r) => fmt(r.dialer_cents) },
    { key: 'hire',   header: 'Hire Date',       cell: (r) => fmtDate(r.hire_date) },
    { key: 'term',   header: 'Termination',     cell: (r) => fmtDate(r.termination_date) },
  ];

  return (
    <>
      {profileQueries.isLoading && <p className="text-muted-foreground">Loading profiles…</p>}
      {!profileQueries.isLoading && (
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No callers found."
          actions={(r) => (
            <Button size="sm" variant="outline" onClick={() => openDialog(r)}>Edit</Button>
          )}
        />
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit — {editing?.caller_name}{editing?.caller_no ? ` (#${editing.caller_no})` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Monthly Salary ($)</Label>
              <Input type="number" min="0" step="0.01"
                value={editing?.salary ?? ''}
                onChange={set('salary')} />
            </div>
            <div className="space-y-1">
              <Label>Dialer Cost/Mo ($)</Label>
              <Input type="number" min="0" step="0.01"
                value={editing?.dialer ?? ''}
                onChange={set('dialer')} />
            </div>
            <div className="space-y-1">
              <Label>Hire Date</Label>
              <Input type="date"
                value={editing?.hire_date ?? ''}
                onChange={set('hire_date')} />
            </div>
            <div className="space-y-1">
              <Label>Termination Date</Label>
              <Input type="date"
                value={editing?.termination_date ?? ''}
                onChange={set('termination_date')} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
