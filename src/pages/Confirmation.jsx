import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
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

export default function Confirmation() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.listAppointments({ qualification: 'pending' });
      setRows(Array.isArray(data) ? data : (data.appointments || data.items || []));
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1200px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Pending qualification</h1>
            {!loading && !error && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-2.5 py-0.5 text-xs font-medium">
                {rows.length}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={load}>Retry</Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table / empty */}
        {!loading && !error && (
          rows.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              Nothing pending — all caught up.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date (ET)</TableHead>
                    <TableHead className="whitespace-nowrap">Prospect</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Renovations</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Recording</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatET(row.appointment_at)}</TableCell>
                      <TableCell className="font-medium text-sm">{row.prospect_name || '—'}</TableCell>
                      <TableCell className="text-sm">{row.address || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Array.isArray(row.renovation_items) ? row.renovation_items.join(', ') : (row.renovation_items || '—')}
                      </TableCell>
                      <TableCell className="text-sm">{row.phone || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {row.recording_url
                          ? <a href={row.recording_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline text-xs">Listen</a>
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => navigate(`/appointments/${row.id}`)}>
                          Review
                        </Button>
                      </TableCell>
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