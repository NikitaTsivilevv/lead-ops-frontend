import { useState, useRef } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Ban, Upload, Link } from 'lucide-react';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import UnavailBlockRow from './UnavailBlockRow';
import BlockEditDialog from './BlockEditDialog';

function fcDateToISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
}

export default function UnavailabilityTab({
  clientId,
  blocks,
  loading,
  onBlockCreated,
  onBlockUpdated,
  onBlockDeleted,
  onQuickBlock,
  icsRef,
  onICSImport,
  icsImporting,
  onUrlImport,
  urlImporting,
  blocked,
  onBlockedChange,
}) {
  const unavailCalendarRef = useRef(null);
  const [pendingSelect, setPendingSelect] = useState(null);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [pendingTitle, setPendingTitle] = useState('Unavailable');
  const [pendingAllDay, setPendingAllDay] = useState(false);
  const [pendingFromTime, setPendingFromTime] = useState('09:00');
  const [pendingToTime, setPendingToTime] = useState('17:00');
  const [savingNew, setSavingNew] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [viewRange, setViewRange] = useState(null);

  const handleDatesSet = ({ start, end, view }) => {
    setViewRange({ start, end, type: view.type });
  };

  const visibleBlocks = viewRange
    ? [...blocks]
        .filter(
          (b) =>
            b.start_at < viewRange.end.toISOString() && b.end_at > viewRange.start.toISOString(),
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
    : [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at));

  const viewLabel =
    viewRange?.type === 'dayGridMonth'
      ? 'this month'
      : viewRange?.type === 'timeGridDay'
        ? 'today'
        : 'this week';

  const fcEvents = blocks.map((b) => ({
    id: String(b.id),
    title: b.title,
    start: b.start_at,
    end: b.end_at,
    allDay: !!b.all_day,
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
    textColor: '#fff',
    extendedProps: { block: b },
  }));

  const handleSelect = ({ start, end, allDay }) => {
    setPendingSelect({ start, end, allDay });
    setPendingTitle('Unavailable');
    setPendingAllDay(allDay);
    const pad = (n) => String(n).padStart(2, '0');
    setPendingFromTime(`${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`);
    setPendingToTime(`${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`);
  };

  const handleConfirmCreate = async () => {
    if (!pendingSelect) return;
    setSavingNew(true);
    try {
      let startAt, endAt;
      const s = pendingSelect.start;
      const pad = (n) => String(n).padStart(2, '0');
      const date = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
      if (pendingAllDay) {
        startAt = `${date}T00:00:00Z`;
        endAt = `${date}T23:59:59Z`;
      } else {
        startAt = `${date}T${pendingFromTime}:00Z`;
        endAt = `${date}T${pendingToTime}:00Z`;
      }
      const res = await apiClient.createUnavailability({
        client_id: Number(clientId),
        title: pendingTitle || 'Unavailable',
        start_at: startAt,
        end_at: endAt,
        all_day: pendingAllDay,
        source: 'manual',
      });
      onBlockCreated(res.unavailability ?? res);
      toast.success('Block added.');
    } catch (err) {
      toast.error(err.message || 'Failed to add block.');
    } finally {
      setSavingNew(false);
      setPendingSelect(null);
    }
  };

  const handleEventDrop = async ({ event, revert }) => {
    const blockId = event.extendedProps?.block?.id ?? Number(event.id);
    let startAt, endAt;
    if (event.allDay) {
      const pad = (n) => String(n).padStart(2, '0');
      const s = event.start;
      const d = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
      startAt = `${d}T00:00:00Z`;
      endAt = `${d}T23:59:59Z`;
    } else {
      startAt = fcDateToISO(event.start);
      endAt = fcDateToISO(event.end ?? event.start);
    }
    const updates = { start_at: startAt, end_at: endAt, all_day: event.allDay };
    try {
      await apiClient.updateUnavailability(blockId, updates);
      onBlockUpdated(blockId, updates);
    } catch (err) {
      revert();
      toast.error(err.message || 'Failed to move block.');
    }
  };

  const handleEventResize = async ({ event, revert }) => {
    const blockId = event.extendedProps?.block?.id ?? Number(event.id);
    const updates = {
      start_at: fcDateToISO(event.start),
      end_at: fcDateToISO(event.end),
      all_day: event.allDay,
    };
    try {
      await apiClient.updateUnavailability(blockId, updates);
      onBlockUpdated(blockId, updates);
    } catch (err) {
      revert();
      toast.error(err.message || 'Failed to resize block.');
    }
  };

  const handleEventClick = ({ event }) => {
    setEditingBlock({ ...event.extendedProps.block });
  };

  return (
    <div className="space-y-4">
      {/* Quick-block row */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground shrink-0">Quick block:</p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('today')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('tomorrow')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />
              Tomorrow
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('today_tomorrow')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />
              Today + Tomorrow
            </Button>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setUrlDialogOpen(true)}
                disabled={urlImporting || icsImporting}>
                {urlImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link className="w-3.5 h-3.5" />
                )}
                {urlImporting ? 'Importing…' : 'Import from URL'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => icsRef.current?.click()}
                disabled={icsImporting || urlImporting}>
                {icsImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {icsImporting ? 'Importing…' : 'Import .ics'}
              </Button>
              <input
                ref={icsRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={onICSImport}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mark unavailability</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag on empty space to block a time range. Click a block to edit or delete it. Drag a
            block to move it. Drag its bottom edge to resize.
          </p>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <style>{`
            .unavail-fc .fc-button-primary {
              background-color: #ef4444 !important; border-color: #ef4444 !important;
            }
            .unavail-fc .fc-button-primary:hover {
              background-color: #dc2626 !important; border-color: #dc2626 !important;
            }
            .unavail-fc .fc-button-primary:not(:disabled).fc-button-active {
              background-color: #b91c1c !important; border-color: #b91c1c !important;
            }
            .unavail-fc .fc-button-primary:focus {
              box-shadow: 0 0 0 2px rgba(239,68,68,0.4) !important;
            }
            .unavail-fc .fc-highlight { background: rgba(239,68,68,0.15) !important; }
            .unavail-fc .fc-daygrid-body .fc-daygrid-day-frame { position: relative; }
            .unavail-fc .fc-daygrid-body .fc-daygrid-day-frame::before {
              content: 'Block all day';
              position: absolute;
              top: 20%; left: 50%;
              transform: translate(-50%, -50%);
              font-size: 0.62rem;
              color: #9ca3af;
              pointer-events: none;
              white-space: nowrap;
            }
          `}</style>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="unavail-fc">
              <FullCalendar
                ref={unavailCalendarRef}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                timeZone="UTC"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                datesSet={handleDatesSet}
                selectable={true}
                selectMirror={true}
                editable={true}
                unselectAuto={true}
                events={fcEvents}
                select={handleSelect}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventClick={handleEventClick}
                height={620}
                viewDidMount={({ view }) => {
                  if (view.type === 'timeGridWeek' || view.type === 'timeGridDay') {
                    setTimeout(() => {
                      unavailCalendarRef.current?.getApi().scrollToTime('07:00:00');
                    }, 0);
                  }
                }}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
                eventContent={(arg) => (
                  <div
                    style={{
                      fontSize: '0.72rem',
                      padding: '1px 3px',
                      color: '#fff',
                      overflow: 'hidden',
                      height: '100%',
                      minHeight: '1.1em',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1px',
                    }}>
                    {arg.timeText && (
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                        {arg.timeText}
                      </span>
                    )}
                    {arg.event.title && (
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500,
                        }}>
                        {arg.event.title}
                      </span>
                    )}
                  </div>
                )}
                dayMaxEvents={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Blocks {viewLabel} ({visibleBlocks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pb-4">
          {visibleBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks {viewLabel}.</p>
          ) : (
            visibleBlocks.map((b) => (
              <UnavailBlockRow
                key={b.id}
                block={b}
                onEdit={() => setEditingBlock({ ...b })}
                onDelete={async () => {
                  try {
                    await apiClient.deleteUnavailability(b.id);
                    onBlockDeleted(b.id);
                    toast.success('Block removed.');
                  } catch (err) {
                    toast.error(err.message || 'Failed to delete.');
                  }
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* New block dialog */}
      <Dialog
        open={!!pendingSelect}
        onOpenChange={(open) => {
          if (!open) setPendingSelect(null);
        }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block this time?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label (optional)</Label>
              <Input
                value={pendingTitle}
                onChange={(e) => setPendingTitle(e.target.value)}
                placeholder="e.g. Full, Trade show, Vacation"
                className="h-9"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreate()}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pendingAllDay}
                onChange={(e) => setPendingAllDay(e.target.checked)}
                className="rounded"
              />
              Block entire day
            </label>
            {!pendingAllDay && (
              <div className="flex gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="time"
                    value={pendingFromTime}
                    onChange={(e) => setPendingFromTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="time"
                    value={pendingToTime}
                    onChange={(e) => setPendingToTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPendingSelect(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmCreate} disabled={savingNew} className="flex-1">
                {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block time'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL import dialog */}
      <Dialog
        open={urlDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUrlDialogOpen(false);
            setCalendarUrl('');
          }
        }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import calendar from URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Use an iCal export URL, not a share/create link.
              </p>
              <p>
                Google Calendar: open calendar settings → <em>Integrate calendar</em> → copy the{' '}
                <strong>Secret address in iCal format</strong>.
              </p>
              <p>
                Outlook: go to <em>Publish calendar</em> and copy the ICS link.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Calendar URL (.ics / webcal)</Label>
              <Input
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                className="h-9 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && calendarUrl.trim()) {
                    onUrlImport(calendarUrl.trim());
                    setUrlDialogOpen(false);
                    setCalendarUrl('');
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUrlDialogOpen(false);
                  setCalendarUrl('');
                }}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!calendarUrl.trim() || urlImporting}
                onClick={() => {
                  onUrlImport(calendarUrl.trim());
                  setUrlDialogOpen(false);
                  setCalendarUrl('');
                }}>
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/delete dialog */}
      {editingBlock && (
        <BlockEditDialog
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSaved={(updates) => {
            onBlockUpdated(editingBlock.id, updates);
            setEditingBlock(null);
          }}
          onDeleted={() => {
            onBlockDeleted(editingBlock.id);
            setEditingBlock(null);
          }}
        />
      )}
    </div>
  );
}
