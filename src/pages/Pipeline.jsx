import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import CommToggle from '@/components/CommToggle';

const TZ = 'America/New_York';

const COLUMNS = [
  { key: 'new',          label: 'New',          color: '#94a3b8' },
  { key: 'qualified',    label: 'Qualified',     color: '#3b82f6' },
  { key: 'disqualified', label: 'Disqualified',  color: '#ef4444' },
  { key: 'accepted',     label: 'Accepted',      color: '#6366f1' },
  { key: 'rejected',     label: 'Rejected',      color: '#f97316' },
  { key: 'reschedule',   label: 'Reschedule',    color: '#f59e0b' },
  { key: 'showed',       label: 'Showed',        color: '#22c55e' },
  { key: 'sold',         label: 'Sold',          color: '#16a34a' },
  { key: 'not_sold',     label: 'Not Sold',      color: '#84cc16' },
  { key: 'no_show',      label: 'No-show',       color: '#dc2626' },
];

function classify(appt) {
  const { qualification, client_decision, show_status, sale_status, need_reschedule } = appt;
  if (qualification === 'disqualified') return 'disqualified';
  if (client_decision === 'rejected') return 'rejected';
  if (client_decision === 'request_reschedule' || client_decision === 'pending_reapproval' || need_reschedule === true) return 'reschedule';
  if (sale_status === 'sold') return 'sold';
  if (show_status === 'no_show') return 'no_show';
  if (sale_status === 'not_sold') return 'not_sold';
  if (show_status === 'show') return 'showed';
  if (client_decision === 'accepted' || client_decision === 'auto_accepted') return 'accepted';
  if (qualification === 'qualified') return 'qualified';
  return 'new';
}

function apiCallForColumn(id, col) {
  switch (col) {
    case 'qualified':    return apiClient.setQualification(id, { qualification: 'qualified' });
    case 'disqualified': return apiClient.setQualification(id, { qualification: 'disqualified' });
    case 'new':          return apiClient.setQualification(id, { qualification: null });
    case 'accepted':     return apiClient.setClientDecision(id, { decision: 'accepted' });
    case 'rejected':     return apiClient.setClientDecision(id, { decision: 'rejected' });
    case 'reschedule':   return apiClient.setClientDecision(id, { decision: 'request_reschedule' });
    case 'showed':       return apiClient.setOutcome(id, { show_status: 'show', sale_status: null });
    case 'no_show':      return apiClient.setOutcome(id, { show_status: 'no_show', sale_status: null });
    case 'sold':         return apiClient.setOutcome(id, { show_status: 'show', sale_status: 'sold' });
    case 'not_sold':     return apiClient.setOutcome(id, { show_status: 'show', sale_status: 'not_sold' });
    default:             return Promise.resolve();
  }
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

function AppointmentCard({ appt, isDragging, onDragStart, onDragEnd, unread }) {
  const navigate = useNavigate();
  const name = appt.prospect_name || appt.name || 'New appointment';
  const address = [appt.street, appt.city, appt.state].filter(Boolean).join(', ') || appt.address || '—';
  const didDragRef = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        didDragRef.current = true;
        e.dataTransfer.setData('text/plain', String(appt.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(appt.id);
      }}
      onDragEnd={() => {
        onDragEnd();
        // reset flag after click would have fired
        setTimeout(() => { didDragRef.current = false; }, 0);
      }}
      onClick={() => { if (!didDragRef.current) navigate(`/appointments/${appt.id}`); }}
      className={`cursor-grab active:cursor-grabbing rounded-lg border-[1px] border-gray-500 bg-background p-3 hover:shadow-md hover:bg-slate-50 transition-all select-none ${
        isDragging ? 'opacity-40 ring-2 ring-primary/40' : ''
      }`}
    >
      <p className="font-semibold text-sm truncate leading-snug">{name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(appt)}</p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{address}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        <StatusBadge label={appt.qualification} />
        <StatusBadge label={appt.client_decision} />
        {appt.show_status && <StatusBadge label={appt.show_status} />}
        {appt.sale_status && <StatusBadge label={appt.sale_status} />}
      </div>
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <CommToggle lead={appt} unread={unread} />
      </div>
    </div>
  );
}

function Column({ col, cards, draggingId, onDragStart, onDragEnd, onCardDrop, unreadSet }) {
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef(null);
  const storageKey = `pipeline_col_${col.key}_scroll`;
  const restoredRef = useRef(false);

  useLayoutEffect(() => {
    if (restoredRef.current || cards.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) el.scrollTop = parseInt(saved, 10);
    restoredRef.current = true;
  }, [cards, storageKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => sessionStorage.setItem(storageKey, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [storageKey]);

  return (
    <div
      className={`flex-shrink-0 w-[280px] rounded-xl border bg-background flex flex-col transition-colors bg-white ${
        dragOver && draggingId ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/30' : ''
      }`}
      style={{ maxHeight: 'calc(100vh - 200px)' }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (id) {
          onDragEnd();
          onCardDrop(id, col.key);
        }
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 bg-white rounded-t-xl px-3 pt-3 pb-2 border-b"
        style={{ borderTop: `3px solid ${col.color}` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</span>
          <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 tabular-nums">
            {cards.length}
          </span>
        </div>
      </div>

      {/* Scrollable cards */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {cards.length === 0 ? (
          <div className={`flex items-center justify-center h-24 text-sm rounded-lg transition-colors ${
            dragOver && draggingId ? 'text-primary/60 border-2 border-dashed border-primary/30' : 'text-muted-foreground'
          }`}>
            {dragOver && draggingId ? 'Drop here' : '—'}
          </div>
        ) : (
          cards.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              isDragging={draggingId === appt.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              unread={unreadSet?.has(Number(appt.id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

const BOARD_SCROLL_KEY = 'pipeline_board_scroll';

export default function Pipeline() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'operations', 'call_center_admin'].includes(user?.role);
  const boardRef = useRef(null);
  const boardRestoredRef = useRef(false);

  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const clientId = isAdmin ? 1 : undefined;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [overrides, setOverrides]   = useState({});

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.listConversations(),
  });
  const unreadSet = new Set(
    (convData?.conversations || []).filter((c) => c.unread).map((c) => Number(c.appointment_id)),
  );

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const params = { from, to };
    if (isAdmin) params.client_id = clientId;
    try {
      const data = await apiClient.listAppointments(params);
      setAppointments(Array.isArray(data) ? data : (data?.appointments ?? []));
      setOverrides({});
    } catch (err) {
      setError(err.message || 'Failed to load appointments');
    }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [from, to, isAdmin, clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => fetchData(true), 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (loading) return;
    const el = boardRef.current;
    if (!el) return;
    if (!boardRestoredRef.current) {
      const saved = sessionStorage.getItem(BOARD_SCROLL_KEY);
      if (saved) el.scrollLeft = parseInt(saved, 10);
      boardRestoredRef.current = true;
    }
    const onScroll = () => sessionStorage.setItem(BOARD_SCROLL_KEY, el.scrollLeft);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]);

  // Refs so moveCard is stable and never has stale closure issues
  const appointmentsRef = useRef(appointments);
  appointmentsRef.current = appointments;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const moveCard = useCallback(async (apptId, targetKey) => {
    const appt = appointmentsRef.current.find(
      a => String(a.id) === String(apptId)
    );
    if (!appt) return;
    const fromKey = overridesRef.current[apptId] ?? classify(appt);
    if (fromKey === targetKey) return;

    setOverrides(prev => ({ ...prev, [apptId]: targetKey }));
    try {
      await apiCallForColumn(apptId, targetKey);
      toast.success(`Moved to ${COLUMNS.find(c => c.key === targetKey)?.label ?? targetKey}`);
    } catch (err) {
      setOverrides(prev => { const n = { ...prev }; delete n[apptId]; return n; });
      toast.error(err?.message || 'Failed to update appointment');
    }
  }, []); // stable — reads from refs

  const buckets = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
  appointments.forEach(appt => {
    buckets[overrides[appt.id] ?? classify(appt)].push(appt);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="px-4 py-4">
        <div className="mb-4 space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-md border border-gray-200 shadow-sm p-2">
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground shrink-0">From</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground shrink-0">To</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              setFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
              setTo(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
            }}>
              Reset
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => fetchData()}>Retry</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <p className="text-lg font-semibold text-foreground">No appointments in this range</p>
            <p className="text-sm text-muted-foreground">Adjust the date filters above, or pick a different client.</p>
            <Button variant="outline" size="sm" onClick={() => {
              setFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
              setTo(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
            }}>
              Reset range
            </Button>
          </div>
        ) : (
          <div ref={boardRef} className="overflow-x-auto pb-4">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {COLUMNS.map(col => (
                <Column
                  key={col.key}
                  col={col}
                  cards={buckets[col.key]}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onDragEnd={() => setDraggingId(null)}
                  onCardDrop={moveCard}
                  unreadSet={unreadSet}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
