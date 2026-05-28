import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

export default function AdminCallers() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ['agents'], queryFn: () => apiClient.listAgents() });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });

  const [form, setForm] = useState({ name: '', client_id: '', ext_id: '' });

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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Callers (agents)</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add caller</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
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
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>External ID</Label>
              <Input
                value={form.ext_id}
                onChange={(e) => setForm((f) => ({ ...f, ext_id: e.target.value }))}
              />
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
          <CardContent>
            {agents.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {agents.isError && <p className="text-destructive">Failed to load callers</p>}
            {!agents.isLoading && !agents.isError && (agents.data?.agents?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground italic">No callers yet.</p>
            )}
            {(agents.data?.agents?.length ?? 0) > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Name</th>
                    <th>Client</th>
                    <th>External ID</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(agents.data?.agents || []).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2">{a.name}</td>
                      <td>{clientLookup[String(a.client_id)]?.name || a.client_id}</td>
                      <td>{a.ext_id || '—'}</td>
                      <td>{a.active ? 'Yes' : 'No'}</td>
                      <td className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: a.id, active: !a.active })}
                          disabled={toggleActive.isPending}
                        >
                          {a.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
