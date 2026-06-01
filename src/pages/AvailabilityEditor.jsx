import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Loader2, ArrowLeft, X, Plus, Ban, Upload } from 'lucide-react';
import { toast } from 'sonner';

// ── constants ──────────────────────────────────────────────────────────────

// UI order: Mon first. day_of_week: 0=Sun, 1=Mon...6=Sat
const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
];


function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtBlocked(ymd) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(fromYMD(ymd));
}

function emptySlot() {
  return { start_time: '09:00', end_time: '17:00', capacity: 1, _key: Math.random() };
}

function emptySpecific() {
  return { specific_date: '', start_time: '09:00', end_time: '17:00', capacity: 1, _key: Math.random() };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stripKeys(arr) {
  return arr.map(({ _key, ...rest }) => rest);
}

function addKeys(arr) {
  return (arr || []).map(item => ({ ...item, _key: Math.random() }));
}

// ── validation ─────────────────────────────────────────────────────────────

function validate(recurring, specific) {
  const errors = [];

  recurring.forEach((slot) => {
    if (!slot.start_time || !slot.end_time) return;
    if (slot.start_time >= slot.end_time) {
      const day = DAYS.find(d => d.dow === slot.day_of_week)?.label || `Day ${slot.day_of_week}`;
      errors.push(`${day}: start time must be before end time (${slot.start_time} – ${slot.end_time}).`);
    }
    if (slot.capacity < 0 || !Number.isInteger(Number(slot.capacity))) {
      const day = DAYS.find(d => d.dow === slot.day_of_week)?.label || `Day ${slot.day_of_week}`;
      errors.push(`${day}: capacity must be a non-negative integer.`);
    }
  });

  specific.forEach((slot, i) => {
    if (!slot.specific_date) {
      errors.push(`Specific date #${i + 1}: date is required.`);
    }
    if (slot.start_time && slot.end_time && slot.start_time >= slot.end_time) {
      errors.push(`Specific date ${slot.specific_date || `#${i + 1}`}: start time must be before end time.`);
    }
    if (slot.capacity < 0 || !Number.isInteger(Number(slot.capacity))) {
      errors.push(`Specific date ${slot.specific_date || `#${i + 1}`}: capacity must be a non-negative integer.`);
    }
  });

  return errors;
}

// ── ICS parser ─────────────────────────────────────────────────────────────

function parseICSDateStr(keyStr, valStr) {
  const v = valStr.trim();
  const isDate = keyStr.includes('VALUE=DATE') || /^\d{8}$/.test(v);
  if (isDate) {
    return { date: new Date(parseInt(v.slice(0, 4), 10), parseInt(v.slice(4, 6), 10) - 1, parseInt(v.slice(6, 8), 10)), isDate: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (m) {
    return { date: new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)), isDate: false };
  }
  return null;
}

function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const dates = new Set();
  let inEvent = false;
  let dtstartRaw = null;
  let dtendRaw = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true; dtstartRaw = null; dtendRaw = null;
    } else if (line === 'END:VEVENT') {
      inEvent = false;
      if (dtstartRaw) {
        const startParsed = parseICSDateStr(dtstartRaw.key, dtstartRaw.val);
        if (startParsed) {
          let endDate = new Date(startParsed.date);
          if (dtendRaw) {
            const endParsed = parseICSDateStr(dtendRaw.key, dtendRaw.val);
            if (endParsed) {
              endDate = new Date(endParsed.date);
              // VALUE=DATE DTEND is exclusive — step back one day
              if (endParsed.isDate) endDate.setDate(endDate.getDate() - 1);
            }
          }
          let cur = new Date(startParsed.date);
          let safety = 0;
          while (cur <= endDate && safety < 366) {
            dates.add(toYMD(cur));
            cur = new Date(cur); cur.setDate(cur.getDate() + 1); safety++;
          }
        }
      }
    } else if (inEvent) {
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const key = line.slice(0, ci); const val = line.slice(ci + 1);
      if (key === 'DTSTART' || key.startsWith('DTSTART;')) dtstartRaw = { key, val };
      else if (key === 'DTEND' || key.startsWith('DTEND;')) dtendRaw = { key, val };
    }
  }
  return [...dates].sort();
}

// ── main component ─────────────────────────────────────────────────────────

export default function AvailabilityEditor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdminOps = ['admin', 'operations'].includes(user?.role);
  const [clientId, setClientId] = useState('1');
  const [clientOptions, setClientOptions] = useState([]);
  useEffect(() => {
    apiClient.listClients()
      .then((data) => setClientOptions(Array.isArray(data) ? data : (data?.clients || [])))
      .catch(() => setClientOptions([]));
  }, []);

  // Server snapshot (for change detection + discard)
  const [serverRecurring, setServerRecurring] = useState([]);
  const [serverSpecific, setServerSpecific] = useState([]);
  const [serverBlocked, setServerBlocked] = useState([]); // YMD strings

  // Editable state
  const [recurring, setRecurring] = useState([]);
  const [specific, setSpecific] = useState([]);
  const [blocked, setBlocked] = useState([]); // YMD strings

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── fetch ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async (cid) => {
    setLoading(true);
    setSaveError('');
    try {
      const res = await apiClient.getAvailability(isAdminOps ? cid : undefined);
      const rec = addKeys(res.recurring || []);
      const allSpec = res.specific || [];
      const blockedYMDs = allSpec.filter(s => Number(s.capacity) === 0).map(s => s.specific_date);
      const openSpec = addKeys(allSpec.filter(s => Number(s.capacity) !== 0));
      setServerRecurring(rec);
      setServerSpecific(openSpec);
      setServerBlocked(blockedYMDs);
      setRecurring(rec);
      setSpecific(openSpec);
      setBlocked(blockedYMDs);
    } finally {
      setLoading(false);
    }
  }, [isAdminOps]);

  useEffect(() => { loadData(clientId); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── change detection ───────────────────────────────────────────────────

  const hasChanges =
    !deepEqual(stripKeys(recurring), stripKeys(serverRecurring)) ||
    !deepEqual(stripKeys(specific), stripKeys(serverSpecific)) ||
    !deepEqual([...blocked].sort(), [...serverBlocked].sort());

  const validationErrors = validate(recurring, specific);
  const canSave = hasChanges && validationErrors.length === 0 && !saving;

  // ── recurring helpers ──────────────────────────────────────────────────

  const addRecurringSlot = (dow) => {
    setRecurring(r => [...r, { ...emptySlot(), day_of_week: dow }]);
  };

  const removeRecurringSlot = (key) => {
    setRecurring(r => r.filter(s => s._key !== key));
  };

  const updateRecurringSlot = (key, field, value) => {
    setRecurring(r => r.map(s => s._key === key ? { ...s, [field]: value } : s));
  };

  // ── specific helpers ───────────────────────────────────────────────────

  const addSpecific = () => setSpecific(s => [...s, emptySpecific()]);

  const removeSpecific = (key) => setSpecific(s => s.filter(x => x._key !== key));

  const updateSpecific = (key, field, value) => {
    setSpecific(s => s.map(x => x._key === key ? { ...x, [field]: value } : x));
  };

  // ── save ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      const blockedAsSpec = blocked.map(ymd => ({
        specific_date: ymd,
        start_time: '00:00',
        end_time: '23:59',
        capacity: 0,
      }));
      const payload = {
        client_id: Number(clientId),
        recurring: stripKeys(recurring).map(s => ({ ...s, capacity: Number(s.capacity) })),
        specific: [
          ...stripKeys(specific).map(s => ({ ...s, capacity: Number(s.capacity) })),
          ...blockedAsSpec,
        ],
      };
      await apiClient.putAvailability(payload);
      await loadData(clientId);
      toast.success('Availability saved');
    } catch (err) {
      setSaveError(err.message || 'Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => loadData(clientId);

  // ── ICS import ─────────────────────────────────────────────────────────
  const icsInputRef = useRef(null);

  const handleICSImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imported = parseICS(ev.target.result);
      setBlocked(prev => {
        const existing = new Set(prev);
        const added = imported.filter(d => !existing.has(d));
        if (added.length === 0) {
          toast.info('No new dates found in the ICS file.');
        } else {
          toast.success(`Blocked ${added.length} new date${added.length > 1 ? 's' : ''} from ICS file.`);
        }
        return [...existing, ...added].sort();
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 pb-28">
      <div className="max-w-[900px] mx-auto space-y-6">

        {/* Top bar */}
        <div>
          <button
            onClick={() => navigate('/calendar')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to calendar
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Edit availability</h1>
            {isAdminOps && (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-56 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{saveError}</div>
        )}

        {/* Validation errors */}
        {validationErrors.length > 0 && hasChanges && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3 space-y-1">
            {validationErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {/* Weekly schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weekly schedule</CardTitle>
            <p className="text-sm text-muted-foreground">
              These slots repeat every week. A specific-date override below takes precedence for that day.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map(({ dow, label }) => {
              const daySlots = recurring.filter(s => s.day_of_week === dow);
              return (
                <div key={dow} className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-3 border-b last:border-0 last:pb-0">
                  <div className="sm:w-24 shrink-0 sm:pt-2 flex items-center sm:block gap-3">
                    <span className="text-sm font-medium text-foreground w-20 sm:w-auto">{label}</span>
                    {daySlots.length === 0 && (
                      <p className="text-xs text-muted-foreground sm:hidden">Closed</p>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    {daySlots.map(slot => (
                      <SlotRow
                        key={slot._key}
                        slot={slot}
                        onChange={(field, value) => updateRecurringSlot(slot._key, field, value)}
                        onRemove={() => removeRecurringSlot(slot._key)}
                      />
                    ))}
                    {daySlots.length === 0 && (
                      <p className="text-xs text-muted-foreground hidden sm:block pt-1.5">Closed</p>
                    )}
                    <button
                      onClick={() => addRecurringSlot(dow)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add slot
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Specific date overrides */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Specific dates</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use these to override the weekly schedule on a particular date (e.g. holiday closure or extra availability).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {specific.length === 0 && (
              <p className="text-sm text-muted-foreground">No specific date overrides.</p>
            )}
            {specific.map(slot => (
              <SpecificRow
                key={slot._key}
                slot={slot}
                onChange={(field, value) => updateSpecific(slot._key, field, value)}
                onRemove={() => removeSpecific(slot._key)}
              />
            ))}
            <button
              onClick={addSpecific}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add date
            </button>
          </CardContent>
        </Card>

        {/* Blocked dates */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" />
                Blocked dates
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => icsInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Import .ics
              </Button>
              <input
                ref={icsInputRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={handleICSImport}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Click a date to block it entirely. Blocked dates override the weekly schedule — no appointments can be booked on these days.
              You can also import an <code className="text-xs bg-muted px-1 py-0.5 rounded">.ics</code> calendar file to block all event dates automatically.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <CalendarPicker
              mode="multiple"
              selected={blocked.map(fromYMD)}
              onSelect={(dates) => setBlocked((dates || []).map(toYMD))}
              numberOfMonths={2}
              className="rounded-md border p-3 w-fit"
              modifiers={{ blocked: blocked.map(fromYMD) }}
              modifiersClassNames={{ blocked: '!bg-red-100 !text-red-700 font-semibold' }}
            />
            {blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dates blocked.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...blocked].sort().map(ymd => (
                  <button
                    key={ymd}
                    onClick={() => setBlocked(b => b.filter(d => d !== ymd))}
                    className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-100 transition-colors"
                  >
                    {fmtBlocked(ymd)}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-4 py-3 z-10">
        <div className="max-w-[900px] mx-auto flex items-center gap-3">
          <Button disabled={!canSave} onClick={handleSave}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
          </Button>
          <Button variant="outline" disabled={!hasChanges || saving} onClick={handleDiscard}>
            Discard changes
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {hasChanges ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── SlotRow ────────────────────────────────────────────────────────────────

function SlotRow({ slot, onChange, onRemove }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">Start</Label>
        <Input
          type="time"
          step={900}
          value={slot.start_time}
          onChange={e => onChange('start_time', e.target.value)}
          className="h-8 w-28 text-sm"
        />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">End</Label>
        <Input
          type="time"
          step={900}
          value={slot.end_time}
          onChange={e => onChange('end_time', e.target.value)}
          className="h-8 w-28 text-sm"
        />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">Cap.</Label>
        <Input
          type="number"
          min={0}
          value={slot.capacity}
          onChange={e => onChange('capacity', e.target.value)}
          className="h-8 w-16 text-sm"
        />
      </div>
      <button
        onClick={onRemove}
        className="h-8 flex items-center text-muted-foreground hover:text-destructive transition-colors px-1"
        aria-label="Remove slot"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── SpecificRow ────────────────────────────────────────────────────────────

function SpecificRow({ slot, onChange, onRemove }) {
  return (
    <div className="rounded-md border p-3 space-y-2 sm:border-0 sm:p-0 sm:space-y-0">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input
            type="date"
            value={slot.specific_date}
            onChange={e => onChange('specific_date', e.target.value)}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">Start</Label>
          <Input
            type="time"
            step={900}
            value={slot.start_time}
            onChange={e => onChange('start_time', e.target.value)}
            className="h-8 w-28 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">End</Label>
          <Input
            type="time"
            step={900}
            value={slot.end_time}
            onChange={e => onChange('end_time', e.target.value)}
            className="h-8 w-28 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">Cap.</Label>
          <Input
            type="number"
            min={0}
            value={slot.capacity}
            onChange={e => onChange('capacity', e.target.value)}
            className="h-8 w-16 text-sm"
          />
        </div>
        <button
          onClick={onRemove}
          className="h-8 flex items-center text-muted-foreground hover:text-destructive transition-colors px-1"
          aria-label="Remove date"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}