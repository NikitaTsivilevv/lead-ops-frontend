import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ConfirmationBadges from '@/components/ConfirmationBadges';
import { apiClient } from '@/api/apiClient';
import { confirmationPlan } from '@/lib/confirmationPlan';
import Searchbar from '@/components/Searchbar';

// ─── derived_state badge ──────────────────────────────────────────────────────

const DERIVED_STATE_BADGE = {
  future: 'bg-sky-100 text-sky-800 border-sky-200',
  pending: 'bg-orange-100 text-orange-800 border-orange-200',
  pending_outcome: 'bg-purple-100 text-purple-800 border-purple-200',
};

const DERIVED_STATE_LABEL = {
  future: 'Future',
  pending: 'Pending',
  pending_outcome: 'Pending outcome',
};

function DerivedStateBadge({ derivedState }) {
  if (!derivedState) return null;
  const cls = DERIVED_STATE_BADGE[derivedState];
  if (!cls) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {DERIVED_STATE_LABEL[derivedState] ?? derivedState}
    </span>
  );
}

// ─── column bucketing ─────────────────────────────────────────────────────────

/**
 * Returns the earliest un-confirmed positional column key for a lead.
 * Uses the positional plan so night_before meetings use '1st' / 'final'
 * (2-stage) instead of assuming a 3-stage plan.
 *
 * Column keys: '1st' | '2nd' | 'final'
 */
function nextConfirmationColumn(lead) {
  const stages = confirmationPlan(lead.appointment_at);
  const byStage = Object.fromEntries((lead.confirmations || []).map((c) => [c.stage, c.status]));

  for (let i = 0; i < stages.length; i++) {
    if (byStage[stages[i]] !== 'confirmed') {
      // Map position to column key: last stage → 'final', else '1st'/'2nd'/…
      if (i === stages.length - 1) return 'final';
      const posKeys = ['1st', '2nd', '3rd'];
      return posKeys[i] ?? '1st';
    }
  }
  // All stages confirmed — put in final column
  return 'final';
}

function bucket(lead) {
  if (lead.client_decision === 'rejected') return 'rejected';
  if (lead.qualification === 'pending') return 'qualification';
  if (lead.qualification !== 'qualified') return null; // disqualified: off-board
  // Show / No-show only once an outcome is actually recorded.
  if (lead.show_status === 'show') return 'show';
  if (lead.show_status === 'no_show') return 'no-show';
  // Otherwise the lead is still in the confirmation funnel — bucket by the
  // earliest stage not yet confirmed (positional, handles night_before).
  return nextConfirmationColumn(lead);
}

// ─── card tint ────────────────────────────────────────────────────────────────

const CARD_TINT = {
  rejected: 'border-red-300 bg-red-50',
  'no-show': 'border-gray-300 bg-gray-50',
  show: 'border-blue-200 bg-blue-50',
};

// ─── LeadCard ─────────────────────────────────────────────────────────────────

function LeadCard({ lead }) {
  const tint = CARD_TINT[bucket(lead)] || '';
  return (
    <Link to={`/appointments/${lead.id}`} className="block">
      <Card className={`hover:bg-accent/40 transition-colors ${tint}`}>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">{lead.prospect_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div className="text-muted-foreground">
            {lead.appointment_at
              ? new Date(lead.appointment_at).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                })
              : '—'}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant="outline">{lead.qualification}</Badge>
            {/* Additive derived_state badge — does not replace confirmation_status logic */}
            <DerivedStateBadge derivedState={lead.derived_state} />
          </div>
          <ConfirmationBadges
            confirmations={lead.confirmations || []}
            appointmentAt={lead.appointment_at}
          />
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Confirmation() {
  const [clientFilter, setClientFilter] = React.useState('');
  const [clients, setClients] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [colFilter, setColFilter] = React.useState('');
  React.useEffect(() => {
    apiClient
      .listClients()
      .then((d) => setClients(Array.isArray(d) ? d : d.clients || []))
      .catch(() => setClients([]));
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['confirmation-leads'],
    queryFn: () => apiClient.listAppointments({}),
    refetchInterval: 30_000,
  });

  const all = data?.appointments ?? [];
  const leads = all.filter((l) => {
    if (clientFilter && String(l.client_id) !== clientFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.prospect_name?.toLowerCase().includes(q) || l.prospect_phone?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const COLS = [
    ['qualification', 'Qualification'],
    ['rejected', 'Rejected'],
    ['1st', '1st call'],
    ['2nd', '2nd call'],
    ['final', 'Final call'],
    ['show', 'Show'],
    ['no-show', 'No-show'],
  ];
  const grouped = Object.fromEntries(COLS.map(([k]) => [k, []]));
  leads.forEach((l) => {
    const b = bucket(l);
    if (b && grouped[b]) grouped[b].push(l);
  });

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-none mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h1 className="text-2xl font-semibold">Confirmation</h1>
          <div className="w-full flex flex-row gap-4">
            <select
              className="h-9 rounded-md border bg-white px-2 text-sm"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border bg-white px-2 text-sm w-[200px]"
              value={colFilter}
              onChange={(e) => setColFilter(e.target.value)}>
              <option value="">All columns</option>
              {COLS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Searchbar
              value={search}
              onChange={setSearch}
              placeholder="Search by name or phone…"
              className="w-[250px]"
            />
          </div>
        </div>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && <p className="text-destructive">Failed: {String(error?.message || error)}</p>}

        {colFilter ? (
          <>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {COLS.find(([k]) => k === colFilter)?.[1]}{' '}
              <span className="text-foreground">({grouped[colFilter].length})</span>
            </div>
            {grouped[colFilter].length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No cards in this column.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {grouped[colFilter].map((l) => (
                  <div key={l.id} className="w-64 shrink-0">
                    <LeadCard lead={l} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {COLS.map(([key, label]) => (
              <div key={key} className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {label} <span className="text-foreground">({grouped[key].length})</span>
                </div>
                <div className="space-y-2">
                  {grouped[key].map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
                  {grouped[key].length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Empty</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
