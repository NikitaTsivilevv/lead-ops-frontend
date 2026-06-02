import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import ConfirmationBadges from '@/components/ConfirmationBadges';
import { leadDisplayName } from '@/lib/leadName';
import DataTable from '@/components/DataTable';
import Searchbar from '@/components/Searchbar';

const ACTION_REASON_LABELS = {
  pending_outcome: 'Pending outcome',
  awaiting_accept: 'Awaiting acceptance',
  pending_reapproval: 'Needs re-approval',
};

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
  not_sold: 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
};

const CONF_COLORS = {
  yes: 'bg-green-100 text-green-800',
  no: 'bg-red-100 text-red-800',
  reschedule: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
  future: 'bg-blue-100 text-blue-800',
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

const CD_LABELS = {
  pending: 'Pending', accepted: 'Accepted', auto_accepted: 'Auto-accepted',
  rejected: 'Rejected', request_reschedule: 'Reschedule req.', pending_reapproval: 'Re-approval',
};
const CD_COLORS = {
  accepted: 'bg-green-100 text-green-800', auto_accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  request_reschedule: 'bg-orange-100 text-orange-800', pending_reapproval: 'bg-orange-100 text-orange-800',
  pending: 'bg-yellow-100 text-yellow-800',
};
function ClientDecisionBadge({ value }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const cls = CD_COLORS[value] || 'bg-secondary text-secondary-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {CD_LABELS[value] || value}
    </span>
  );
}

const EMPTY_FILTERS = { qualification: '', outcome: '', confirmation_status: '', client_id: '', from: '', to: '' };

function toDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Date ranges (Mon–Sun weeks) returned as YYYY-MM-DD strings for the date filters.
function getQuickRange(key) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (today.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const shift = (base, days) => { const d = new Date(base); d.setDate(base.getDate() + days); return d; };
  switch (key) {
    case 'today':
      return { from: toDateInput(today), to: toDateInput(today) };
    case 'tomorrow': {
      const t = shift(today, 1);
      return { from: toDateInput(t), to: toDateInput(t) };
    }
    case 'this_week': {
      const mon = shift(today, -dow);
      return { from: toDateInput(mon), to: toDateInput(shift(mon, 6)) };
    }
    case 'last_week': {
      const mon = shift(today, -dow - 7);
      return { from: toDateInput(mon), to: toDateInput(shift(mon, 6)) };
    }
    default:
      return { from: '', to: '' };
  }
}

const QUICK_DATES = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
];

export default function Leads() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const { data: actionNeeded = [] } = useQuery({
    queryKey: ['action-needed'],
    queryFn: () => apiClient.getActionNeeded(),
    enabled: isClient,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [clients, setClients] = useState([]);
  useEffect(() => {
    if (isClient) return; // client/caller roles are auto-scoped server-side
    apiClient.listClients()
      .then((data) => setClients(Array.isArray(data) ? data : (data.clients || [])))
      .catch(() => setClients([]));
  }, [isClient]);

  const fetchRows = useCallback(async (f) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.listAppointments({
        qualification: f.qualification || undefined,
        outcome: f.outcome || undefined,
        confirmation_status: f.confirmation_status || undefined,
        client_id: f.client_id ? Number(f.client_id) || undefined : undefined,
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
  const applyFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    fetchRows(next);
  };
  const handleRefresh = () => fetchRows(filters);
  const handleClear = () => { setFilters(EMPTY_FILTERS); fetchRows(EMPTY_FILTERS); };

  const applyQuickDate = (key) => {
    const { from, to } = getQuickRange(key);
    const next = { ...filters, from, to };
    setFilters(next);
    fetchRows(next);
  };
  const isQuickActive = (key) => {
    const { from, to } = getQuickRange(key);
    return filters.from === from && filters.to === to;
  };

  const columns = [
    {
      key: 'appointment_at',
      header: 'Meeting Date',
      headerClassName: 'whitespace-nowrap',
      sortable: true,
      sortValue: (row) => (row.appointment_at ? Date.parse(row.appointment_at) : null),
      cell: (row) => <span className="whitespace-nowrap text-sm">{formatET(row.appointment_at)}</span>,
    },
    {
      key: 'created_at',
      header: 'Created (ET)',
      headerClassName: 'whitespace-nowrap',
      sortable: true,
      sortValue: (row) => (row.created_at ? Date.parse(row.created_at) : null),
      cell: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatET(row.created_at)}</span>,
    },
    {
      key: 'prospect_name',
      header: 'Prospect',
      sortable: true,
      cell: (row) => <span className="font-medium text-sm">{leadDisplayName(row)}</span>,
    },
    {
      key: 'address',
      header: 'Address',
      sortable: true,
      cell: (row) => <span className="text-sm">{row.address || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      defaultHidden: true,
      cell: (row) => <span className="text-sm">{row.phone || '—'}</span>,
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
      sortable: true,
      cell: (row) => <StatusBadge value={row.qualification} colorMap={QUAL_COLORS} />,
    },
    {
      key: 'client_decision',
      header: 'Client decision',
      sortable: true,
      sortValue: (row) => row.client_decision || '',
      cell: (row) => <ClientDecisionBadge value={row.client_decision} />,
    },
    {
      key: 'confirmation_status',
      header: 'Confirmation',
      sortable: true,
      sortValue: (row) => row.confirmation_status || '',
      cell: (row) => <StatusBadge value={row.confirmation_status} colorMap={CONF_COLORS} />,
    },
    {
      key: 'confirmations',
      header: 'Confirmation calls',
      cell: (row) => <ConfirmationBadges confirmations={row.confirmations} />,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      sortable: true,
      cell: (row) => <StatusBadge value={row.outcome} colorMap={OUTCOME_COLORS} />,
    },
    ...(!isClient ? [{
      key: 'client_name',
      header: 'Client',
      sortable: true,
      sortValue: (row) => row.client_name || '',
      cell: (row) => <span className="text-sm">{row.client_name || '—'}</span>,
    }, {
      key: 'agent_id',
      header: 'Agent',
      sortable: true,
      sortValue: (row) => row.agent_id || 0,
      cell: (row) => <span className="text-sm text-muted-foreground">{row.agent_id ? `#${row.agent_id}` : '—'}</span>,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-none mx-auto space-y-4">

        <h1 className="text-2xl font-semibold text-foreground">
          {isClient ? 'My appointments' : 'Appointments'}
        </h1>

        {isClient && actionNeeded.length > 0 && (
          <Alert id="action-needed-banner" className="border-amber-400 bg-amber-50 text-amber-900 scroll-mt-20">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertTitle className="text-amber-900">
              {actionNeeded.length} {actionNeeded.length === 1 ? 'lead needs' : 'leads need'} your action
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1">
                {actionNeeded.map((appt) => (
                  <li key={appt.id} className="text-sm">
                    <Link
                      to={`/appointments/${appt.id}`}
                      className="font-medium underline hover:text-amber-700"
                    >
                      {leadDisplayName(appt)}
                    </Link>
                    {' — '}
                    <span className="text-amber-800">
                      {ACTION_REASON_LABELS[appt.action_reason] || appt.action_reason}
                    </span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end bg-white p-2 rounded-md border border-gray-300 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Qualification</p>
            <Select value={filters.qualification} onValueChange={v => applyFilter('qualification', v === '_all' ? '' : v)}>
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
            <Select value={filters.outcome} onValueChange={v => applyFilter('outcome', v === '_all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All</SelectItem>
                <SelectItem value="showed">Showed</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="not_sold">Not sold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Confirmation</p>
            <Select value={filters.confirmation_status} onValueChange={v => applyFilter('confirmation_status', v === '_all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="future">Future</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isClient && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Client</p>
              <Select value={filters.client_id} onValueChange={v => applyFilter('client_id', v === '_all' ? '' : v)}>
                <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="col-span-2 sm:col-span-full space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_DATES.map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={isQuickActive(key) ? 'default' : 'outline'}
                  onClick={() => applyQuickDate(key)}
                  className="h-9"
                >
                  {label}
                </Button>
              ))}
            </div>
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
                columnToggleId="appointments"
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
                      <p className="font-medium text-sm">{leadDisplayName(row)}</p>
                      <StatusBadge value={row.qualification} colorMap={QUAL_COLORS} />
                    </div>
                    <p className="text-xs text-muted-foreground">{formatET(row.appointment_at)}</p>
                    {row.address && <p className="text-xs text-muted-foreground truncate">{row.address}</p>}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <StatusBadge value={row.outcome} colorMap={OUTCOME_COLORS} />
                      <StatusBadge value={row.confirmation_status} colorMap={CONF_COLORS} />
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
