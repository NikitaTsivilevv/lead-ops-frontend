import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/api/apiClient';

function formatEastern(iso) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' });
}

const FIELD_LABEL = {
  qualification: 'qualification',
  qualification_note: 'qualification note',
  client_decision: 'client decision',
  client_decision_note: 'client decision note',
  outcome: 'outcome',
  show_status: 'show status',
  sale_status: 'sale status',
  need_reschedule: 'reschedule requested',
  sale_amount: 'sale amount',
  items_sold: 'items sold',
  no_show_reason: 'no-show reason',
  meeting_notes: 'meeting notes',
  sales_notes: 'sales notes',
  assigned_closer: 'assigned closer',
  appointment_at: 'appointment time',
  team_approved: 'team payout approved',
  team_paid: 'team paid',
  client_billed: 'client billed',
  client_paid: 'client paid',
  approved_for_billing: 'approved for billing',
  client_charge_amount: 'billing amount',
};

function formatValue(field, value) {
  if (value === null || value === undefined) return '∅';
  if (field === 'appointment_at' && typeof value === 'string') {
    try { return new Date(value).toLocaleString('en-US', { timeZone: 'America/New_York' }); }
    catch { return String(value); }
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Some legacy service handlers (e.g. updateQualification) record the whole body as
// a JSON object instead of one row per field. Render those as a list of only the
// keys that actually changed, otherwise we get raw `{"foo":null,"bar":"x"}` blobs.
function describeObjectDiff(actor, fieldLabel, oldObj, newObj) {
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  const changes = [];
  for (const k of keys) {
    const a = oldObj?.[k];
    const b = newObj?.[k];
    if (a === b) continue;
    const subLabel = FIELD_LABEL[k] || k.replace(/_/g, ' ');
    changes.push(`${subLabel}: ${formatValue(k, a)} → ${formatValue(k, b)}`);
  }
  if (changes.length === 0) {
    return `${actor} touched ${fieldLabel} (no effective change)`;
  }
  return `${actor} updated ${fieldLabel} — ${changes.join('; ')}`;
}

function describe(entry) {
  const actor = entry.changed_by_name
    ? `${entry.changed_by_name}${entry.changed_by_role ? ` (${entry.changed_by_role})` : ''}`
    : 'System';

  // The 'created' row is written when the appointment is first inserted; show it as a one-liner.
  if (entry.field === 'created') {
    return `${actor} created the lead`;
  }

  const fieldLabel = FIELD_LABEL[entry.field] || entry.field.replace(/_/g, ' ');

  // Object-valued history rows (e.g. qualification stores {qualification, note}).
  if (isPlainObject(entry.old_value) || isPlainObject(entry.new_value)) {
    return describeObjectDiff(actor, fieldLabel, entry.old_value || {}, entry.new_value || {});
  }

  const oldV = formatValue(entry.field, entry.old_value);
  const newV = formatValue(entry.field, entry.new_value);

  if (entry.old_value === null || entry.old_value === undefined) {
    return `${actor} set ${fieldLabel} to ${newV}`;
  }
  return `${actor} changed ${fieldLabel}: ${oldV} → ${newV}`;
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
