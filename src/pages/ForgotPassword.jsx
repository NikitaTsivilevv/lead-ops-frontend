import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try { await apiClient.forgotPassword(email); } catch { /* always show success */ } finally { setSubmitting(false); setSent(true); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-1 pb-4"><CardTitle className="text-xl font-semibold">Forgot password</CardTitle>
          <CardDescription>Enter your email and we will send a reset link.</CardDescription></CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.</p>
              <Button asChild variant="outline" className="w-full"><Link to="/login">Back to login</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}</Button>
              <Button asChild variant="ghost" className="w-full text-muted-foreground"><Link to="/login">Back to login</Link></Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
