// src/pages/AdminUsers.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['admin', 'operations', 'confirmation', 'client', 'caller', 'qa'];
const NEEDS_CLIENT = (role) => role === 'client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState({ email: '', role: 'operations', client_id: '', full_name: '' });
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([apiClient.listUsers(), apiClient.listClients()]);
      setUsers(u.users || []);
      setClients(Array.isArray(c) ? c : (c.clients || []));
    } catch (err) { toast.error(err.message || 'Failed to load users.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitInvite = async (e) => {
    e.preventDefault();
    if (NEEDS_CLIENT(invite.role) && !invite.client_id) { toast.error('Select a client for the client role.'); return; }
    setInviting(true);
    try {
      const body = { email: invite.email, role: invite.role, full_name: invite.full_name || undefined };
      if (invite.client_id && (invite.role === 'client' || invite.role === 'caller')) body.client_id = Number(invite.client_id);
      const res = await apiClient.inviteUser(body);
      toast[res.warning ? 'warning' : 'success'](res.warning ? 'User created, but email delivery failed. Use Resend.' : 'Invite sent.');
      setInvite({ email: '', role: 'operations', client_id: '', full_name: '' });
      load();
    } catch (err) { toast.error(err.message || 'Could not send invite.'); }
    finally { setInviting(false); }
  };

  const changeRole = async (u, role) => {
    try {
      const body = { role };
      if (role !== 'client' && role !== 'caller') body.client_id = null;
      const res = await apiClient.updateUser(u.id, body);
      setUsers((list) => list.map((x) => (x.id === u.id ? res.user : x)));
      toast.success('Role updated.');
    } catch (err) { toast.error(err.message || 'Could not update role.'); }
  };

  const disable = async (u) => {
    try { const res = await apiClient.disableUser(u.id); setUsers((list) => list.map((x) => (x.id === u.id ? res.user : x))); toast.success('User disabled.'); }
    catch (err) { toast.error(err.message || 'Could not disable user.'); }
  };

  const resend = async (u) => {
    try { const res = await apiClient.resendInvite(u.id); toast[res.warning ? 'warning' : 'success'](res.warning ? 'Email delivery failed.' : 'Invite resent.'); }
    catch (err) { toast.error(err.message || 'Could not resend invite.'); }
  };

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-none mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Users</h1>
          <Button size="sm" variant="outline" onClick={load} className="h-9 gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
        </div>

        <Card><CardContent className="pt-4">
          <form onSubmit={submitInvite} className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 items-end">
            <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Email</p>
              <Input type="email" required value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} className="h-9 sm:w-56" /></div>
            <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Full name</p>
              <Input value={invite.full_name} onChange={(e) => setInvite((s) => ({ ...s, full_name: e.target.value }))} className="h-9 sm:w-44" /></div>
            <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Role</p>
              <Select value={invite.role} onValueChange={(v) => setInvite((s) => ({ ...s, role: v }))}>
                <SelectTrigger className="h-9 sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            {(invite.role === 'client' || invite.role === 'caller') && (
              <div className="space-y-1"><p className="text-xs text-muted-foreground font-medium">Client</p>
                <Select value={invite.client_id} onValueChange={(v) => setInvite((s) => ({ ...s, client_id: v }))}>
                  <SelectTrigger className="h-9 sm:w-44"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            )}
            <Button type="submit" size="sm" className="h-9" disabled={inviting}>{inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send invite'}</Button>
          </form>
        </CardContent></Card>

        <Card><CardContent className="pt-4">
          {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Last login</th><th className="py-2 pr-3">Actions</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{u.email}</td>
                      <td className="py-2 pr-3">{u.full_name || '—'}</td>
                      <td className="py-2 pr-3">
                        <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></td>
                      <td className="py-2 pr-3"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{u.status}</span></td>
                      <td className="py-2 pr-3 text-muted-foreground">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}</td>
                      <td className="py-2 pr-3 flex gap-2">
                        {u.status === 'invited' && <Button size="sm" variant="outline" className="h-8" onClick={() => resend(u)}>Resend</Button>}
                        {u.status !== 'disabled' && <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => disable(u)}>Disable</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
