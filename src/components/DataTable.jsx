import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TablePagination from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ArrowUp, ArrowDown, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// Column shape: { key, header, cell(row), headerClassName?, className?,
//                 sortable?: bool, sortValue?: (row) => string|number|null }
// columnToggleId: when set, render a "Columns" picker and persist the choice
//                 to localStorage under that id.

function loadHidden(id) {
  if (!id) return [];
  try { return JSON.parse(localStorage.getItem(`dt-hidden-${id}`)) || []; } catch { return []; }
}
function saveHidden(id, hidden) {
  if (!id) return;
  try { localStorage.setItem(`dt-hidden-${id}`, JSON.stringify(hidden)); } catch { /* ignore */ }
}

export default function DataTable({
  columns,
  rows = [],
  onRowClick,
  mobileCard,
  actions,
  emptyMessage = 'No items.',
  defaultPageSize = 25,
  columnToggleId,
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' }
  const [hidden, setHidden] = useState(() => loadHidden(columnToggleId));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [rows, sort]);
  useEffect(() => { saveHidden(columnToggleId, hidden); }, [hidden, columnToggleId]);

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const valueOf = col.sortValue || ((r) => r[col.key]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls sort last
      if (bv == null) return -1;
      const cmp = (typeof av === 'number' && typeof bv === 'number')
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns]);

  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null; // asc -> desc -> unsorted
    });
  };

  if (rows.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const pagedRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);

  const defaultMobileRow = (row) => (
    <>
      {visibleColumns.map((col) => (
        <div key={col.key} className="flex gap-2 text-sm">
          <span className="text-muted-foreground shrink-0 w-28">{col.header}</span>
          <span>{col.cell(row)}</span>
        </div>
      ))}
      {actions && (
        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          {actions(row)}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      {columnToggleId && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={!hidden.includes(col.key)}
                  onCheckedChange={() =>
                    setHidden((h) => (h.includes(col.key) ? h.filter((k) => k !== col.key) : [...h, col.key]))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden md:block rounded-lg border overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-blue-100 z-10">
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className={cn('py-2 px-3 text-xs font-semibold uppercase tracking-wide text-black', col.headerClassName)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors uppercase"
                    >
                      {col.header}
                      {sort?.key === col.key
                        ? (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="py-2 px-3" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row, i) => (
              <TableRow
                key={row.id ?? i}
                className={cn(
                  i % 2 === 1 && 'bg-blue-50',
                  onRowClick && 'cursor-pointer hover:bg-muted/50 transition-colors',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {visibleColumns.map((col) => (
                  <TableCell key={col.key} className={cn('py-2 px-3 text-sm', col.className)}>
                    {col.cell(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {pagedRows.map((row, i) => (
          <div
            key={row.id ?? i}
            className={`rounded-lg border bg-card p-4 space-y-2${onRowClick ? ' cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {mobileCard ? mobileCard(row) : defaultMobileRow(row)}
          </div>
        ))}
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
        alwaysShow
      />
    </div>
  );
}
