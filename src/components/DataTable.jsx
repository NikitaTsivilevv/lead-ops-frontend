import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TablePagination from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUp, ArrowDown, ChevronsUpDown, SlidersHorizontal,
  ListFilter, Search, X, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function loadHidden(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(`dt-hidden-${id}`);
    if (raw === null) return null;
    return JSON.parse(raw) || [];
  } catch { return null; }
}
function saveHidden(id, hidden) {
  if (!id) return;
  try { localStorage.setItem(`dt-hidden-${id}`, JSON.stringify(hidden)); } catch { /* ignore */ }
}
function resolveInitialHidden(id, columns) {
  const saved = loadHidden(id);
  if (saved !== null) return saved;
  return columns.filter((c) => c.defaultHidden).map((c) => c.key);
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
  rowId,
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState(null);
  const [hidden, setHidden] = useState(() => resolveInitialHidden(columnToggleId, columns));

  const [openFilter, setOpenFilter] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [valueFilters, setValueFilters] = useState({});
  const [pendingValues, setPendingValues] = useState(null);
  const [pendingDate, setPendingDate] = useState(null);
  const [valueSearch, setValueSearch] = useState('');
  const popupRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [rows, sort]);
  useEffect(() => { saveHidden(columnToggleId, hidden); }, [hidden, columnToggleId]);

  // Close popup on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        !e.target.closest('[data-filter-btn]')
      ) {
        setOpenFilter(null);
        setPendingValues(null);
        setPendingDate(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilter]);

  // Close popup on scroll (but not scroll inside the popup itself)
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setOpenFilter(null);
      setPendingValues(null);
      setPendingDate(null);
    };
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [openFilter]);

  const getOptions = useCallback((col) => {
    if (col.filterConfig?.options) return col.filterConfig.options;
    const getValue = col.filterConfig?.getValue || ((r) => r[col.key]);
    const rawVals = rows.map((r) => {
      const v = getValue(r);
      return v == null ? '' : String(v);
    });
    const vals = [...new Set(rawVals)].sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (a !== '' && b === '') return -1;
      return a.localeCompare(b);
    });
    return vals.map((v) => ({ value: v, label: v || '(none)' }));
  }, [rows]);

  const handleHeaderClick = (e, col) => {
    if (!col.filterConfig && !col.sortable) return;
    if (!col.filterConfig) {
      toggleSort(col.key);
      return;
    }
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 264;
    const x = Math.min(rect.left, window.innerWidth - popupWidth - 8);
    const y = rect.bottom + 4;

    if (openFilter === col.key) {
      setOpenFilter(null);
      setPendingValues(null);
      setPendingDate(null);
      return;
    }

    setOpenFilter(col.key);
    setValueSearch('');

    if (col.filterConfig.type === 'values') {
      const options = getOptions(col);
      const current = valueFilters[col.key];
      setPendingValues(current !== undefined ? new Set(current) : new Set(options.map((o) => o.value)));
      setPendingDate(null);
    } else if (col.filterConfig.type === 'date') {
      setPendingDate({ from: col.filterConfig.from || '', to: col.filterConfig.to || '' });
      setPendingValues(null);
    }

    setPopupPos({ x, y });
  };

  const handleSortFromPopup = (key, dir) => {
    setSort({ key, dir });
  };

  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const handleFilterOk = () => {
    const col = columns.find((c) => c.key === openFilter);
    if (!col) return;

    if (col.filterConfig?.type === 'values' && pendingValues !== null) {
      const options = getOptions(col);
      const allValues = options.map((o) => o.value);
      const allSelected = allValues.every((v) => pendingValues.has(v));
      setValueFilters((prev) => ({
        ...prev,
        [openFilter]: allSelected ? undefined : [...pendingValues],
      }));
      setPage(0);
    } else if (col.filterConfig?.type === 'date' && pendingDate) {
      col.filterConfig.onApply(pendingDate);
    }

    setOpenFilter(null);
    setPendingValues(null);
    setPendingDate(null);
  };

  const handleFilterCancel = () => {
    setOpenFilter(null);
    setPendingValues(null);
    setPendingDate(null);
  };

  const clearAllFilters = () => {
    setValueFilters({});
    columns.forEach((col) => {
      if (col.filterConfig?.type === 'date' && col.filterConfig.onApply) {
        col.filterConfig.onApply({ from: '', to: '' });
      }
    });
    setPage(0);
  };

  const filteredRows = useMemo(() => {
    let result = rows;
    for (const [key, allowed] of Object.entries(valueFilters)) {
      if (allowed === undefined) continue;
      const col = columns.find((c) => c.key === key);
      if (!col?.filterConfig) continue;
      const getValue = col.filterConfig.getValue || ((r) => r[key]);
      result = result.filter((r) => {
        const v = getValue(r);
        const str = v == null ? '' : String(v);
        return allowed.includes(str);
      });
    }
    return result;
  }, [rows, valueFilters, columns]);

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filteredRows;
    const valueOf = col.sortValue || ((r) => r[col.key]);
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sort, columns]);

  if (rows.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const pagedRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);

  const activeValueFilterCount = Object.values(valueFilters).filter((v) => v !== undefined).length;
  const activeDateFilter = columns.some(
    (c) => c.filterConfig?.type === 'date' && (c.filterConfig.from || c.filterConfig.to),
  );
  const hasActiveFilters = activeValueFilterCount > 0 || activeDateFilter;

  // ---- Popup ----
  const openCol = openFilter ? columns.find((c) => c.key === openFilter) : null;

  const renderPopup = () => {
    if (!openCol) return null;

    let options = [];
    let filteredOptions = [];

    if (openCol.filterConfig?.type === 'values') {
      options = getOptions(openCol);
      filteredOptions = valueSearch
        ? options.filter((o) =>
            String(o.label).toLowerCase().includes(valueSearch.toLowerCase()),
          )
        : options;
    }

    return (
      <div
        ref={popupRef}
        style={{ position: 'fixed', top: popupPos.y, left: popupPos.x, zIndex: 9999, width: 264 }}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 text-sm select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 rounded-t-xl">
          <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
            {openCol.header}
          </span>
          <button
            onClick={handleFilterCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sort */}
        {openCol.sortable && (
          <div className="py-1">
            <button
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => handleSortFromPopup(openCol.key, 'asc')}
            >
              <ArrowUp className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-left">Sort A to Z</span>
              {sort?.key === openCol.key && sort.dir === 'asc' && (
                <Check className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => handleSortFromPopup(openCol.key, 'desc')}
            >
              <ArrowDown className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-left">Sort Z to A</span>
              {sort?.key === openCol.key && sort.dir === 'desc' && (
                <Check className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>
          </div>
        )}

        {/* Value filter */}
        {openCol.filterConfig?.type === 'values' && pendingValues !== null && (
          <>
            <div className="border-t border-gray-200" />

            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => setPendingValues(new Set(options.map((o) => o.value)))}
                >
                  Select all {options.length}
                </button>
                <span className="text-gray-400">-</span>
                <button
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => setPendingValues(new Set())}
                >
                  Clear
                </button>
              </div>
              <span className="text-xs text-gray-500">Displaying {options.length}</span>
            </div>

            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={valueSearch}
                  onChange={(e) => setValueSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto px-3 pb-1">
              {filteredOptions.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No values found</p>
              ) : (
                filteredOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        pendingValues.has(opt.value)
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-300 hover:border-blue-400',
                      )}
                      onClick={() => {
                        const next = new Set(pendingValues);
                        if (next.has(opt.value)) next.delete(opt.value);
                        else next.add(opt.value);
                        setPendingValues(next);
                      }}
                    >
                      {pendingValues.has(opt.value) && (
                        <Check className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                    <span
                      className="text-sm text-gray-700 flex-1"
                      onClick={() => {
                        const next = new Set(pendingValues);
                        if (next.has(opt.value)) next.delete(opt.value);
                        else next.add(opt.value);
                        setPendingValues(next);
                      }}
                    >
                      {opt.label}
                    </span>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {/* Date filter */}
        {openCol.filterConfig?.type === 'date' && pendingDate !== null && (
          <>
            <div className="border-t border-gray-200" />
            <div className="px-3 py-3 space-y-3">
              {openCol.filterConfig.quickDates && (
                <div className="flex flex-wrap gap-1.5">
                  {openCol.filterConfig.quickDates.map(({ key, label }) => {
                    const range = openCol.filterConfig.getQuickRange(key);
                    const isActive =
                      pendingDate.from === range.from && pendingDate.to === range.to;
                    return (
                      <button
                        key={key}
                        onClick={() => setPendingDate(range)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-full border transition-colors font-medium',
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">From</label>
                  <input
                    type="date"
                    value={pendingDate.from}
                    onChange={(e) => setPendingDate((p) => ({ ...p, from: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">To</label>
                  <input
                    type="date"
                    value={pendingDate.to}
                    onChange={(e) => setPendingDate((p) => ({ ...p, to: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              {(pendingDate.from || pendingDate.to) && (
                <button
                  onClick={() => setPendingDate({ from: '', to: '' })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear dates
                </button>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-3 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleFilterCancel}
            className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleFilterOk}
            className="flex-1 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    );
  };

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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 min-h-[32px]">
        {hasActiveFilters ? (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
          >
            <X className="w-3 h-3" />
            Clear all filters
          </button>
        ) : (
          <div />
        )}
        {columnToggleId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 ml-auto">
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
                    setHidden((h) =>
                      h.includes(col.key) ? h.filter((k) => k !== col.key) : [...h, col.key],
                    )
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:block rounded-lg border overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-blue-100 z-10">
            <TableRow>
              {visibleColumns.map((col) => {
                const hasPopup = !!col.filterConfig;
                const isSorted = sort?.key === col.key;
                const isFilterActive =
                  valueFilters[col.key] !== undefined ||
                  (col.filterConfig?.type === 'date' &&
                    (col.filterConfig.from || col.filterConfig.to));
                const isOpen = openFilter === col.key;

                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      'py-2 px-3 text-xs font-semibold uppercase tracking-wide text-black',
                      col.headerClassName,
                    )}
                  >
                    {hasPopup || col.sortable ? (
                      <button
                        type="button"
                        data-filter-btn="true"
                        onClick={(e) => handleHeaderClick(e, col)}
                        className={cn(
                          'inline-flex items-center gap-1 uppercase w-full transition-colors',
                          isOpen
                            ? 'text-blue-700'
                            : isFilterActive
                              ? 'text-blue-600 hover:text-blue-700'
                              : 'hover:text-blue-700',
                        )}
                      >
                        <span className="flex-1 text-left">{col.header}</span>
                        {isSorted &&
                          (sort.dir === 'asc' ? (
                            <ArrowUp className="w-3 h-3 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3 h-3 shrink-0" />
                          ))}
                        {!isSorted && !hasPopup && (
                          <ChevronsUpDown className="w-3 h-3 opacity-40 shrink-0" />
                        )}
                        {hasPopup && (
                          <ListFilter
                            className={cn(
                              'w-3 h-3 shrink-0',
                              isFilterActive ? 'text-blue-600' : 'opacity-40',
                            )}
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
              {actions && <TableHead className="py-2 px-3" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (actions ? 1 : 0)}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  No results match the current filters.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, i) => (
                <TableRow
                  key={row.id ?? i}
                  id={rowId ? rowId(row) : undefined}
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
                    <TableCell
                      className="py-2 px-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {sortedRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No results match the current filters.
          </p>
        ) : (
          pagedRows.map((row, i) => (
            <div
              key={row.id ?? i}
              id={rowId ? rowId(row) : undefined}
              className={`rounded-lg border bg-card p-4 space-y-2${onRowClick ? ' cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {mobileCard ? mobileCard(row) : defaultMobileRow(row)}
            </div>
          ))
        )}
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
        alwaysShow
      />

      {openFilter && renderPopup()}
    </div>
  );
}
