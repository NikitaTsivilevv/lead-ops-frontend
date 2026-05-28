import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/api/apiClient';

function formatEastern(iso) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' });
}

function describe(entry) {
  const actor = entry.changed_by_name
    ? `${entry.changed_by_name}${entry.changed_by_role ? ` (${entry.changed_by_role})` : ''}`
    : 'System';
  const oldV = entry.old_value === null || entry.old_value === undefined ? '∅' : JSON.stringify(entry.old_value);
  const newV = entry.new_value === null || entry.new_value === undefined ? '∅' : JSON.stringify(entry.new_value);
  return `${actor} changed ${entry.field}: ${oldV} → ${newV}`;
}

export default function AuditLogPanel({ appointmentId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['appointment-history', appointmentId],
    queryFn: () => apiClient.getAppointmentHistory(appointmentId),
    enabled: !!appointmentId,
  });

  const history = data?.history ?? [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Activity log</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && <p className="text-destructive">Failed: {String(error?.message || error)}</p>}
        {!isLoading && !isError && history.length === 0 && (
          <p className="text-muted-foreground">No activity yet.</p>
        )}
        {history.length > 0 && (
          <ul className="space-y-2">
            {history.map((e) => (
              <li key={e.id} className="border-l-2 border-muted pl-3">
                <div>{describe(e)}</div>
                <div className="text-xs text-muted-foreground">{formatEastern(e.changed_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
