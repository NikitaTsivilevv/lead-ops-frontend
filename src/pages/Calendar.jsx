import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, CalendarDays } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

function todayYMD() {
  return toYMD(new Date());
}

function formatDayHeader(ymd) {
  // Parse as local midnight
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0); // use noon to avoid DST edge
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(isoString));
}

function getApptDate(isoString) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date(isoString)); // returns YYYY-MM-DD
}

function buildDayRange(from, to) {
  const days = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

// ── badge helpers ──────────────────────────────────────────────────────────

const QUAL_COLORS = {
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-800',
};
const OUTCOME_COLORS = {
  sold: 'bg-green-100 text-green-800',
  'not sold': 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  'no-show': 'bg-gray-100 text-gray-700',
  'reschedule needed': 'bg-orange-100 text-orange-800',
};

function clientDecisionLabel(val) {
  if (val === null || val === undefined) return 'Pending';
  if (val === true || val === 'accepted') return 'Accepted';
  if (val === false || val === 'rejected') return 'Rejected';
  if (val === 'auto-accepted') return 'Auto-accepted';
  return String(val);
}
function clientDecisionColor(val) {
  if (val === true || val === 'accepted') return 'bg-green-100 text-green-800';
  if (val === false || val === 'rejected') return 'bg-red-100 text-red-800';
  if (val === 'auto-accepted') return 'bg-blue-100 text-blue-800';
  return 'bg-muted text-muted-foreground';
}

function SmallBadge({ label, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ── slot badge ─────────────────────────────────────────────────────────────

function SlotBadge({ slot }) {
  const color = slot.source === 'specific'
    ? 'bg-amber-100 text-amber-800'
    : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {slot.start_time}–{slot.end_time} · cap {slot.capacity}
    </span>
  );
}

// ── CLIENT_OPTIONS TODO ────────────────────────────────────────────────────
// TODO: replace with GET /api/clients when exposed
const CLIENT_OPTIONS = [
  { id: 1, name: 'Guy Green Constructions' },
];

// ── main component ─────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultFrom = todayYMD();
  const defaultTo = addDays(defaultFrom, 13);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [clientId, setClientId] = useState('1');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState('');

  const isAdminOps = ['admin', 'operations'].includes(user?.role);
  const showEditAvailability = ['admin', 'operations', 'client'].includes(user?.role);

  const fetchData = useCallback(async (f, t, cid, isFirst = false) => {
    setError('');
    if (isFirst) setLoading(true);
    else setRefetching(true);
    try {
      const params = { from: f, to: t };
      if (isAdminOps && cid) params.client_id = Number(cid);
      const res = await apiClient.getCalendar(params);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load calendar.');
    } finally {
      if (isFirst) setLoading(false);
      else setRefetching(false);
    }
  }, [isAdminOps]);

  // Initial load
  useEffect(() => {
    fetchData(from, to, clientId, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when range or client changes (skip initial)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchData(from, to, clientId, false);
  }, [from, to, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToday = () => {
    const f = todayYMD();
    const t = addDays(f, 13);
    setFrom(f);
    setTo(t);
  };

  // ── build day map ────────────────────────────────────────────────────────

  const slots = data?.slots || [];
  const appointments = data?.appointments || [];

  const slotsByDay = {};
  slots.forEach(s => {
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  });

  const apptsByDay = {};
  appointments.forEach(a => {
    const day = getApptDate(a.appointment_at);
    if (!apptsByDay[day]) apptsByDay[day] = [];
    apptsByDay[day].push(a);
  });
  // Sort appointments within each day
  Object.values(apptsByDay).forEach(arr =>
    arr.sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at))
  );

  const days = from <= to ? buildDayRange(from, to) : [];

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-5">

        {/* Top bar */}
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <h1 className="text-2xl font-semibold text-foreground self-end">Calendar</h1>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">From</p>
              <Input type="date" className="h-9 w-36" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">To</p>
              <Input type="date" className="h-9 w-36" value={to} onChange={e => setTo(e.target.value)} />
            </div>

            <Button size="sm" variant="outline" className="h-9" onClick={handleToday}>Today</Button>

            {/* Client selector — admin/operations only */}
            {isAdminOps && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Client</p>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="w-52 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_OPTIONS.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => fetchData(from, to, clientId, false)}
            >
              {refetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          </div>

          {showEditAvailability && (
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => navigate('/calendar/availability')}
            >
              <CalendarDays className="w-4 h-4" />
              Edit availability
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => fetchData(from, to, clientId, false)}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading spinner (first load) */}
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty range */}
        {!loading && !error && from > to && (
          <div className="py-20 text-center text-muted-foreground text-sm">
            "From" date must be before "To" date.
          </div>
        )}

        {/* Day cards */}
        {!loading && !error && from <= to && (
          days.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">Nothing in this range.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {days.map(day => {
                const daySlots = slotsByDay[day] || [];
                const dayAppts = apptsByDay[day] || [];
                return (
                  <Card key={day}>
                    <CardContent className="pt-4 pb-4 space-y-3">
                      {/* Day header */}
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm font-semibold text-foreground">{formatDayHeader(day)}</span>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {daySlots.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Closed</span>
                          ) : (
                            daySlots.map((s, i) => <SlotBadge key={i} slot={s} />)
                          )}
                        </div>
                      </div>

                      {/* Appointments */}
                      {dayAppts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No appointments</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayAppts.map(appt => (
                            <div
                              key={appt.id}
                              onClick={() => navigate(`/appointments/${appt.id}`)}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <span className="text-sm text-muted-foreground w-16 shrink-0">
                                {formatTime(appt.appointment_at)}
                              </span>
                              <span className="text-sm font-medium text-foreground flex-1 min-w-[120px]">
                                {appt.prospect_name || '—'}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <SmallBadge
                                  label={appt.qualification || 'pending'}
                                  className={QUAL_COLORS[appt.qualification?.toLowerCase()] || 'bg-muted text-muted-foreground'}
                                />
                                <SmallBadge
                                  label={clientDecisionLabel(appt.client_decision)}
                                  className={clientDecisionColor(appt.client_decision)}
                                />
                                <SmallBadge
                                  label={appt.outcome || 'pending'}
                                  className={OUTCOME_COLORS[appt.outcome?.toLowerCase()] || 'bg-muted text-muted-foreground'}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}