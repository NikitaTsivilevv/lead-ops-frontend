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

export default function AdminCallers() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ['agents'], queryFn: () => apiClient.listAgents() });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });

  const [form, setForm] = useState({ name: '', client_id: '', ext_id: '' });
  const [search, setSearch] = useState('');

  const createMut = useMutation({
    mutationFn: () =>
      apiClient.createAgent({
        name: form.name,
        client_id: Number(form.client_id),
        ext_id: form.ext_id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setForm({ name: '', client_id: '', ext_id: '' });
      toast.success('Caller created');
    },
    onError: (err) => {
      toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => apiClient.updateAgent(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });

  const clientLookup = Object.fromEntries(
    (clients.data?.clients || []).map((c) => [String(c.id), c])
  );

  const columns = [
    { key: 'name', header: 'Name', cell: (a) => a.name },
    { key: 'client', header: 'Client', cell: (a) => clientLookup[String(a.client_id)]?.name || a.client_id },
    { key: 'ext_id', header: 'External ID', cell: (a) => a.ext_id || '—' },
    { key: 'active', header: 'Active', cell: (a) => (a.active ? 'Yes' : 'No') },
  ];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Callers (agents)</h1>

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
            <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.client_id || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All callers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Searchbar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, client, external ID…"
            />
            {agents.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {agents.isError && <p className="text-destructive">Failed to load callers</p>}
            {!agents.isLoading && !agents.isError && (
              <DataTable
                columns={columns}
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
    </div>
  );
}
