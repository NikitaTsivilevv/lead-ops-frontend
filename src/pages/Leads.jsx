import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmationBadges from '@/components/ConfirmationBadges';
import DataTable from '@/components/DataTable';
import Searchbar from '@/components/Searchbar';

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
  const [search, setSearch] = useState('');

  const fetchRows = useCallback(async (f) => {
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

  useEffect(() => { fetchRows(filters); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const handleRefresh = () => fetchRows(filters);
  const handleClear = () => { setFilters(EMPTY_FILTERS); fetchRows(EMPTY_FILTERS); };

  const columns = [
    {
      key: 'appointment_at',
      header: 'Date (ET)',
      headerClassName: 'whitespace-nowrap',
      cell: (row) => <span className="whitespace-nowrap text-sm">{formatET(row.appointment_at)}</span>,
    },
    {
      key: 'prospect_name',
      header: 'Prospect',
      cell: (row) => <span className="font-medium text-sm">{row.prospect_name || '—'}</span>,
    },
    {
      key: 'address',
      header: 'Address',
      cell: (row) => <span className="text-sm">{row.address || '—'}</span>,
    },
    {
      key: 'renovation_items',
      header: 'Renovations',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {Array.isArray(row.renovation_items) ? row.renovation_items.join(', ') : (row.renovation_items || '—')}
        </span>
      ),
    },
    {
      key: 'qualification',
      header: 'Qualification',
      cell: (row) => <StatusBadge value={row.qualification} colorMap={QUAL_COLORS} />,
    },
    {
      key: 'confirmations',
      header: 'Confirmed?',
      cell: (row) => <ConfirmationBadges confirmations={row.confirmations} />,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      cell: (row) => <StatusBadge value={row.outcome} colorMap={OUTCOME_COLORS} />,
    },
    ...(!isClient ? [{
      key: 'agent_id',
      header: 'Agent',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.agent_id ? `#${row.agent_id}` : '—'}</span>,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-[1200px] mx-auto space-y-4">

        <h1 className="text-2xl font-semibold text-foreground">
          {isClient ? 'My appointments' : 'Appointments'}
        </h1>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end bg-white p-2 rounded-md border border-gray-300 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Qualification</p>
            <Select value={filters.qualification} onValueChange={v => setFilter('qualification', v === '_all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="All" /></SelectTrigger>
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
              <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="All" /></SelectTrigger>
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
            <Input type="date" className="h-9 w-full sm:w-36" value={filters.from} onChange={e => setFilter('from', e.target.value)} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">To</p>
            <Input type="date" className="h-9 w-full sm:w-36" value={filters.to} onChange={e => setFilter('to', e.target.value)} />
          </div>

          <div className="col-span-2 sm:col-span-1 flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} className="h-9 gap-1.5 flex-1 sm:flex-none">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear} className="h-9 text-muted-foreground flex-1 sm:flex-none">
              Clear
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={handleRefresh}>Retry</Button>
          </div>
        )}

        <Card>
          <CardContent className="pt-4 space-y-3">
            <Searchbar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, address, outcome…"
            />
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !error && (
              <DataTable
                columns={columns}
                rows={rows.filter((r) => {
                  if (!search.trim()) return true;
                  const q = search.trim().toLowerCase();
                  return [r.prospect_name, r.address, r.phone, r.qualification, r.outcome, r.campaign_source, r.assigned_closer]
                    .some((v) => v && String(v).toLowerCase().includes(q));
                })}
                onRowClick={(row) => navigate(`/appointments/${row.id}`)}
                emptyMessage="No appointments yet."
                mobileCard={(row) => (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{row.prospect_name || '—'}</p>
                      <StatusBadge value={row.qualification} colorMap={QUAL_COLORS} />
                    </div>
                    <p className="text-xs text-muted-foreground">{formatET(row.appointment_at)}</p>
                    {row.address && <p className="text-xs text-muted-foreground truncate">{row.address}</p>}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <StatusBadge value={row.outcome} colorMap={OUTCOME_COLORS} />
                      <ConfirmationBadges confirmations={row.confirmations} />
                    </div>
                  </>
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
