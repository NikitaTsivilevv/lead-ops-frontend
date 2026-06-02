import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Ban, Upload } from 'lucide-react';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import UnavailBlockRow from './UnavailBlockRow';
import BlockEditDialog from './BlockEditDialog';

export default function UnavailabilityTab({
  clientId, blocks, loading,
  onBlockCreated, onBlockUpdated, onBlockDeleted,
  onQuickBlock, icsRef, onICSImport,
}) {
  const [pendingSelect, setPendingSelect] = useState(null);
  const [pendingTitle, setPendingTitle]   = useState('Unavailable');
  const [pendingAllDay, setPendingAllDay] = useState(false);
  const [pendingFromTime, setPendingFromTime] = useState('09:00');
  const [pendingToTime, setPendingToTime]     = useState('17:00');
  const [savingNew, setSavingNew]         = useState(false);
  const [editingBlock, setEditingBlock]   = useState(null);

  const fcEvents = blocks.map(b => ({
    id:              String(b.id),
    title:           b.title,
    start:           b.start_at,
    end:             b.end_at,
    allDay:          b.all_day,
    backgroundColor: '#ef4444',
    borderColor:     '#dc2626',
    textColor:       '#fff',
    extendedProps:   { block: b },
  }));

  const handleSelect = ({ start, end, allDay }) => {
    setPendingSelect({ start, end, allDay });
    setPendingTitle('Unavailable');
    setPendingAllDay(allDay);
    const pad = n => String(n).padStart(2, '0');
    setPendingFromTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setPendingToTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
  };

  const handleConfirmCreate = async () => {
    if (!pendingSelect) return;
    setSavingNew(true);
    try {
      let startAt, endAt;
      if (pendingAllDay) {
        const s = pendingSelect.start;
        startAt = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0).toISOString();
        endAt   = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59).toISOString();
      } else {
        const [fh, fm] = pendingFromTime.split(':').map(Number);
        const [th, tm] = pendingToTime.split(':').map(Number);
        const s = pendingSelect.start;
        startAt = new Date(s.getFullYear(), s.getMonth(), s.getDate(), fh, fm).toISOString();
        endAt   = new Date(s.getFullYear(), s.getMonth(), s.getDate(), th, tm).toISOString();
      }
      const res = await apiClient.createUnavailability({
        client_id: Number(clientId),
        title:    pendingTitle || 'Unavailable',
        start_at: startAt,
        end_at:   endAt,
        all_day:  pendingAllDay,
        source:   'manual',
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
    const updates = {
      start_at: event.start.toISOString(),
      end_at:   (event.end ?? event.start).toISOString(),
      all_day:  event.allDay,
    };
    try {
      await apiClient.updateUnavailability(Number(event.id), updates);
      onBlockUpdated(Number(event.id), updates);
    } catch (err) {
      revert();
      toast.error(err.message || 'Failed to move block.');
    }
  };

  const handleEventResize = async ({ event, revert }) => {
    const updates = { start_at: event.start.toISOString(), end_at: event.end.toISOString() };
    try {
      await apiClient.updateUnavailability(Number(event.id), updates);
      onBlockUpdated(Number(event.id), updates);
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
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('today')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />Today
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('tomorrow')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />Tomorrow
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => onQuickBlock('today_tomorrow')}>
              <Ban className="w-3.5 h-3.5 text-red-500" />Today + Tomorrow
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                onClick={() => icsRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />Import .ics
              </Button>
              <input ref={icsRef} type="file" accept=".ics,text/calendar"
                className="hidden" onChange={onICSImport} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mark unavailability</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag on empty space to block a time range. Click a block to edit or delete it.
            Drag a block to move it. Drag its bottom edge to resize.
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
          `}</style>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="unavail-fc">
              <FullCalendar
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                timeZone="local"
                headerToolbar={{
                  left:   'prev,next today',
                  center: 'title',
                  right:  'timeGridWeek,timeGridDay',
                }}
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
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
                dayMaxEvents={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block list */}
      {blocks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              All blocks ({blocks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-4">
            {[...blocks]
              .sort((a, b) => a.start_at.localeCompare(b.start_at))
              .map(b => (
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
            }
          </CardContent>
        </Card>
      )}

      {/* New block dialog */}
      <Dialog open={!!pendingSelect} onOpenChange={(open) => { if (!open) setPendingSelect(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block this time?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label (optional)</Label>
              <Input
                value={pendingTitle}
                onChange={e => setPendingTitle(e.target.value)}
                placeholder="e.g. Full, Trade show, Vacation"
                className="h-9"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleConfirmCreate()}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pendingAllDay}
                onChange={e => setPendingAllDay(e.target.checked)}
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
                    onChange={e => setPendingFromTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="time"
                    value={pendingToTime}
                    onChange={e => setPendingToTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleConfirmCreate} disabled={savingNew} className="flex-1">
                {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block time'}
              </Button>
              <Button variant="outline" onClick={() => setPendingSelect(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/delete dialog */}
      {editingBlock && (
        <BlockEditDialog
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSaved={(updates) => { onBlockUpdated(editingBlock.id, updates); setEditingBlock(null); }}
          onDeleted={() => { onBlockDeleted(editingBlock.id); setEditingBlock(null); }}
        />
      )}
    </div>
  );
}
