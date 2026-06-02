import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

export default function SlotRow({ slot, onChange, onRemove }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">Start</Label>
        <Input type="time" step={900} value={slot.start_time}
          onChange={e => onChange('start_time', e.target.value)} className="h-8 w-28 text-sm" />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">End</Label>
        <Input type="time" step={900} value={slot.end_time}
          onChange={e => onChange('end_time', e.target.value)} className="h-8 w-28 text-sm" />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs text-muted-foreground">Cap.</Label>
        <Input type="number" min={0} value={slot.capacity}
          onChange={e => onChange('capacity', e.target.value)} className="h-8 w-16 text-sm" />
      </div>
      <button onClick={onRemove}
        className="h-8 flex items-center text-muted-foreground hover:text-destructive transition-colors px-1"
        aria-label="Remove slot">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
