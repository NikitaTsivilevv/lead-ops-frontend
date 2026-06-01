import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, valid: false });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState({ loading: false, valid: false }); return; }
    apiClient.getResetTokenStatus(token).then(() => setState({ loading: false, valid: true })).catch(() => setState({ loading: false, valid: false }));
  }, [token]);

  if (state.loading) return <div className="fixed inset-0 flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!state.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-[400px]"><CardHeader><CardTitle>Link invalid</CardTitle>
          <CardDescription>This reset link is invalid or has expired.</CardDescription></CardHeader>
          <CardContent><Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button></CardContent></Card>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (err) { toast.error(err.message || 'Could not reset password.'); } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-1 pb-4"><CardTitle className="text-xl font-semibold">Choose a new password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="cf">Confirm password</Label>
              <Input id="cf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
