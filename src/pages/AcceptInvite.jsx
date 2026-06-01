import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [state, setState] = useState({ loading: true, invite: null, error: '' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState({ loading: false, invite: null, error: 'missing' }); return; }
    apiClient.getInviteByToken(token)
      .then((inv) => { setState({ loading: false, invite: inv, error: '' }); setFullName(inv.full_name || ''); })
      .catch(() => setState({ loading: false, invite: null, error: 'invalid' }));
  }, [token]);

  if (state.loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!state.invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-[400px]"><CardHeader><CardTitle>Invite link invalid</CardTitle>
          <CardDescription>This invite link is invalid or has expired.</CardDescription></CardHeader>
          <CardContent><Button asChild className="w-full"><Link to="/login">Go to login</Link></Button></CardContent></Card>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const res = await apiClient.acceptInvite({ token, password, full_name: fullName || undefined });
      applySession(res.token, res.user);
      toast.success('Account activated.');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Could not accept invite.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-1 pb-4"><CardTitle className="text-xl font-semibold">Set your password</CardTitle>
          <CardDescription>Activating <strong>{state.invite.email}</strong></CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" /></div>
            <div className="space-y-1.5"><Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="cf">Confirm password</Label>
              <Input id="cf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate account'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
