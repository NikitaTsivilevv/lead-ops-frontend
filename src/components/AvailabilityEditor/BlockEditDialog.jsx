import { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BlockEditDialog({ block, onClose, onSaved, onDeleted }) {
  const [title,     setTitle]     = useState(block.title);
  const [startDate, setStartDate] = useState(block.start_at.slice(0, 10));
  const [startTime, setStartTime] = useState(block.start_at.slice(11, 16));
  const [endDate,   setEndDate]   = useState(block.end_at.slice(0, 10));
  const [endTime,   setEndTime]   = useState(block.end_at.slice(11, 16));
  const [allDay,    setAllDay]    = useState(block.all_day);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buildIso = (date, time, isAllDay, isEnd) =>
    isAllDay ? `${date}T${isEnd ? '23:59:59' : '00:00:00'}Z` : `${date}T${time}:00Z`;

  const handleSave = async () => {
    const startIso = buildIso(startDate, startTime, allDay, false);
    const endIso   = buildIso(endDate,   endTime,   allDay, true);
    if (new Date(startIso) >= new Date(endIso)) { setErr('Start must be before end.'); return; }
    setSaving(true); setErr('');
    try {
      await apiClient.updateUnavailability(block.id, {
        title, start_at: startIso, end_at: endIso, all_day: allDay,
      });
      onSaved({ title, start_at: startIso, end_at: endIso, all_day: allDay });
      toast.success('Block updated.');
    } catch (e) {
      setErr(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.deleteUnavailability(block.id);
      onDeleted();
      toast.success('Block removed.');
    } catch (e) {
      toast.error(e.message || 'Failed to delete.');
    }
  };

  return (
    <>
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit block</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            All day
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Start date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-36 text-sm" />
            </div>
            {!allDay && (
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-8 w-28 text-sm" />
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">End date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-36 text-sm" />
            </div>
            {!allDay && (
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-8 w-28 text-sm" />
              </div>
            )}
          </div>
          <div className="flex justify-between pt-1">
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Remove block?</DialogTitle>
          <DialogDescription>
            This will permanently remove &ldquo;{block.title || 'Unavailable'}&rdquo;. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 justify-end pt-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={() => { setConfirmDelete(false); handleDelete(); }}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
