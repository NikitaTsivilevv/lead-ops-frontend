import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/api/apiClient';
import DataTable from '@/components/DataTable';
import { fmt } from './utils';

export default function CostSummaryTab({ clients }) {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastOfMonth  = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);

  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(lastOfMonth);
  const [queried, setQueried] = useState(false);

  const costQ = useQuery({
    queryKey: ['payroll-cost', clientId, from, to],
    enabled: queried && !!from && !!to,
    queryFn: () => apiClient.getPayrollCost({ client_id: clientId || undefined, from, to }),
  });

  const rows = costQ.data?.rows || [];

  const totals = rows.reduce(
    (acc, r) => ({
      salary:     acc.salary     + (r.salary_cents || 0),
      dialer:     acc.dialer     + (r.dialer_cents || 0),
      managerial: acc.managerial + (r.managerial_cents || 0),
      total:      acc.total      + (r.total_cents || 0),
    }),
    { salary: 0, dialer: 0, managerial: 0, total: 0 }
  );

  const exportCSV = () => {
    const header = 'Date,Client ID,Salary,Dialer,Managerial,Total\n';
    const body = rows.map((r) =>
      [r.work_date, r.client_id,
       (r.salary_cents / 100).toFixed(2), (r.dialer_cents / 100).toFixed(2),
       ((r.managerial_cents || 0) / 100).toFixed(2), (r.total_cents / 100).toFixed(2),
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-cost-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'date',       header: 'Date',       cell: (r) => r.work_date },
    { key: 'client',     header: 'Client',     cell: (r) => clients.find((c) => c.id === r.client_id)?.name || r.client_id },
    { key: 'salary',     header: 'Salary',     cell: (r) => fmt(r.salary_cents) },
    { key: 'dialer',     header: 'Dialer',     cell: (r) => fmt(r.dialer_cents) },
    { key: 'managerial', header: 'Managerial', cell: (r) => fmt(r.managerial_cents) },
    { key: 'total',      header: 'Total',      cell: (r) => fmt(r.total_cents) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 flex flex-col gap-1">
          <Label>Client (optional)</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm w-full md:min-w-[160px] "
            value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className='flex flex-col w-full md:flex-row gap-4'>
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={from} className="w-[180px] md:w-36" onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={to} className="w-[180px] md:w-36" onChange={(e) => setTo(e.target.value)} />
        </div>
        
        <Button onClick={() => { setQueried(true); costQ.refetch(); }} disabled={!from || !to || costQ.isFetching}>
          {costQ.isFetching ? 'Loading…' : 'Run'}
        </Button>
         {queried && !costQ.isFetching && rows.length > 0 && (
        <>
         
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              ['Total Salary',     fmt(totals.salary)],
              ['Total Dialer',     fmt(totals.dialer)],
              ['Total Managerial', fmt(totals.managerial)],
              ['Grand Total',      fmt(totals.total)],
            ].map(([label, val]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold mt-0.5">{val}</p>
                </CardContent>
              </Card>
            ))}
          </div>
           <DataTable columns={columns} rows={rows} emptyMessage="No cost data." />
        </>
      )}

        {rows.length > 0 && (
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
        )}
        </div>
      </div>

      {costQ.isError && <p className="text-destructive">Failed to load cost data</p>}

     
      {queried && !costQ.isFetching && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No cost data for the selected period.</p>
      )}
    </div>
  );
}
