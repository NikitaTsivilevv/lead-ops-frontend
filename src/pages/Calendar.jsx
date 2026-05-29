import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, RefreshCw, CalendarDays, LayoutList, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

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
function fromYMD(ymd) {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDisplayDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

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
  while (cur <= to && safety < 400) {
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

const STATUS_COLORS = {
  confirmed: '#22c55e',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  completed: '#6366f1',
};

const QUAL_BADGE = {
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-800',
};
const OUTCOME_BADGE = {
  sold: 'bg-green-100 text-green-800',
  not_sold: 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-700',
  reschedule_needed: 'bg-orange-100 text-orange-800',
};

function clientDecisionColor(val) {
  if (val === true || val === 'accepted') return 'bg-green-100 text-green-800';
  if (val === false || val === 'rejected') return 'bg-red-100 text-red-800';
  if (val === 'auto-accepted') return 'bg-blue-100 text-blue-800';
  return 'bg-muted text-muted-foreground';
}
function clientDecisionLabel(val) {
  if (val === null || val === undefined) return 'Pending';
  if (val === true || val === 'accepted') return 'Accepted';
  if (val === false || val === 'rejected') return 'Rejected';
  if (val === 'auto-accepted') return 'Auto-accepted';
  return String(val);
}
function formatFullDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).format(new Date(iso));
}
function YesNo({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className={value ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{value ? 'Yes' : 'No'}</span>;
}
function ModalRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-0">
      <span className="text-xs text-muted-foreground sm:w-40 shrink-0">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function apptToEvent(a) {
  if (!a?.appointment_at) return null;
  const outcome = a.outcome || 'pending';
  const color = STATUS_COLORS[outcome] || '#6366f1';
  return {
    id: String(a.id),
    title: a.prospect_name || 'Appointment',
    start: a.appointment_at,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { appointment: a },
  };
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Non-client-scoped staff must send a client_id to the calendar/availability API
  // (confirmation included — otherwise the backend returns client_id_required).
  const isAdminOps = user && ['admin', 'operations', 'confirmation'].includes(user.role);
  const showEditAvailability = user && (user.role === 'admin' || user.role === 'operations' || user.role === 'client');

  const [view, setView] = useState('table'); // 'table' | 'calendar'
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(addDays(todayYMD(), 13));
  const [clientId, setClientId] = useState('1');
  const [data, setData] = useState({ slots: [], appointments: [] });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState('');
  const [selectedAppt, setSelectedAppt] = useState(null);

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
  const calendarRef = useRef(null);
  useEffect(() => {
    fetchData(from, to, clientId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (view === 'calendar') return;
    fetchData(from, to, clientId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, clientId, view]);

  const handleToday = () => {
    const f = todayYMD();
    setFrom(f);
    setTo(addDays(f, 13));
    calendarRef.current?.getApi().today();
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

  const calendarEvents = (data.appointments || [])
    .map(apptToEvent)
    .filter(Boolean);

  const handleEventClick = ({ event }) => {
    const appt = event.extendedProps?.appointment;
    if (appt) setSelectedAppt(appt);
  };

  const handleDatesSet = useCallback(({ startStr, endStr }) => {
    const f = startStr.slice(0, 10);
    const t = endStr.slice(0, 10);
    fetchData(f, t, clientId, false);
  }, [fetchData, clientId]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1000px] mx-auto space-y-5">
        {/* Page title row */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          {showEditAvailability && (
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => navigate('/calendar/availability')}>
              <CalendarDays className="w-4 h-4" /> Edit availability
            </Button>
          )}
        </div>

        {/* Controls toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 font-normal min-w-[210px] justify-start">
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    {view === 'table'
                      ? (from && to ? `${formatDisplayDate(fromYMD(from))} – ${formatDisplayDate(fromYMD(to))}` : 'Select date range')
                      : (from ? formatDisplayDate(fromYMD(from)) : 'Jump to date')}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode={view === 'table' ? 'range' : 'single'}
                  selected={view === 'table' ? { from: fromYMD(from), to: fromYMD(to) } : fromYMD(from)}
                  onSelect={(val) => {
                    if (view === 'calendar') {
                      if (val) {
                        const ymd = toYMD(val);
                        setFrom(ymd);
                        calendarRef.current?.getApi().gotoDate(ymd);
                        setCalendarOpen(false);
                      }
                    } else {
                      if (val?.from) setFrom(toYMD(val.from));
                      if (val?.to) { setTo(toYMD(val.to)); setCalendarOpen(false); }
                      else if (val?.from) setTo('');
                    }
                  }}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="outline" className="h-9" onClick={handleToday}>Today</Button>
            <Button
              size="sm" variant="outline" className="h-9 gap-1.5"
              onClick={() => fetchData(from, to, clientId, false)}
              disabled={refetching}
            >
              {refetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          </div>

          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors ${
                view === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm border-l border-input transition-colors ${
                view === 'calendar'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'calendar' ? (
          <>
          <Card>
            <CardContent className="pt-4 pb-4">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                timeZone={TZ}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={calendarEvents}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                height="auto"
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
              />
            </CardContent>
          </Card>

          <Dialog open={!!selectedAppt} onOpenChange={(open) => !open && setSelectedAppt(null)}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedAppt?.prospect_name || 'Appointment'}</DialogTitle>
                <DialogDescription>{selectedAppt ? formatFullDateTime(selectedAppt.appointment_at) : ''}</DialogDescription>
              </DialogHeader>
              {selectedAppt && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={QUAL_BADGE[selectedAppt.qualification] || 'bg-muted text-muted-foreground'}>
                      <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">Qual</span>
                      {selectedAppt.qualification || 'pending'}
                    </Badge>
                    <Badge className={clientDecisionColor(selectedAppt.client_decision)}>
                      <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">Decision</span>
                      {clientDecisionLabel(selectedAppt.client_decision)}
                    </Badge>
                    <Badge className={OUTCOME_BADGE[selectedAppt.outcome] || 'bg-muted text-muted-foreground'}>
                      <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">Outcome</span>
                      {(selectedAppt.outcome || 'pending').replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <ModalRow label="Address">{selectedAppt.address || '—'}</ModalRow>
                    <ModalRow label="Phone">{selectedAppt.phone || '—'}</ModalRow>
                    {Array.isArray(selectedAppt.renovation_items) && selectedAppt.renovation_items.length > 0 && (
                      <ModalRow label="Renovations">
                        <span className="flex flex-wrap gap-1">
                          {selectedAppt.renovation_items.map(r => (
                            <span key={r} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs">{r}</span>
                          ))}
                        </span>
                      </ModalRow>
                    )}
                    <ModalRow label="Campaign">{selectedAppt.campaign_source || '—'}</ModalRow>
                    {selectedAppt.assigned_closer && (
                      <ModalRow label="Closer">{selectedAppt.assigned_closer}</ModalRow>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qualifications</p>
                    <ModalRow label="Homeowner?"><YesNo value={selectedAppt.q_homeowner} /></ModalRow>
                    <ModalRow label="Mortgage current?"><YesNo value={selectedAppt.q_mortgage_current} /></ModalRow>
                    <ModalRow label="Credit score">{selectedAppt.credit_score_band || '—'}</ModalRow>
                    <ModalRow label="Utility bill">{selectedAppt.utility_bill_raw || '—'}</ModalRow>
                  </div>

                  {selectedAppt.recording_url && (
                    <ModalRow label="Recording">
                      <a href={selectedAppt.recording_url} target="_blank" rel="noopener noreferrer"
                         className="text-primary underline-offset-4 hover:underline text-sm">
                        Listen
                      </a>
                    </ModalRow>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setSelectedAppt(null); navigate(`/appointments/${selectedAppt.id}`); }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View full details
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedAppt(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          </>
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
