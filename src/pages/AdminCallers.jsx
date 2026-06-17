import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import Searchbar from '@/components/Searchbar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TABS = ['Accounts', 'Dialer Agents'];

export default function AdminCallers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Accounts');

  const agents      = useQuery({ queryKey: ['agents'],       queryFn: () => apiClient.listAgents() });
  const clients     = useQuery({ queryKey: ['clients'],      queryFn: () => apiClient.listClients() });
  const callerUsers = useQuery({ queryKey: ['caller-users'], queryFn: () => apiClient.listCallers() });

  const [form, setForm]               = useState({ name: '', client_id: '', ext_id: '' });
  const [search, setSearch]           = useState('');
  const [callerSearch, setCallerSearch] = useState('');
  const [retireTarget, setRetireTarget] = useState(null);

  const createMut = useMutation({
    mutationFn: () => apiClient.createAgent({
      name: form.name,
      client_id: Number(form.client_id),
      ext_id: form.ext_id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setForm({ name: '', client_id: '', ext_id: '' });
      toast.success('Caller created');
    },
    onError: (err) => toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => apiClient.updateAgent(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });

  const retireMut = useMutation({
    mutationFn: (id) => apiClient.retireCaller(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caller-users'] });
      setRetireTarget(null);
      toast.success('Caller retired');
    },
    onError: (err) => {
      setRetireTarget(null);
      toast.error(err?.payload?.error || err.message || 'Failed to retire');
    },
  });

  const clientLookup = Object.fromEntries(
    (clients.data?.clients || []).map((c) => [String(c.id), c])
  );

  const callerUserColumns = [
    { key: 'caller_no', header: '#',      cell: (u) => u.caller_no ? `Caller #${u.caller_no}` : '—' },
    { key: 'full_name', header: 'Name',   cell: (u) => u.full_name || '—' },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => u.retired_at
        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Retired</span>
        : u.active
          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Active</span>
          : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Inactive</span>,
    },
    {
      key: 'retired_at',
      header: 'Retired',
      cell: (u) => u.retired_at ? new Date(u.retired_at).toLocaleDateString() : '—',
    },
  ];

  const agentColumns = [
    { key: 'name',   header: 'Name',        cell: (a) => a.name },
    { key: 'client', header: 'Client',      cell: (a) => clientLookup[String(a.client_id)]?.name || a.client_id },
    { key: 'ext_id', header: 'External ID', cell: (a) => a.ext_id || '—' },
    { key: 'active', header: 'Active',      cell: (a) => (a.active ? 'Yes' : 'No') },
  ];

  const filteredCallerUsers = (callerUsers.data?.callers || []).filter((u) => {
    if (!callerSearch.trim()) return true;
    const q = callerSearch.trim().toLowerCase();
    return [u.full_name, u.caller_no ? `${u.caller_no}` : ''].some(
      (v) => v && String(v).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Callers</h1>

        <div className="flex gap-0 border-b overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={`${i}-${t}`}
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

        {/* ── Accounts tab ── */}
        {tab === 'Accounts' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Caller accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Searchbar value={callerSearch} onChange={setCallerSearch} placeholder="Search by name or caller #…" />
              {callerUsers.isLoading && <p className="text-muted-foreground">Loading…</p>}
              {callerUsers.isError  && <p className="text-destructive">Failed to load caller accounts</p>}
              {!callerUsers.isLoading && !callerUsers.isError && (
                <DataTable
                  columns={callerUserColumns}
                  rows={filteredCallerUsers}
                  emptyMessage="No caller accounts."
                  actions={(u) =>
                    !u.retired_at && (
                      <Button variant="outline" size="sm" onClick={() => setRetireTarget(u)}>
                        Retire
                      </Button>
                    )
                  }
                  mobileCard={(u) => (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{u.full_name}</p>
                          {u.caller_no && <p className="text-xs text-muted-foreground">Caller #{u.caller_no}</p>}
                        </div>
                        {u.retired_at
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">Retired</span>
                          : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 shrink-0">Active</span>
                        }
                      </div>
                      {u.retired_at && <p className="text-xs text-muted-foreground">Retired {new Date(u.retired_at).toLocaleDateString()}</p>}
                      {!u.retired_at && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => setRetireTarget(u)}>
                          Retire
                        </Button>
                      )}
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Dialer Agents tab ── */}
        {tab === 'Dialer Agents' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add caller</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Client *</Label>
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                    value={form.client_id}
                    onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {(clients.data?.clients || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>External ID</Label>
                  <Input value={form.ext_id} onChange={(e) => setForm((f) => ({ ...f, ext_id: e.target.value }))} />
                </div>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!form.name || !form.client_id || createMut.isPending}
                >
                  {createMut.isPending ? 'Creating…' : 'Create'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">All callers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Searchbar value={search} onChange={setSearch} placeholder="Search by name, client, external ID…" />
                {agents.isLoading && <p className="text-muted-foreground">Loading…</p>}
                {agents.isError  && <p className="text-destructive">Failed to load callers</p>}
                {!agents.isLoading && !agents.isError && (
                  <DataTable
                    columns={agentColumns}
                    rows={(agents.data?.agents || []).filter((a) => {
                      if (!search.trim()) return true;
                      const q = search.trim().toLowerCase();
                      return [a.name, clientLookup[String(a.client_id)]?.name, a.ext_id]
                        .some((v) => v && String(v).toLowerCase().includes(q));
                    })}
                    emptyMessage="No callers yet."
                    actions={(a) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: a.id, active: !a.active })}
                        disabled={toggleActive.isPending}
                      >
                        {a.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                    mobileCard={(a) => (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{a.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {clientLookup[String(a.client_id)]?.name || `Client #${a.client_id}`}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${a.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                            {a.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {a.ext_id && <p className="text-xs text-muted-foreground">Ext ID: {a.ext_id}</p>}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: a.id, active: !a.active }); }}
                          disabled={toggleActive.isPending}
                        >
                          {a.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <AlertDialog open={!!retireTarget} onOpenChange={(open) => { if (!open) setRetireTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retire {retireTarget?.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This marks the caller as retired and disables their account. Their Caller #{retireTarget?.caller_no} will never be reused. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={retireMut.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => retireMut.mutate(retireTarget.id)}
                disabled={retireMut.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {retireMut.isPending ? 'Retiring…' : 'Retire caller'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
