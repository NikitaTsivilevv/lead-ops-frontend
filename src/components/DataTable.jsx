import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TablePagination from '@/components/TablePagination';
import { cn } from '@/lib/utils';

export default function DataTable({
  columns,
  rows = [],
  onRowClick,
  mobileCard,
  actions,
  emptyMessage = 'No items.',
  defaultPageSize = 25,
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [rows]);

  if (rows.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const totalPages = Math.ceil(rows.length / pageSize);
  const pagedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  const defaultMobileRow = (row) => (
    <>
      {columns.map((col) => (
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
      {/* Desktop */}
      <div className="hidden md:block rounded-lg border overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-blue-100 z-10">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={cn('py-2 px-3 text-xs font-semibold uppercase tracking-wide text-black', col.headerClassName)}>
                  {col.header}
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
                {columns.map((col) => (
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
