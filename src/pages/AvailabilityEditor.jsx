import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Loader2, ArrowLeft, X, Plus, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { parseICSEvents } from '@/lib/parseICS';
import { DAYS, toYMD, fromYMD, fmtBlocked, emptySlot, emptySpecific, deepEqual, stripKeys, addKeys, validate } from '@/components/AvailabilityEditor/utils';
import SlotRow from '@/components/AvailabilityEditor/SlotRow';
import SpecificRow from '@/components/AvailabilityEditor/SpecificRow';
import UnavailabilityTab from '@/components/AvailabilityEditor/UnavailabilityTab';

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

  const [activeTab, setActiveTab] = useState('unavailability');

  // ── schedule tab state ─────────────────────────────────────────────────────
  const [serverRecurring, setServerRecurring] = useState([]);
  const [serverSpecific, setServerSpecific] = useState([]);
  const [serverBlocked, setServerBlocked] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [specific, setSpecific] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  // ── unavailability tab state ───────────────────────────────────────────────
  const [unavailBlocks, setUnavailBlocks] = useState([]);
  const [unavailLoading, setUnavailLoading] = useState(false);
  const icsBlockRef = useRef(null);

  const loadUnavailability = useCallback(async (cid) => {
    setUnavailLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setMonth(to.getMonth() + 3);
      const res = await apiClient.listUnavailability({
        client_id: isAdminOps ? cid : undefined,
        from: from.toISOString().slice(0, 10),
        to:   to.toISOString().slice(0, 10),
      });
      setUnavailBlocks(res.unavailability || []);
    } catch {
      setUnavailBlocks([]);
    } finally {
      setUnavailLoading(false);
    }
  }, [isAdminOps]);

  useEffect(() => {
    loadData(clientId);
    loadUnavailability(clientId);
  }, [clientId]); // eslint-disable-line

  // ── unavailability helpers ─────────────────────────────────────────────────
  const handleBlockCreated = (b) =>
    setUnavailBlocks(prev => [...prev, b].sort((a, z) => a.start_at.localeCompare(z.start_at)));
  const handleBlockUpdated = (id, updates) =>
    setUnavailBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  const handleBlockDeleted = (id) =>
    setUnavailBlocks(prev => prev.filter(b => b.id !== id));

  // ── quick-block presets ────────────────────────────────────────────────────
  const quickBlock = async (preset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const ranges = {
      today:          [new Date(d), new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)],
      tomorrow:       [new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
                       new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 23, 59, 59)],
      today_tomorrow: [new Date(d),
                       new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 23, 59, 59)],
    };
    const [start, end] = ranges[preset];
    try {
      const res = await apiClient.createUnavailability({
        client_id: Number(clientId),
        title:     'Full',
        start_at:  start.toISOString(),
        end_at:    end.toISOString(),
        all_day:   true,
        source:    'manual',
      });
      handleBlockCreated(res.unavailability ?? res);
      toast.success('Block added.');
    } catch (err) {
      toast.error(err.message || 'Failed to add block.');
    }
  };

  // ── ICS import ─────────────────────────────────────────────────────────────
  const handleICSBlockImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const events = parseICSEvents(ev.target.result);
      if (events.length === 0) { toast.info('No events found in file.'); return; }
      // Route every ICS event through the MAIN unavailability endpoint — the same
      // POST /api/unavailability that manual and quick-blocks use — so there is a
      // single source of unavailability rather than a separate import-ics store.
      const results = await Promise.allSettled(
        events.map(evt => apiClient.createUnavailability({
          client_id: Number(clientId),
          title:     evt.title,
          start_at:  evt.start_at,
          end_at:    evt.end_at,
          all_day:   evt.all_day,
          uid:       evt.uid,   // lets the backend dedupe re-imports by UID
          source:    'ics',
        }))
      );
      const created = results.filter(r => r.status === 'fulfilled').length;
      const failed  = results.length - created;
      if (created) toast.success(`Imported ${created} block${created === 1 ? '' : 's'}.`);
      if (failed)  toast.error(`${failed} block${failed === 1 ? '' : 's'} failed to import.`);
      await loadUnavailability(clientId);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── schedule tab helpers ───────────────────────────────────────────────────
  const hasChanges =
    !deepEqual(stripKeys(recurring), stripKeys(serverRecurring)) ||
    !deepEqual(stripKeys(specific), stripKeys(serverSpecific)) ||
    !deepEqual([...blocked].sort(), [...serverBlocked].sort());

  const validationErrors = validate(recurring, specific);
  const canSave = hasChanges && validationErrors.length === 0 && !saving;

  const addRecurringSlot    = (dow) => setRecurring(r => [...r, { ...emptySlot(), day_of_week: dow }]);
  const removeRecurringSlot = (key) => setRecurring(r => r.filter(s => s._key !== key));
  const updateRecurringSlot = (key, field, value) =>
    setRecurring(r => r.map(s => s._key === key ? { ...s, [field]: value } : s));

  const addSpecific    = () => setSpecific(s => [...s, emptySpecific()]);
  const removeSpecific = (key) => setSpecific(s => s.filter(x => x._key !== key));
  const updateSpecific = (key, field, value) =>
    setSpecific(s => s.map(x => x._key === key ? { ...x, [field]: value } : x));

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      const blockedAsSpec = blocked.map(ymd => ({
        specific_date: ymd, start_time: '00:00', end_time: '23:59', capacity: 0,
      }));
      await apiClient.putAvailability({
        client_id: Number(clientId),
        recurring: stripKeys(recurring).map(s => ({ ...s, capacity: Number(s.capacity) })),
        specific: [
          ...stripKeys(specific).map(s => ({ ...s, capacity: Number(s.capacity) })),
          ...blockedAsSpec,
        ],
      });
      await loadData(clientId);
      toast.success('Availability saved');
    } catch (err) {
      setSaveError(err.message || 'Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => loadData(clientId);

  if (loading && activeTab === 'schedule') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background py-8 px-4 ${activeTab === 'schedule' ? 'pb-28' : 'pb-10'}`}>
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
                <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clientOptions.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tab strip */}
          <div className="flex gap-1 mt-4 border-b border-border">
            {[
              { id: 'unavailability', label: 'Unavailability' },
              { id: 'schedule',       label: 'Schedule' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Unavailability tab ─────────────────────────────────────────────── */}
        {activeTab === 'unavailability' && (
          <UnavailabilityTab
            clientId={clientId}
            blocks={unavailBlocks}
            loading={unavailLoading}
            onBlockCreated={handleBlockCreated}
            onBlockUpdated={handleBlockUpdated}
            onBlockDeleted={handleBlockDeleted}
            onQuickBlock={quickBlock}
            icsRef={icsBlockRef}
            onICSImport={handleICSBlockImport}
          />
        )}

        {/* ── Schedule tab ───────────────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <>
            {saveError && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{saveError}</div>
            )}
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-500" />
                  Blocked dates
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Click a date to block it entirely. Blocked dates override the weekly schedule — no appointments can be booked on these days.
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
                      <button key={ymd} onClick={() => setBlocked(b => b.filter(d => d !== ymd))}
                        className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-100 transition-colors">
                        {fmtBlocked(ymd)}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
          </>
        )}

      </div>
    </div>
  );
}
