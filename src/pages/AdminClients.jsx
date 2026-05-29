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

export default function AdminClients() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [form, setForm] = useState({ name: '', slug: '' });
  const [search, setSearch] = useState('');

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

  const columns = [
    { key: 'name', header: 'Name', cell: (c) => c.name },
    { key: 'slug', header: 'Slug', cell: (c) => <span className="font-mono text-xs">{c.slug}</span> },
    { key: 'active', header: 'Active', cell: (c) => (c.active ? 'Yes' : 'No') },
  ];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Clients</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add client</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input
                placeholder="lowercase-with-dashes"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
              />
            </div>
            <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.slug || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Searchbar
              value={search}
              onChange={setSearch}
              placeholder="Search by name or slug…"
            />
            {clients.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {clients.isError && <p className="text-destructive">Failed to load clients</p>}
            {!clients.isLoading && !clients.isError && (
              <DataTable
                columns={columns}
                rows={(clients.data?.clients || []).filter((c) => {
                  if (!search.trim()) return true;
                  const q = search.trim().toLowerCase();
                  return [c.name, c.slug].some((v) => v && String(v).toLowerCase().includes(q));
                })}
                emptyMessage="No clients yet."
                actions={(c) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive.mutate({ id: c.id, active: !c.active })}
                    disabled={toggleActive.isPending}
                  >
                    {c.active ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
                mobileCard={(c) => (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.slug}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${c.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: c.id, active: !c.active }); }}
                      disabled={toggleActive.isPending}
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
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
