import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/api/apiClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (cents) =>
  cents == null ? '—' : `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const monthStart = () => `${today().slice(0, 8)}01`;

export default function AdminPnl() {
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.listClients() });
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [granularity, setGranularity] = useState('day');
  const [clientId, setClientId] = useState('');

  const pnl = useQuery({
    queryKey: ['pnl', from, to, granularity, clientId],
    queryFn: () => apiClient.getPnl({ from, to, granularity, client_id: clientId || undefined }),
  });

  const rows = pnl.data?.rows || [];
  const totals = pnl.data?.totals;
  const list = clients.data?.clients || [];
  const chartData = rows.map((r) => ({ label: `${r.client_name} ${r.period}`, profit: (r.profit_cents ?? 0) / 100 }));

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">P&amp;L Dashboard</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5"><Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Granularity</Label>
              <select className="border rounded h-9 px-2 text-sm block"
                value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select></div>
            <div className="space-y-1.5"><Label>Client</Label>
              <select className="border rounded h-9 px-2 text-sm block"
                value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">All clients</option>
                {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <Button variant="outline" onClick={() => pnl.refetch()}>Refresh</Button>
          </CardContent>
        </Card>

        {pnl.isError && (
          <p className="text-sm text-red-600">{pnl.error?.payload?.message || pnl.error?.message}</p>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Profit by period</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" hide={chartData.length > 12} />
                <YAxis />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString('en-US')}`} />
                <Bar dataKey="profit">
                  {chartData.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? '#16a34a' : '#dc2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">P&amp;L</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Client</th>
                  <th className="pr-3">Period</th>
                  <th className="pr-3 text-right">Revenue</th>
                  <th className="pr-3 text-right">Cost</th>
                  <th className="pr-3 text-right">Profit</th>
                  <th className="pr-3 text-right">Leads</th>
                  <th className="text-right">Cost / lead</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.client_id}-${r.period}-${i}`} className="border-b">
                    <td className="py-1.5 pr-3">{r.client_name}</td>
                    <td className="pr-3">{r.period}</td>
                    <td className="pr-3 text-right text-green-600">{fmt(r.revenue_cents)}</td>
                    <td className="pr-3 text-right text-red-600">{fmt(r.cost_cents)}</td>
                    <td className={`pr-3 text-right font-medium ${r.profit_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(r.profit_cents)}
                    </td>
                    <td className="pr-3 text-right">{r.lead_count}</td>
                    <td className="text-right">{fmt(r.cost_per_lead_cents)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-muted-foreground">No data for this period.</td></tr>
                )}
              </tbody>
              {totals && rows.length > 0 && (
                <tfoot>
                  <tr className="font-semibold border-t-2">
                    <td className="py-2 pr-3">Totals</td>
                    <td></td>
                    <td className="pr-3 text-right text-green-600">{fmt(totals.revenue_cents)}</td>
                    <td className="pr-3 text-right text-red-600">{fmt(totals.cost_cents)}</td>
                    <td className={`pr-3 text-right ${totals.profit_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(totals.profit_cents)}
                    </td>
                    <td className="pr-3 text-right">{totals.lead_count}</td>
                    <td className="text-right">{fmt(totals.cost_per_lead_cents)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
