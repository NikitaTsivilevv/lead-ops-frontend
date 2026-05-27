import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, addDays } from 'date-fns';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import AppHeader from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';

const TZ = 'America/New_York';

const COLUMNS = [
  { key: 'new',          label: 'New',          color: '#94a3b8' },
  { key: 'qualified',    label: 'Qualified',     color: '#3b82f6' },
  { key: 'disqualified', label: 'Disqualified',  color: '#ef4444' },
  { key: 'accepted',     label: 'Accepted',      color: '#6366f1' },
  { key: 'rejected',     label: 'Rejected',      color: '#f97316' },
  { key: 'showed',       label: 'Showed',        color: '#22c55e' },
  { key: 'sold',         label: 'Sold',          color: '#16a34a' },
  { key: 'not_sold',     label: 'Not Sold',      color: '#84cc16' },
  { key: 'no_show',      label: 'No-show',       color: '#dc2626' },
  { key: 'reschedule',   label: 'Reschedule',    color: '#f59e0b' },
];

function classify(appt) {
  const { qualification, client_decision, outcome, need_reschedule } = appt;
  if (outcome === 'reschedule_needed' || need_reschedule === true) return 'reschedule';
  if (outcome === 'no_show')   return 'no_show';
  if (outcome === 'not_sold')  return 'not_sold';
  if (outcome === 'sold')      return 'sold';
  if (outcome === 'showed')    return 'showed';
  if (client_decision === 'rejected') return 'rejected';
  if (qualification === 'qualified' && ['accepted', 'auto_accepted'].includes(client_decision) && outcome === 'pending') return 'accepted';
  if (qualification === 'disqualified') return 'disqualified';
  if (qualification === 'qualified' && client_decision === 'pending') return 'qualified';
  return 'new';
}

function fmtTime(appt) {
  const raw = appt.appointment_date || appt.appointment_time || appt.scheduled_at;
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('en-US', {
      timeZone: TZ,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function StatusBadge({ label }) {
  if (!label || label === 'pending' || label === 'none') return <span className="text-[10px] text-muted-foreground">{label || '—'}</span>;
  return (
    <span className="inline-block rounded px-1 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground leading-tight">
      {label}
    </span>
  );
}

function AppointmentCard({ appt }) {
  const navigate = useNavigate();
  const name = appt.prospect_name || appt.name || `#${appt.id}`;
  const address = [appt.street, appt.city, appt.state].filter(Boolean).join(', ') || appt.address || '—';

  return (
    <div
      onClick={() => navigate(`/appointments/${appt.id}`)}
      className="cursor-pointer rounded-lg border bg-background p-3 hover:shadow-md hover:bg-slate-50 transition-all"
    >
      <p className="font-semibold text-sm truncate leading-snug">{name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(appt)}</p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{address}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        <StatusBadge label={appt.qualification} />
        <StatusBadge label={appt.client_decision} />
        <StatusBadge label={appt.outcome} />
      </div>
    </div>
  );
}

function Column({ col, cards }) {
  return (
    <div
      className="flex-shrink-0 w-[280px] rounded-xl border bg-background flex flex-col"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 bg-background rounded-t-xl px-3 pt-3 pb-2 border-b"
        style={{ borderTop: `3px solid ${col.color}` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{col.label}</span>
          <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 tabular-nums">
            {cards.length}
          </span>
        </div>
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">—</div>
        ) : (
          cards.map(appt => <AppointmentCard key={appt.id} appt={appt} />)
        )}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'operations'].includes(user?.role);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  // TODO: replace hardcoded client_id=1 with a real picker once the API supports listing clients
  const clientId = isAdmin ? 1 : undefined;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const params = { from, to };
    if (isAdmin) params.client_id = clientId;
    try {
      const data = await apiClient.listAppointments(params);
      setAppointments(Array.isArray(data) ? data : (data?.appointments ?? []));
    } catch (err) {
      setError(err.message || 'Failed to load appointments');
    }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [from, to, isAdmin, clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Bucket into columns
  const buckets = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
  appointments.forEach(appt => {
    const key = classify(appt);
    buckets[key].push(appt);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <div className="px-4 py-4">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <label className="text-sm text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            <label className="text-sm text-muted-foreground">To</label>
            <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="w-36 h-8 text-sm" />
            <Button size="sm" variant="outline" onClick={() => fetchData(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
            {refreshing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => fetchData()}>Retry</Button>
          </div>
        )}

        {/* Full-page spinner on first load */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {COLUMNS.map(col => (
                <Column key={col.key} col={col} cards={buckets[col.key]} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}