import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function TablePagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange, alwaysShow = false }) {
  if (!alwaysShow && totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 bg-white p-2 rounded-md border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            onPageSizeChange(Number(v));
            onPageChange(0);
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-sm text-muted-foreground">
        Page {page + 1} of {totalPages || 1}
      </span>

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          ← Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => onPageChange(Math.min((totalPages || 1) - 1, page + 1))}
          disabled={page >= (totalPages || 1) - 1}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
