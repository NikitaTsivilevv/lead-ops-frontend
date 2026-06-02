import { X } from 'lucide-react';

export default function UnavailBlockRow({ block, onEdit, onDelete }) {
  const fmt = (iso, allDay) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      ...(allDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true }),
    }).format(new Date(iso));

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-muted/50">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-sm font-medium truncate">{block.title}</span>
        <span className="text-xs text-muted-foreground truncate">
          {fmt(block.start_at, block.all_day)} – {fmt(block.end_at, block.all_day)}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {block.source === 'ics' && (
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">ICS</span>
        )}
        <button onClick={onEdit}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5">
          Edit
        </button>
        <button onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors px-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
