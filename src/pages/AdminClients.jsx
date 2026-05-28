import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

export default function AdminClients() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [form, setForm] = useState({ name: '', slug: '' });

  const createMut = useMutation({
    mutationFn: () => apiClient.createClient({ name: form.name, slug: form.slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setForm({ name: '', slug: '' });
      toast.success('Client created');
    },
    onError: (err) => {
      const code = err?.payload?.error;
      if (code === 'slug_exists') {
        toast.error('A client with this slug already exists.');
      } else {
        toast.error(err?.payload?.message || code || err.message || 'Failed');
      }
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => apiClient.updateClient(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
    onError: (err) => toast.error(err?.payload?.message || err.message || 'Failed'),
  });

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Clients</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add client</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input
                placeholder="lowercase-with-dashes"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
                }
              />
            </div>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.name || !form.slug || createMut.isPending}
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All clients</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {clients.isError && <p className="text-destructive">Failed to load clients</p>}
            {!clients.isLoading && !clients.isError && (clients.data?.clients?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground italic">No clients yet.</p>
            )}
            {(clients.data?.clients?.length ?? 0) > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Name</th>
                    <th>Slug</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(clients.data?.clients || []).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2">{c.name}</td>
                      <td>{c.slug}</td>
                      <td>{c.active ? 'Yes' : 'No'}</td>
                      <td className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: c.id, active: !c.active })}
                          disabled={toggleActive.isPending}
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
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
