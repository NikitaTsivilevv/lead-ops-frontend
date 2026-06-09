import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';

const TABS = ['Profiles', 'Assignments', 'Attendance', 'Overhead', 'Cost Summary'];

const fmt = (cents) =>
  cents != null ? `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

const fmtDate = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString() : '—');

// ── Profiles Tab ──────────────────────────────────────────────────────────────

function ProfilesTab({ callers }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

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
      setEditingId(null);
      toast.success('Profile saved');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Save failed'),
  });

  const startEdit = (profile) => {
    setEditingId(profile.caller_id);
    setForm({
      salary: profile.salary_cents != null ? String(profile.salary_cents / 100) : '',
      dialer: profile.dialer_cents != null ? String(profile.dialer_cents / 100) : '',
      hire_date: profile.hire_date ? String(profile.hire_date).slice(0, 10) : '',
      termination_date: profile.termination_date ? String(profile.termination_date).slice(0, 10) : '',
    });
  };

  const handleSave = (callerId) => {
    if (!form.salary || !form.dialer || !form.hire_date) {
      toast.error('Salary, dialer cost, and hire date are required');
      return;
    }
    saveMut.mutate({
      callerId,
      data: {
        salary_cents: Math.round(Number(form.salary) * 100),
        dialer_cents: Math.round(Number(form.dialer) * 100),
        hire_date: form.hire_date,
        termination_date: form.termination_date || null,
      },
    });
  };

  const profiles = profileQueries.data || [];
  const rows = callers.map((c) => {
    const p = profiles.find((pr) => pr?.caller_id === c.id);
    return (p && p.salary_cents != null)
      ? p
      : { caller_id: c.id, caller_name: c.full_name, caller_no: c.caller_no, salary_cents: null };
  });

  const columns = [
    { key: 'caller',  header: 'Caller',         cell: (r) => `${r.caller_name || '—'}${r.caller_no ? ` (#${r.caller_no})` : ''}` },
    { key: 'salary',  header: 'Monthly Salary',  cell: (r) => fmt(r.salary_cents) },
    { key: 'dialer',  header: 'Dialer Cost/Mo',  cell: (r) => fmt(r.dialer_cents) },
    { key: 'hire',    header: 'Hire Date',        cell: (r) => fmtDate(r.hire_date) },
    { key: 'term',    header: 'Termination',      cell: (r) => fmtDate(r.termination_date) },
  ];

  return (
    <div className="space-y-4">
      {profileQueries.isLoading && <p className="text-muted-foreground">Loading profiles…</p>}
      {!profileQueries.isLoading && (
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No callers found."
          actions={(r) =>
            editingId === r.caller_id ? (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => handleSave(r.caller_id)} disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
            )
          }
        />
      )}
      {editingId && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">
              Edit — {rows.find((r) => r.caller_id === editingId)?.caller_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Monthly Salary ($)</Label>
              <Input type="number" min="0" step="0.01" value={form.salary}
                onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Dialer Cost/Mo ($)</Label>
              <Input type="number" min="0" step="0.01" value={form.dialer}
                onChange={(e) => setForm((f) => ({ ...f, dialer: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Hire Date</Label>
              <Input type="date" value={form.hire_date}
                onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Termination Date</Label>
              <Input type="date" value={form.termination_date}
                onChange={(e) => setForm((f) => ({ ...f, termination_date: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Assignments Tab ───────────────────────────────────────────────────────────

function AssignmentsTab({ callers, clients }) {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caller-assignments'] }); toast.success('Assignment closed'); },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const columns = [
    { key: 'caller',  header: 'Caller',  cell: (a) => `${a.caller_name || '—'}${a.caller_no ? ` (#${a.caller_no})` : ''}` },
    { key: 'client',  header: 'Client',  cell: (a) => a.client_name || a.client_id },
    { key: 'start',   header: 'Start',   cell: (a) => fmtDate(a.start_date) },
    { key: 'end',     header: 'End',     cell: (a) => a.end_date ? fmtDate(a.end_date) : <span className="text-green-700 font-medium">Active</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Assign Caller'}
        </Button>
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
              <Input type="date" value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
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
            <Button variant="outline" size="sm" onClick={() => closeMut.mutate(a.id)} disabled={closeMut.isPending}>Close</Button>
          )}
        />
      )}
    </div>
  );
}

// ── Attendance Tab (C2) ───────────────────────────────────────────────────────

function buildCalendarCells(year, month) {
  const cells = [];
  const cur = new Date(Date.UTC(year, month - 1, 1));
  let offsetAdded = false;
  while (cur.getUTCMonth() === month - 1) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      if (!offsetAdded) {
        for (let i = 0; i < dow - 1; i++) cells.push(null); // blank cells before first Mon
        offsetAdded = true;
      }
      cells.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return cells;
}

function AttendanceTab({ callers }) {
  const qc = useQueryClient();
  const now = new Date();
  const [callerId, setCallerId] = useState('');
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [pickingDay, setPickingDay] = useState(null);

  const [yr, mo] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(yr, mo, 0)).toISOString().slice(0, 10);

  const attendanceQ = useQuery({
    queryKey: ['attendance', callerId, yearMonth],
    enabled: !!callerId,
    queryFn: () => apiClient.listCallerAttendance({ caller_id: callerId, from: `${yearMonth}-01`, to: lastDay }),
  });

  const recordMut = useMutation({
    mutationFn: (body) => apiClient.recordAttendance(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', callerId, yearMonth] });
      setPickingDay(null);
      toast.success('Saved');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const byDate = Object.fromEntries(
    (attendanceQ.data?.attendance || []).map((r) => [r.work_date.slice(0, 10), r.status])
  );
  const cells = callerId ? buildCalendarCells(yr, mo) : [];

  const statusStyle = {
    worked:        'bg-green-50 border-green-300 text-green-800',
    off:           'bg-yellow-50 border-yellow-300 text-yellow-700',
    not_connected: 'bg-red-50 border-red-300 text-red-700',
  };
  const statusLabel = { worked: 'Worked', off: 'Off', not_connected: 'No conn.' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Caller</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm min-w-[180px]"
            value={callerId} onChange={(e) => setCallerId(e.target.value)}>
            <option value="">Select caller…</option>
            {callers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}{c.caller_no ? ` (#${c.caller_no})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Month</Label>
          <Input type="month" value={yearMonth} className="w-40"
            onChange={(e) => setYearMonth(e.target.value)} />
        </div>
      </div>

      {!callerId && <p className="text-sm text-muted-foreground">Select a caller to view attendance.</p>}

      {callerId && attendanceQ.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {callerId && !attendanceQ.isLoading && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-5 gap-1.5 min-w-[340px]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
              <div key={d} className="text-xs font-medium text-center text-muted-foreground pb-1">{d}</div>
            ))}
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={`blank-${i}`} />
              ) : (
                <button
                  key={cell}
                  onClick={() => setPickingDay({ date: cell, status: byDate[cell] || '' })}
                  className={`rounded-md border p-2 text-xs text-center transition-colors hover:opacity-80 ${
                    statusStyle[byDate[cell]] || 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  <div className="font-semibold">{Number(cell.slice(8))}</div>
                  {byDate[cell] && <div className="text-[10px] mt-0.5 truncate">{statusLabel[byDate[cell]]}</div>}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Status picker overlay */}
      {pickingDay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setPickingDay(null)}>
          <div className="bg-background rounded-lg shadow-xl p-5 space-y-3 w-72"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-sm">
              {new Date(pickingDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </p>
            <div className="space-y-2">
              {[
                ['worked',        'Worked',         'bg-green-100 text-green-800'],
                ['off',           'Off (credited)', 'bg-yellow-100 text-yellow-800'],
                ['not_connected', 'Not Connected',  'bg-red-100 text-red-800'],
              ].map(([val, label, cls]) => (
                <button key={val}
                  disabled={recordMut.isPending}
                  onClick={() => recordMut.mutate({ caller_id: Number(callerId), work_date: pickingDay.date, status: val })}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium text-left ${cls} hover:opacity-80 transition-opacity disabled:opacity-50`}>
                  {label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setPickingDay(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overhead Tab (C3) ─────────────────────────────────────────────────────────

function OverheadTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [form, setForm] = useState({
    period_year: String(now.getFullYear()),
    period_month: String(now.getMonth() + 1),
    amount: '',
    note: '',
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const columns = [
    { key: 'period', header: 'Period', cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { key: 'amount', header: 'Amount',  cell: (r) => fmt(r.amount_cents) },
    { key: 'note',   header: 'Note',    cell: (r) => r.note || '—' },
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

// ── Cost Summary Tab (C4) ─────────────────────────────────────────────────────

function CostSummaryTab({ clients }) {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);

  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(lastOfMonth);
  const [queried, setQueried] = useState(false);

  const costQ = useQuery({
    queryKey: ['payroll-cost', clientId, from, to],
    enabled: queried && !!from && !!to,
    queryFn: () => apiClient.getPayrollCost({ client_id: clientId || undefined, from, to }),
  });

  const rows = costQ.data?.rows || [];

  const totals = rows.reduce(
    (acc, r) => ({
      salary:     acc.salary     + (r.salary_cents || 0),
      dialer:     acc.dialer     + (r.dialer_cents || 0),
      managerial: acc.managerial + (r.managerial_cents || 0),
      total:      acc.total      + (r.total_cents || 0),
    }),
    { salary: 0, dialer: 0, managerial: 0, total: 0 }
  );

  const exportCSV = () => {
    const header = 'Date,Client ID,Salary,Dialer,Managerial,Total\n';
    const body = rows.map((r) =>
      [r.work_date, r.client_id,
       (r.salary_cents / 100).toFixed(2), (r.dialer_cents / 100).toFixed(2),
       ((r.managerial_cents || 0) / 100).toFixed(2), (r.total_cents / 100).toFixed(2)
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-cost-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'date',       header: 'Date',       cell: (r) => r.work_date },
    { key: 'client',     header: 'Client',     cell: (r) => clients.find((c) => c.id === r.client_id)?.name || r.client_id },
    { key: 'salary',     header: 'Salary',     cell: (r) => fmt(r.salary_cents) },
    { key: 'dialer',     header: 'Dialer',     cell: (r) => fmt(r.dialer_cents) },
    { key: 'managerial', header: 'Managerial', cell: (r) => fmt(r.managerial_cents) },
    { key: 'total',      header: 'Total',      cell: (r) => fmt(r.total_cents) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Client (optional)</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm min-w-[160px]"
            value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={from} className="w-36" onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={to} className="w-36" onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={() => { setQueried(true); costQ.refetch(); }} disabled={!from || !to || costQ.isFetching}>
          {costQ.isFetching ? 'Loading…' : 'Run'}
        </Button>
        {rows.length > 0 && (
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
        )}
      </div>

      {costQ.isError && <p className="text-destructive">Failed to load cost data</p>}

      {queried && !costQ.isFetching && rows.length > 0 && (
        <>
          <DataTable columns={columns} rows={rows} emptyMessage="No cost data." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              ['Total Salary',     fmt(totals.salary)],
              ['Total Dialer',     fmt(totals.dialer)],
              ['Total Managerial', fmt(totals.managerial)],
              ['Grand Total',      fmt(totals.total)],
            ].map(([label, val]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold mt-0.5">{val}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {queried && !costQ.isFetching && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No cost data for the selected period.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPayroll() {
  const [tab, setTab] = useState('Profiles');

  const callerUsers = useQuery({ queryKey: ['caller-users'], queryFn: () => apiClient.listCallers() });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });

  const callers = callerUsers.data?.callers || [];
  const clientList = clients.data?.clients || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Payroll</h1>

        <div className="flex gap-0 border-b overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {tab === 'Profiles' && (
              callerUsers.isLoading ? <p className="text-muted-foreground">Loading…</p>
                : <ProfilesTab callers={callers} />
            )}
            {tab === 'Assignments' && (
              callerUsers.isLoading || clients.isLoading ? <p className="text-muted-foreground">Loading…</p>
                : <AssignmentsTab callers={callers} clients={clientList} />
            )}
            {tab === 'Attendance' && (
              callerUsers.isLoading ? <p className="text-muted-foreground">Loading…</p>
                : <AttendanceTab callers={callers} />
            )}
            {tab === 'Overhead' && <OverheadTab />}
            {tab === 'Cost Summary' && (
              clients.isLoading ? <p className="text-muted-foreground">Loading…</p>
                : <CostSummaryTab clients={clientList} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
