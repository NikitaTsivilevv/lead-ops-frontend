import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, X, Plus } from 'lucide-react';
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

// TODO: replace with GET /api/clients when exposed
const CLIENT_OPTIONS = [{ id: 1, name: 'Guy Green Constructions' }];

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

// ── main component ─────────────────────────────────────────────────────────

export default function AvailabilityEditor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdminOps = ['admin', 'operations'].includes(user?.role);
  const [clientId, setClientId] = useState('1');

  // Server snapshot (for change detection + discard)
  const [serverRecurring, setServerRecurring] = useState([]);
  const [serverSpecific, setServerSpecific] = useState([]);

  // Editable state
  const [recurring, setRecurring] = useState([]);
  const [specific, setSpecific] = useState([]);

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
      const spec = addKeys(res.specific || []);
      setServerRecurring(rec);
      setServerSpecific(spec);
      setRecurring(rec);
      setSpecific(spec);
    } finally {
      setLoading(false);
    }
  }, [isAdminOps]);

  useEffect(() => { loadData(clientId); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── change detection ───────────────────────────────────────────────────

  const hasChanges =
    !deepEqual(stripKeys(recurring), stripKeys(serverRecurring)) ||
    !deepEqual(stripKeys(specific), stripKeys(serverSpecific));

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
      const payload = {
        client_id: Number(clientId),
        recurring: stripKeys(recurring).map(s => ({ ...s, capacity: Number(s.capacity) })),
        specific: stripKeys(specific).map(s => ({ ...s, capacity: Number(s.capacity) })),
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
                  {CLIENT_OPTIONS.map(c => (
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
                <div key={dow} className="flex gap-4">
                  <div className="w-24 shrink-0 pt-2">
                    <span className="text-sm font-medium text-foreground">{label.slice(0, 3)}</span>
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
                      <p className="text-xs text-muted-foreground pt-1.5">Closed</p>
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
    <div className="flex flex-wrap items-center gap-2">
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
        <Label className="text-xs text-muted-foreground">Capacity</Label>
        <Input
          type="number"
          min={0}
          value={slot.capacity}
          onChange={e => onChange('capacity', e.target.value)}
          className="h-8 w-20 text-sm"
        />
      </div>
      <button
        onClick={onRemove}
        className="mt-5 text-muted-foreground hover:text-destructive transition-colors"
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
    <div className="flex flex-wrap items-center gap-2">
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
        <Label className="text-xs text-muted-foreground">Capacity</Label>
        <Input
          type="number"
          min={0}
          value={slot.capacity}
          onChange={e => onChange('capacity', e.target.value)}
          className="h-8 w-20 text-sm"
        />
      </div>
      <button
        onClick={onRemove}
        className="mt-5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Remove date"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}