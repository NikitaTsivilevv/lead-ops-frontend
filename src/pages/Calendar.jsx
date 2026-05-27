import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw, CalendarDays } from 'lucide-react';

const TZ = 'America/New_York';

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toYMD(dt);
}
function todayYMD() { return toYMD(new Date()); }

function formatDayHeader(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(dt);
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}
function getApptDate(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
}
function buildDayRange(from, to) {
  if (!from || !to || from > to) return [];
  const days = [];
  let cur = from;
  let safety = 0;
  while (cur <= to && safety < 400) { // hard cap: 400 days
    days.push(cur);
    cur = addDays(cur, 1);
    safety += 1;
  }
  return days;
}

function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className || ''}`}>
      {children}
    </span>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOps = user && (user.role === 'admin' || user.role === 'operations');
  const showEditAvailability = user && (user.role === 'admin' || user.role === 'operations' || user.role === 'client');

  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(addDays(todayYMD(), 13));
  const [clientId, setClientId] = useState('1');
  const [data, setData] = useState({ slots: [], appointments: [] });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (f, t, cid, isFirst) => {
    setError('');
    if (isFirst) setLoading(true); else setRefetching(true);
    try {
      const params = { from: f, to: t };
      if (isAdminOps && cid) params.client_id = Number(cid);
      const res = await apiClient.getCalendar(params);
      setData({
        slots: Array.isArray(res?.slots) ? res.slots : [],
        appointments: Array.isArray(res?.appointments) ? res.appointments : [],
      });
    } catch (err) {
      setError(err.message || 'Failed to load calendar.');
      setData({ slots: [], appointments: [] });
    } finally {
      if (isFirst) setLoading(false); else setRefetching(false);
    }
  }, [isAdminOps]);

  const firstRender = useRef(true);
  useEffect(() => {
    fetchData(from, to, clientId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    fetchData(from, to, clientId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, clientId]);

  const handleToday = () => {
    const f = todayYMD();
    setFrom(f);
    setTo(addDays(f, 13));
  };

  const slotsByDay = {};
  for (const s of (data.slots || [])) {
    if (!s || !s.date) continue;
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  }
  const apptsByDay = {};
  for (const a of (data.appointments || [])) {
    const day = getApptDate(a?.appointment_at);
    if (!day) continue;
    if (!apptsByDay[day]) apptsByDay[day] = [];
    apptsByDay[day].push(a);
  }
  for (const arr of Object.values(apptsByDay)) {
    arr.sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
  }

  const days = buildDayRange(from, to);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-5">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <h1 className="text-2xl font-semibold self-end">Calendar</h1>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">From</p>
              <Input type="date" className="h-9 w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">To</p>
              <Input type="date" className="h-9 w-36" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" className="h-9" onClick={handleToday}>Today</Button>
            <Button
              size="sm" variant="outline" className="h-9 gap-1.5"
              onClick={() => fetchData(from, to, clientId, false)}
            >
              {refetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          </div>
          {showEditAvailability && (
            <Button size="sm" className="h-9 gap-1.5" onClick={() => navigate('/calendar/availability')}>
              <CalendarDays className="w-4 h-4" /> Edit availability
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : days.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">"From" date must be ≤ "To" date.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {days.map((day) => {
              const daySlots = slotsByDay[day] || [];
              const dayAppts = apptsByDay[day] || [];
              return (
                <Card key={day}>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm font-semibold">{formatDayHeader(day)}</span>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {daySlots.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Closed</span>
                        ) : daySlots.map((s, i) => (
                          <Badge key={i} className={s.source === 'specific' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}>
                            {s.start_time}–{s.end_time} · cap {s.capacity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {dayAppts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No appointments</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayAppts.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => navigate(`/appointments/${a.id}`)}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer"
                          >
                            <span className="text-sm text-muted-foreground w-16 shrink-0">{formatTime(a.appointment_at)}</span>
                            <span className="text-sm font-medium flex-1 min-w-[120px]">{a.prospect_name || '—'}</span>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge className="bg-muted text-muted-foreground">{a.qualification || 'pending'}</Badge>
                              <Badge className="bg-muted text-muted-foreground">{a.client_decision || 'pending'}</Badge>
                              <Badge className="bg-muted text-muted-foreground">{(a.outcome || 'pending').replace(/_/g, ' ')}</Badge>
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
        )}
      </div>
    </div>
  );
}