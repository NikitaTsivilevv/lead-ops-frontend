import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ConfirmationBadges from '@/components/ConfirmationBadges';
import { apiClient } from '@/api/apiClient';

function bucket(lead) {
  const past = lead.appointment_at && new Date(lead.appointment_at) < new Date();
  if (lead.qualification === 'pending') return 'qualification';
  if (lead.qualification === 'qualified' && lead.outcome === 'pending' && !past) return 'confirmation';
  if (lead.qualification === 'qualified' && lead.outcome === 'pending' && past) return 'show';
  return null;
}

function LeadCard({ lead }) {
  return (
    <Link to={`/appointments/${lead.id}`} className="block">
      <Card className="hover:bg-accent/40 transition-colors">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">{lead.prospect_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div className="text-muted-foreground">
            {lead.appointment_at
              ? new Date(lead.appointment_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
              : '—'}
          </div>
          <div><Badge variant="outline">{lead.qualification}</Badge></div>
          <ConfirmationBadges confirmations={lead.confirmations || []} />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Confirmation() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['confirmation-leads'],
    queryFn: () => apiClient.listAppointments({ outcome: 'pending' }),
    refetchInterval: 30_000,
  });

  const leads = data?.appointments ?? [];
  const columns = {
    qualification: leads.filter(l => bucket(l) === 'qualification'),
    confirmation: leads.filter(l => bucket(l) === 'confirmation'),
    show: leads.filter(l => bucket(l) === 'show'),
  };

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Confirmation</h1>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && <p className="text-destructive">Failed: {String(error?.message || error)}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            ['qualification', 'Qualification'],
            ['confirmation', 'Confirmation'],
            ['show', 'Show / no-show'],
          ].map(([key, label]) => (
            <div key={key} className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {label} <span className="text-foreground">({columns[key].length})</span>
              </div>
              <div className="space-y-2">
                {columns[key].map(l => <LeadCard key={l.id} lead={l} />)}
                {columns[key].length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
