import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { leadDisplayName } from '@/lib/leadName';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Loader2,
  RefreshCw,
  CalendarDays,
  LayoutList,
  Calendar as CalendarIcon,
  ExternalLink,
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Searchbar from '@/components/Searchbar';
import TablePagination from '@/components/TablePagination';
import ConfirmationBadges from '@/components/ConfirmationBadges';
import {
  Badge,
  QUAL_BADGE,
  SHOW_STATUS_BADGE,
  SALE_STATUS_BADGE,
  clientDecisionColor,
  clientDecisionLabel,
} from '@/components/AppointmentBadge';

const TZ = 'America/New_York';

function etDecimalHour(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return h + m / 60;
}

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
function todayYMD() {
  return toYMD(new Date());
}
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
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dt);
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}
function formatShortTime(date) {
  if (!date) return '';
  const str = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return str.replace(':00', '').replace(' ', '').toLowerCase();
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

function formatFullDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(iso));
}
function confirmationSummary(confirmations) {
  if (!Array.isArray(confirmations) || confirmations.length === 0) return 'pending';
  if (confirmations.some((c) => c.status === 'confirmed')) return 'confirmed';
  if (confirmations.some((c) => c.status === 'failed')) return 'failed';
  return 'pending';
}
const CONFIRM_BADGE = {
  confirmed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

function YesNo({ value }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <span className={value ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
      {value ? 'Yes' : 'No'}
    </span>
  );
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
  let color = '#94a3b8';
  if (a.sale_status === 'sold') color = '#16a34a';
  else if (a.show_status === 'no_show') color = '#dc2626';
  else if (a.sale_status === 'not_sold') color = '#84cc16';
  else if (a.show_status === 'show') color = '#22c55e';
  else if (a.client_decision === 'accepted' || a.client_decision === 'auto_accepted')
    color = '#6366f1';
  else if (a.qualification === 'disqualified') color = '#ef4444';
  else if (a.qualification === 'qualified') color = '#3b82f6';
  return {
    id: String(a.id),
    title: leadDisplayName(a),
    start: a.appointment_at,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { appointment: a },
  };
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isAdminOps = user && ['admin', 'operations', 'call_center_admin'].includes(user.role);
  const isConfirmation = user?.role === 'confirmation';
  const showClientDropdown = isAdminOps || isConfirmation;

  const showEditAvailability =
    user && (user.role === 'admin' || user.role === 'operations' || user.role === 'call_center_admin' || user.role === 'client');

  const [view, setView] = useState('table'); // 'table' | 'calendar'
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(addDays(todayYMD(), 13));

  const [clientId, setClientId] = useState('1');
  const [clients, setClients] = useState([]);
  useEffect(() => {
    if (!isAdminOps) return;
    apiClient
      .listClients()
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients || [];
        setClients(list);
        if (list[0]) setClientId(String(list[0].id));
      })
      .catch(() => setClients([]));
  }, [isAdminOps]);

  const [data, setData] = useState({ slots: [], appointments: [], unavailability: [] });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState('');
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmFilter, setConfirmFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const clientsRef = useRef([]);
  useEffect(() => {
    if (!showClientDropdown) return;
    apiClient
      .listClients()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.clients ?? []);
        clientsRef.current = list;
        setClients(list);
        // dropdown roles skip the mount fetch — trigger it here once clients are ready
        fetchData(from, to, clientId, true);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(
    async (f, t, cid, isFirst) => {
      setError('');
      if (isFirst) setLoading(true);
      else setRefetching(true);
      try {
        // backend requires client_id for dropdown roles — fan out over all clients when none selected
        const needsFanOut = showClientDropdown && !cid;
        const ids = needsFanOut ? clientsRef.current.map((c) => c.id) : null;

        if (needsFanOut && ids.length > 0) {
          const results = await Promise.all(
            ids.map((id) => apiClient.getCalendar({ from: f, to: t, client_id: id })),
          );
          const allSlots = results.flatMap((r) => (Array.isArray(r?.slots) ? r.slots : []));
          const allAppts = results.flatMap((r) =>
            Array.isArray(r?.appointments) ? r.appointments : [],
          );
          const allBlocks = results.flatMap((r) =>
            Array.isArray(r?.unavailability) ? r.unavailability : [],
          );
          setData({ slots: allSlots, appointments: allAppts, unavailability: allBlocks });
        } else {
          const params = { from: f, to: t };
          if (cid) params.client_id = Number(cid);
          const res = await apiClient.getCalendar(params);
          setData({
            slots: Array.isArray(res?.slots) ? res.slots : [],
            appointments: Array.isArray(res?.appointments) ? res.appointments : [],
            unavailability: Array.isArray(res?.unavailability) ? res.unavailability : [],
          });
        }
      } catch (err) {
        setError(err.message || 'Failed to load calendar.');
        setData({ slots: [], appointments: [] });
      } finally {
        if (isFirst) setLoading(false);
        else setRefetching(false);
      }
    },
    [isConfirmation, showClientDropdown],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const firstRender = useRef(true);
  const calendarRef = useRef(null);
  const calendarRangeRef = useRef({ from, to });

  useEffect(() => {
    if (showClientDropdown) return; // waits for listClients to resolve first
    fetchData(from, to, clientId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (view === 'calendar') return;
    fetchData(from, to, clientId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, clientId, view]);

  // When clientId changes while in calendar view, refetch using the current visible range
  useEffect(() => {
    if (view !== 'calendar') return;
    const { from: f, to: t } = calendarRangeRef.current;
    fetchData(f, t, clientId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleToday = () => {
    const f = todayYMD();
    setFrom(f);
    setTo(addDays(f, 13));
    calendarRef.current?.getApi().today();
  };

  const slotsByDay = {};
  for (const s of data.slots || []) {
    if (!s || !s.date) continue;
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  }
  const slotsByDayRef = useRef(slotsByDay);
  slotsByDayRef.current = slotsByDay;

  // Build per-day unavailability bars: each bar is { topPct, heightPct } mapped to 0-24h scale
  const unavailBarsByDay = {};
  for (const b of data.unavailability || []) {
    let cur = b.start_at.slice(0, 10);
    const endDate = b.end_at.slice(0, 10);
    let safety = 0;
    while (cur <= endDate && safety < 366) {
      if (!unavailBarsByDay[cur]) unavailBarsByDay[cur] = { allDay: false, bars: [] };
      if (b.all_day) {
        unavailBarsByDay[cur].allDay = true;
      } else {
        const startH = etDecimalHour(b.start_at);
        const endH = etDecimalHour(b.end_at);
        unavailBarsByDay[cur].bars.push({
          topPct: (startH / 24) * 100,
          heightPct: Math.max(((endH - startH) / 24) * 100, 2),
        });
      }
      cur = addDays(cur, 1);
      safety++;
    }
  }
  const unavailBarsByDayRef = useRef(unavailBarsByDay);
  unavailBarsByDayRef.current = unavailBarsByDay;
  const apptsByDay = {};
  for (const a of data.appointments || []) {
    const day = getApptDate(a?.appointment_at);
    if (!day) continue;
    if (!apptsByDay[day]) apptsByDay[day] = [];
    apptsByDay[day].push(a);
  }
  for (const arr of Object.values(apptsByDay)) {
    arr.sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
  }
  // for new pull
  // for new pull
  const days = buildDayRange(from, to);

  useEffect(() => {
    setPage(0);
  }, [search, confirmFilter, from, to]);

  const searchLower = search.trim().toLowerCase();
  const filteredApptsByDay = Object.fromEntries(
    Object.entries(apptsByDay).map(([day, appts]) => [
      day,
      appts.filter((a) => {
        if (
          searchLower &&
          ![
            a.prospect_name,
            a.address,
            a.phone,
            a.assigned_closer,
            a.campaign_source,
            a.qualification,
            a.outcome,
          ].some((v) => v && String(v).toLowerCase().includes(searchLower))
        )
          return false;
        if (confirmFilter && confirmationSummary(a.confirmations) !== confirmFilter) return false;
        return true;
      }),
    ]),
  );
  const isFiltered = searchLower || confirmFilter;
  const visibleDays = isFiltered
    ? days.filter((day) => (filteredApptsByDay[day] || []).length > 0)
    : days;

  const totalPages = Math.ceil(visibleDays.length / pageSize);
  const pagedDays = visibleDays.slice(page * pageSize, (page + 1) * pageSize);

  const calendarEvents = (data.appointments || [])
    .filter((a) => !confirmFilter || confirmationSummary(a.confirmations) === confirmFilter)
    .map(apptToEvent)
    .filter(Boolean);

  const availabilityEvents = (data.slots || []).flatMap((s) => {
    if (!s?.date || !s?.start_time || !s?.end_time) return [];
    const blocked = Number(s.capacity) === 0;
    return [
      {
        start: `${s.date}T${s.start_time}`,
        end: `${s.date}T${s.end_time}`,
        display: 'background',
        color: blocked ? '#fca5a5' : '#86efac',
        extendedProps: { isAvailability: true },
      },
    ];
  });

  const unavailabilityEvents = (data.unavailability || []).map((b) => {
    const base = {
      id: `unavail-${b.id}`,
      title: b.title || 'Unavailable',
      backgroundColor: '#ef4444',
      borderColor: '#dc2626',
      textColor: '#fff',
      extendedProps: { isUnavailability: true },
    };
    if (b.all_day) {
      // Use raw UTC date strings — avoids the UTC→Eastern shift that renders a
      // UTC-midnight block at 8 pm the previous day in Eastern time.
      const startDate = b.start_at.slice(0, 10);
      const endDate = b.end_at.slice(0, 10);
      // FullCalendar all-day end is exclusive; if UTC dates match (end stored as
      // same-day 23:59 Z) bump by one so the event covers the full day.
      return {
        ...base,
        start: startDate,
        end: startDate === endDate ? addDays(endDate, 1) : endDate,
        allDay: true,
      };
    }
    // Partial-day: render as a background tint so it doesn't block event rendering.
    return {
      id: `unavail-${b.id}`,
      start: b.start_at,
      end: b.end_at,
      display: 'background',
      color: 'rgba(239,68,68,0.55)',
      extendedProps: { isUnavailability: true },
    };
  });

  const handleEventClick = async ({ event }) => {
    const appt = event.extendedProps?.appointment;
    if (!appt) return;
    setSelectedAppt(appt);
    setModalLoading(true);
    try {
      const data = await apiClient.getAppointment(appt.id);
      const full = data?.appointment || data;
      if (full) setSelectedAppt(full);
    } catch {
      // keep the summary data already shown
    } finally {
      setModalLoading(false);
    }
  };

  const handleDatesSet = useCallback(
    ({ startStr, endStr, view }) => {
      const f = startStr.slice(0, 10);
      const t = endStr.slice(0, 10);
      calendarRangeRef.current = { from: f, to: t };
      fetchData(f, t, clientId, false);
      if (view.type === 'timeGridWeek' || view.type === 'timeGridDay') {
        setTimeout(() => {
          const el = calendarRef.current?.getApi()?.el;
          const slot = el?.querySelector('[data-time="07:00:00"]');
          if (slot) slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
    [fetchData, clientId],
  );

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="space-y-6">
        {/* Page title row */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          {showEditAvailability && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/calendar/availability')}>
              <CalendarDays className="w-4 h-4 text-white" />
              <span className="hidden sm:inline text-white">Edit availability</span>
              <span className="sm:hidden">Availability</span>
            </Button>
          )}
        </div>

        {/* Controls toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-md border border-gray-200 p-2 shadow-sm">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-2 font-normal min-w-0 flex-1 sm:flex-none sm:min-w-[210px] justify-start">
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {view === 'table'
                    ? from && to
                      ? `${formatDisplayDate(fromYMD(from))} – ${formatDisplayDate(fromYMD(to))}`
                      : 'Select range'
                    : from
                      ? formatDisplayDate(fromYMD(from))
                      : 'Jump to date'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode={view === 'table' ? 'range' : 'single'}
                selected={
                  view === 'table' ? { from: fromYMD(from), to: fromYMD(to) } : fromYMD(from)
                }
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
                    if (val?.to) {
                      setTo(toYMD(val.to));
                      setCalendarOpen(false);
                    } else if (val?.from) setTo('');
                  }
                }}
                numberOfMonths={1}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="outline" className="h-9" onClick={handleToday}>
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => fetchData(from, to, clientId, false)}
            disabled={refetching}>
            {refetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Select
            value={confirmFilter || '_all'}
            onValueChange={(v) => setConfirmFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9 w-40 shrink-0">
              <SelectValue placeholder="Confirmation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          {isAdminOps && showClientDropdown && clients.length > 0 && (
            <Select
              value={clientId || '_all'}
              onValueChange={(v) => setClientId(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-9 w-44 shrink-0">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex rounded-md border border-input overflow-hidden ml-auto">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors ${
                view === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}>
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm border-l border-input transition-colors ${
                view === 'calendar'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}>
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
          <div
            className={`
            w-full
          `}>
            <Searchbar value={search} onChange={setSearch} placeholder="Search appointments…" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'calendar' ? (
          <>
            <style>{`
            .fc .fc-button-primary {
              background-color: #3b82f6 !important;
              border-color: #3b82f6 !important;
            }
            .fc .fc-button-primary:hover {
              background-color: #2563eb !important;
              border-color: #2563eb !important;
            }
            .fc .fc-button-primary:not(:disabled):active,
            .fc .fc-button-primary:not(:disabled).fc-button-active {
              background-color: #1d4ed8 !important;
              border-color: #1d4ed8 !important;
            }
            .fc .fc-button-primary:focus {
              box-shadow: 0 0 0 2px rgba(59,130,246,0.4) !important;
            }
            .fc-day-available        { background-color: rgba(34,197,94,0.10)  !important; }
            .fc-day-blocked          { background-color: rgba(239,68,68,0.10)  !important; }
            .fc-day-unavail-allday   { background-color: rgba(239,68,68,0.13)  !important; }
            .fc-daygrid-day-top      { overflow: visible; }
            .fc-daygrid-day-frame    { overflow: hidden !important; }
          `}</style>
            <Card>
              <CardContent className="pt-4 pb-2 px-2 sm:px-6 sm:pb-4">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
                  timeZone={TZ}
                  headerToolbar={
                    isMobile
                      ? {
                          left: 'prev,next',
                          center: 'title',
                          right: 'listWeek,timeGridDay',
                        }
                      : {
                          left: 'prev,next today',
                          center: 'title',
                          right: 'dayGridMonth,timeGridWeek,timeGridDay',
                        }
                  }
                  views={{
                    listWeek: { buttonText: 'Week list' },
                    timeGridDay: { buttonText: 'Day' },
                  }}
                  events={[...calendarEvents, ...availabilityEvents, ...unavailabilityEvents]}
                  eventContent={(arg) => {
                    if (arg.event.extendedProps?.isAvailability) return; // background slot — no custom content
                    if (arg.event.extendedProps?.isUnavailability) {
                      return (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            overflow: 'hidden',
                            padding: '0 3px',
                          }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: '#fff',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.72rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#fff',
                              fontWeight: 500,
                            }}>
                            {arg.event.title}
                          </span>
                        </div>
                      );
                    }
                    const appt = arg.event.extendedProps?.appointment;
                    const summary = confirmationSummary(appt?.confirmations);
                    const dotColor =
                      summary === 'confirmed'
                        ? '#16a34a'
                        : summary === 'failed'
                          ? '#dc2626'
                          : '#ca8a04';
                    const isMonth = arg.view.type === 'dayGridMonth';
                    const timeStr =
                      isMonth && arg.event.start ? formatShortTime(arg.event.start) : null;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          overflow: 'hidden',
                          padding: '0 2px',
                        }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: dotColor,
                            flexShrink: 0,
                          }}
                          title={`Confirmation: ${summary}`}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                          {timeStr && <span style={{ opacity: 0.7 }}>{timeStr} </span>}
                          {arg.event.title}
                        </span>
                      </div>
                    );
                  }}
                  dayCellClassNames={(arg) => {
                    const ymd = toYMD(arg.date);
                    const entry = unavailBarsByDayRef.current[ymd];
                    if (entry?.allDay) return ['fc-day-unavail-allday'];
                    if (arg.view.type !== 'dayGridMonth') return [];
                    const daySlots = slotsByDayRef.current[ymd];
                    if (!daySlots?.length) return [];
                    return [
                      daySlots.every((s) => Number(s.capacity) === 0)
                        ? 'fc-day-blocked'
                        : 'fc-day-available',
                    ];
                  }}
                  dayCellContent={(arg) => {
                    if (arg.view.type !== 'dayGridMonth') return { domNodes: [] };
                    const entry = unavailBarsByDayRef.current[toYMD(arg.date)];
                    const bars = !entry?.allDay && entry?.bars?.length ? entry.bars : null;
                    return (
                      <>
                        {bars?.map((bar, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',

                              left: '-120px',
                              right: 0,

                              // vertical placement
                              top: `${bar.topPct + i * '25'}%`,
                              height: `${bar.heightPct}%`,

                              marginTop: '2px',
                              marginBottom: '2px',

                              minHeight: 6,

                              background: 'rgba(239,68,68,0.55)',
                              borderRadius: '4px',

                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          />
                        ))}
                        <span style={{ position: 'relative', zIndex: 1 }}>{arg.dayNumberText}</span>
                      </>
                    );
                  }}
                  eventClick={handleEventClick}
                  datesSet={handleDatesSet}
                  height="auto"
                  eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
                  dayMaxEvents={isMobile ? 2 : true}
                  moreLinkContent={(args) => (
                    <div style={{ width: '100%', textAlign: 'center' }}>+{args.num} more</div>
                  )}
                  windowResize={(arg) => {
                    const mobile = window.innerWidth < 768;
                    const currentView = arg.view.type;
                    if (
                      mobile &&
                      (currentView === 'dayGridMonth' || currentView === 'timeGridWeek')
                    ) {
                      arg.view.calendar.changeView('listWeek');
                    } else if (!mobile && currentView === 'listWeek') {
                      arg.view.calendar.changeView('dayGridMonth');
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Dialog
              open={!!selectedAppt}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedAppt(null);
                  setModalLoading(false);
                }
              }}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{leadDisplayName(selectedAppt)}</DialogTitle>
                  <DialogDescription>
                    {selectedAppt ? formatFullDateTime(selectedAppt.appointment_at) : ''}
                  </DialogDescription>
                </DialogHeader>
                {modalLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {selectedAppt && !modalLoading && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        className={
                          QUAL_BADGE[selectedAppt.qualification] || 'bg-muted text-muted-foreground'
                        }>
                        <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">
                          Qual
                        </span>
                        {selectedAppt.qualification || 'pending'}
                      </Badge>
                      <Badge className={clientDecisionColor(selectedAppt.client_decision)}>
                        <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">
                          Decision
                        </span>
                        {clientDecisionLabel(selectedAppt.client_decision)}
                      </Badge>
                      {selectedAppt.show_status && (
                        <Badge
                          className={
                            SHOW_STATUS_BADGE[selectedAppt.show_status] ||
                            'bg-muted text-muted-foreground'
                          }>
                          <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">
                            Show
                          </span>
                          {selectedAppt.show_status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {selectedAppt.sale_status && (
                        <Badge
                          className={
                            SALE_STATUS_BADGE[selectedAppt.sale_status] ||
                            'bg-muted text-muted-foreground'
                          }>
                          <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">
                            Sale
                          </span>
                          {selectedAppt.sale_status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <ModalRow label="Address">{selectedAppt.address || '—'}</ModalRow>
                      <ModalRow label="Phone">{selectedAppt.phone || '—'}</ModalRow>
                      {Array.isArray(selectedAppt.renovation_items) &&
                        selectedAppt.renovation_items.length > 0 && (
                          <ModalRow label="Renovations">
                            <span className="flex flex-wrap gap-1">
                              {selectedAppt.renovation_items.map((r) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs">
                                  {r}
                                </span>
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Qualifications
                      </p>
                      <ModalRow label="Homeowner?">
                        <YesNo value={selectedAppt.q_homeowner} />
                      </ModalRow>
                      <ModalRow label="Mortgage current?">
                        <YesNo value={selectedAppt.q_mortgage_current} />
                      </ModalRow>
                      <ModalRow label="Credit score">
                        {selectedAppt.credit_score_band || '—'}
                      </ModalRow>
                      <ModalRow label="Avg. utility bill">
                        {selectedAppt.utility_bill_raw || '—'}
                      </ModalRow>
                      <ModalRow label="Taxes paid (3y)?">
                        <YesNo value={selectedAppt.q_taxes_paid_3y} />
                      </ModalRow>
                      <ModalRow label="Bankruptcy (3y)?">
                        <YesNo value={selectedAppt.q_bankruptcy_3y} />
                      </ModalRow>
                      <ModalRow label="Reverse mortgage?">
                        <YesNo value={selectedAppt.q_reverse_mortgage} />
                      </ModalRow>
                    </div>

                    {Array.isArray(selectedAppt.confirmations) &&
                      selectedAppt.confirmations.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Confirmations
                          </p>
                          <ConfirmationBadges confirmations={selectedAppt.confirmations} />
                        </div>
                      )}

                    {selectedAppt.recording_url &&
                      ['admin', 'operations', 'confirmation', 'qa', 'call_center_admin'].includes(user?.role) && (
                        <ModalRow label="Recording">
                          <a
                            href={selectedAppt.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-4 hover:underline text-sm">
                            Listen
                          </a>
                        </ModalRow>
                      )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setSelectedAppt(null);
                          navigate(`/appointments/${selectedAppt.id}`);
                        }}>
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
          <div className="py-20 text-center text-muted-foreground text-sm">
            "From" date must be ≤ "To" date.
          </div>
        ) : (
          <>
            {visibleDays.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground text-sm">
                No appointments match the current filters.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {pagedDays.map((day) => {
                    const daySlots = slotsByDay[day] || [];
                    const dayAppts = filteredApptsByDay[day] || [];
                    const dayUnavail = (data.unavailability || []).filter(
                      (b) => day >= b.start_at.slice(0, 10) && day <= b.end_at.slice(0, 10),
                    );
                    const hasAllDayUnavail = dayUnavail.some((b) => b.all_day);
                    return (
                      <Card key={day} className={hasAllDayUnavail ? 'bg-red-50 border-red-200' : ''}>
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                            <span className="text-sm font-semibold shrink-0">
                              {formatDayHeader(day)}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {daySlots.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Closed</span>
                              ) : daySlots.every((s) => Number(s.capacity) === 0) ? (
                                <Badge className="bg-red-200 text-red-700">Unavailable</Badge>
                              ) : (
                                daySlots.map((s, i) => (
                                  <Badge
                                    key={i}
                                    className={
                                      s.source === 'specific'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }>
                                    {s.start_time}–{s.end_time} · cap {s.capacity}
                                  </Badge>
                                ))
                              )}
                              {dayUnavail.map((b) =>
                                b.all_day ? null : (
                                  <Badge
                                    key={`u-${b.id}`}
                                    className="bg-red-200 text-red-700 border border-red-200">
                                    {b.title}
                                  </Badge>
                                ),
                              )}
                              {hasAllDayUnavail && (
                                <span className="text-xs font-medium text-red-700">
                                  {dayUnavail.filter((b) => b.all_day).map((b) => b.title).join(', ')}
                                </span>
                              )}
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
                                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer">
                                  <span className="text-sm text-muted-foreground w-16 shrink-0">
                                    {formatTime(a.appointment_at)}
                                  </span>
                                  <span className="text-sm font-medium flex-1 min-w-[120px]">
                                    {leadDisplayName(a)}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    <Badge
                                      className={
                                        QUAL_BADGE[a.qualification] ||
                                        'bg-muted text-muted-foreground'
                                      }>
                                      {a.qualification || 'pending'}
                                    </Badge>
                                    <Badge className={clientDecisionColor(a.client_decision)}>
                                      {clientDecisionLabel(a.client_decision)}
                                    </Badge>
                                    {a.show_status && (
                                      <Badge
                                        className={
                                          SHOW_STATUS_BADGE[a.show_status] ||
                                          'bg-muted text-muted-foreground'
                                        }>
                                        {a.show_status.replace(/_/g, ' ')}
                                      </Badge>
                                    )}
                                    {a.sale_status && (
                                      <Badge
                                        className={
                                          SALE_STATUS_BADGE[a.sale_status] ||
                                          'bg-muted text-muted-foreground'
                                        }>
                                        {a.sale_status.replace(/_/g, ' ')}
                                      </Badge>
                                    )}
                                    <Badge
                                      className={
                                        CONFIRM_BADGE[confirmationSummary(a.confirmations)]
                                      }>
                                      {confirmationSummary(a.confirmations)}
                                    </Badge>
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
                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
