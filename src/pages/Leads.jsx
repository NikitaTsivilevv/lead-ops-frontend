import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';

function formatET(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

const QUAL_COLORS = {
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

const OUTCOME_COLORS = {
  sold: 'bg-green-100 text-green-800',
  'not sold': 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  'no-show': 'bg-gray-100 text-gray-700',
  'reschedule needed': 'bg-orange-100 text-orange-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

function StatusBadge({ value, colorMap }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls = colorMap[value.toLowerCase()] || 'bg-secondary text-secondary-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

const EMPTY_FILTERS = { qualification: '', outcome: '', from: '', to: '' };

export default function Leads() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = useCallback(async (f) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.listAppointments({
        qualification: f.qualification || undefined,
        outcome: f.outcome || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      });
      setRows(Array.isArray(data) ? data : (data.appointments || data.items || []));
    } catch (err) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(filters); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const handleRefresh = () => fetch(filters);
  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    fetch(EMPTY_FILTERS);
  };

  const clientDecisionLabel = (val) => {
    if (val === null || val === undefined) return 'Pending';
    if (val === true || val === 'accepted') return 'Accepted';
    if (val === false || val === 'rejected') return 'Rejected';
    if (val === 'auto-accepted') return 'Auto-accepted';
    return val;
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1200px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">{isClient ? 'My appointments' : 'Appointments'}</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Qualification</p>
            <Select value={filters.qualification} onValueChange={v => setFilter('qualification', v === '_all' ? '' : v)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Outcome</p>
            <Select value={filters.outcome} onValueChange={v => setFilter('outcome', v === '_all' ? '' : v)}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="showed">Showed</SelectItem>
                <SelectItem value="no-show">No-show</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="not sold">Not sold</SelectItem>
                <SelectItem value="reschedule needed">Reschedule needed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">From</p>
            <Input type="date" className="h-9 w-36" value={filters.from} onChange={e => setFilter('from', e.target.value)} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">To</p>
            <Input type="date" className="h-9 w-36" value={filters.to} onChange={e => setFilter('to', e.target.value)} />
          </div>

          <Button size="sm" variant="outline" onClick={handleRefresh} className="h-9 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} className="h-9 text-muted-foreground">
            Clear filters
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={handleRefresh}>Retry</Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          rows.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">No appointments yet.</div>
          ) : (
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date (ET)</TableHead>
                    <TableHead className="whitespace-nowrap">Prospect</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Renovations</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Confirmed?</TableHead>
                    <TableHead>Outcome</TableHead>
                    {!isClient && <TableHead>Agent</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/appointments/${row.id}`)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">{formatET(row.appointment_at)}</TableCell>
                      <TableCell className="font-medium text-sm">{row.prospect_name || '—'}</TableCell>
                      <TableCell className="text-sm">{row.address || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Array.isArray(row.renovation_items) ? row.renovation_items.join(', ') : (row.renovation_items || '—')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={row.qualification} colorMap={QUAL_COLORS} />
                      </TableCell>
                      <TableCell className="text-sm">{clientDecisionLabel(row.client_decision)}</TableCell>
                      <TableCell>
                        <StatusBadge value={row.outcome} colorMap={OUTCOME_COLORS} />
                      </TableCell>
                      {!isClient && (
                        <TableCell className="text-sm text-muted-foreground">
                          {row.agent_id ? `#${row.agent_id}` : '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </div>
    </div>
  );
}