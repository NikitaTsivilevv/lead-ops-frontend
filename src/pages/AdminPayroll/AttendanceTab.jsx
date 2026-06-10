import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MonthPicker({ value, onChange }) {
  const [yr, mo] = value.split('-').map(Number);
  const [pickerYear, setPickerYear] = useState(yr);

  const select = (month) => {
    onChange(`${pickerYear}-${String(month).padStart(2, '0')}`);
  };

  return (
    <div className="p-3 w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setPickerYear((y) => y - 1)}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{pickerYear}</span>
        <button onClick={() => setPickerYear((y) => y + 1)}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTH_NAMES.map((name, i) => {
          const active = pickerYear === yr && i + 1 === mo;
          return (
            <button key={name} onClick={() => select(i + 1)}
              className={`rounded-md py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-accent text-foreground'
              }`}>
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildCalendarCells(year, month) {
  const cells = [];
  const cur = new Date(Date.UTC(year, month - 1, 1));
  let offsetAdded = false;
  while (cur.getUTCMonth() === month - 1) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      if (!offsetAdded) {
        for (let i = 0; i < dow - 1; i++) cells.push(null);
        offsetAdded = true;
      }
      cells.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return cells;
}

const statusStyle = {
  worked:        'bg-green-50 border-green-300 text-green-800',
  off:           'bg-yellow-50 border-yellow-300 text-yellow-700',
  not_connected: 'bg-red-50 border-red-300 text-red-700',
};
const statusLabel = { worked: 'Worked', off: 'Off', not_connected: 'No conn.' };

export default function AttendanceTab({ callers }) {
  const qc = useQueryClient();
  const now = new Date();
  const [callerId, setCallerId] = useState('');
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [pickingDay, setPickingDay] = useState(null);

  const [yr, mo] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(yr, mo, 0)).toISOString().slice(0, 10);

  const attendanceQ = useQuery({
    queryKey: ['attendance', callerId, yearMonth],
    enabled: !!callerId,
    queryFn: () => apiClient.listCallerAttendance({ caller_id: callerId, from: `${yearMonth}-01`, to: lastDay }),
  });

  const recordMut = useMutation({
    mutationFn: (body) => apiClient.recordAttendance(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', callerId, yearMonth] });
      setPickingDay(null);
      toast.success('Saved');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: ({ caller_id, work_date }) => apiClient.deleteAttendance({ caller_id, work_date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', callerId, yearMonth] });
      setPickingDay(null);
      toast.success('Removed');
    },
    onError: (err) => toast.error(err?.payload?.error || err.message || 'Failed'),
  });

  const byDate = Object.fromEntries(
    (attendanceQ.data?.attendance || []).map((r) => [r.work_date.slice(0, 10), r.status])
  );
  const cells = callerId ? buildCalendarCells(yr, mo) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1 flex flex-col gap-1">
          <Label>Caller</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm min-w-[180px]"
            value={callerId} onChange={(e) => setCallerId(e.target.value)}>
            <option value="">Select caller…</option>
            {callers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}{c.caller_no ? ` (#${c.caller_no})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 flex flex-col">
          <Label>Month</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-between font-normal">
                {new Date(yearMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <MonthPicker value={yearMonth} onChange={setYearMonth} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!callerId && <p className="text-sm text-muted-foreground">Select a caller to view attendance.</p>}
      {callerId && attendanceQ.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {callerId && !attendanceQ.isLoading && (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
            <div key={d} className="text-[10px] sm:text-xs font-medium text-center text-muted-foreground pb-0.5">{d}</div>
          ))}
          {cells.map((cell, i) =>
            cell === null ? (
              <div key={`blank-${i}`} />
            ) : (
              <button
                key={cell}
                onClick={() => setPickingDay({ date: cell, status: byDate[cell] || '' })}
                className={`rounded border p-1 sm:p-2 text-center transition-colors hover:opacity-80 ${
                  statusStyle[byDate[cell]] || 'bg-background border-border text-muted-foreground'
                }`}
              >
                <div className="text-[11px] sm:text-xs font-semibold">{Number(cell.slice(8))}</div>
                {byDate[cell] && (
                  <div className="text-[8px] sm:text-[10px] mt-0.5 truncate leading-tight">
                    {statusLabel[byDate[cell]]}
                  </div>
                )}
              </button>
            )
          )}
        </div>
      )}

      {pickingDay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setPickingDay(null)}>
          <div className="bg-background rounded-lg shadow-xl p-5 space-y-3 w-72"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-sm">
              {new Date(pickingDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </p>
            <div className="space-y-2">
              {[
                ['worked',        'Worked',         'bg-green-100 text-green-800'],
                ['off',           'Off (credited)', 'bg-yellow-100 text-yellow-800'],
                ['not_connected', 'Not Connected',  'bg-red-100 text-red-800'],
              ].map(([val, label, cls]) => (
                <button key={val}
                  disabled={recordMut.isPending}
                  onClick={() => recordMut.mutate({ caller_id: Number(callerId), work_date: pickingDay.date, status: val })}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium text-left ${cls} hover:opacity-80 transition-opacity disabled:opacity-50`}>
                  {label}
                </button>
              ))}
            </div>
            {pickingDay.status && (
              <button
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate({ caller_id: Number(callerId), work_date: pickingDay.date })}
                className="w-full rounded-md px-4 py-2 text-sm font-medium text-left bg-gray-100 text-gray-700 hover:bg-gray-200 transition-opacity disabled:opacity-50">
                {deleteMut.isPending ? 'Removing…' : 'Remove entry'}
              </button>
            )}
            <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={() => setPickingDay(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
