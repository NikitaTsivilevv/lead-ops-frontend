import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api/apiClient';

function formatEastern(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' });
}

export default function MyLeads() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['my-leads'],
    queryFn: () => apiClient.listMyLeads(),
  });

  const appointments = data?.appointments ?? [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">My submitted leads</h1>
          <Link to="/intake" className="text-sm underline">Submit a new lead</Link>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && <p className="text-destructive">Failed to load: {String(error?.message || error)}</p>}

        {!isLoading && !isError && appointments.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No leads yet. Submit your first one.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {appointments.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{a.prospect_name}</span>
                  <Badge
                    variant={
                      a.qualification === 'qualified' ? 'default'
                      : a.qualification === 'disqualified' ? 'destructive'
                      : 'secondary'
                    }
                  >
                    {a.qualification}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>Appointment: {formatEastern(a.appointment_at)}</div>
                <div>Address: {a.address}</div>
                <div>Submitted: {formatEastern(a.created_at)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          This view is read-only. If you spot an error, ask the confirmation team to correct it.
        </p>
      </div>
    </div>
  );
}
