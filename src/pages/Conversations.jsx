import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const TZ = 'America/New_York';

function formatET(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export default function Conversations() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.listConversations(),
    refetchInterval: 30_000,
  });

  const conversations = (data?.conversations || [])
    .slice()
    .sort((a, b) => new Date(b.last_at) - new Date(a.last_at))
    .filter((c) => (unreadOnly ? c.unread : true));

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <Button
            size="sm"
            variant={unreadOnly ? 'default' : 'outline'}
            onClick={() => setUnreadOnly((v) => !v)}>
            {unreadOnly ? 'Showing unread' : 'All'}
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && (
          <p className="text-destructive text-sm">
            Failed to load conversations: {String(error?.message || error)}
          </p>
        )}

        {!isLoading && !isError && (
          <Card>
            <CardContent className="p-0 divide-y">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">No conversations yet.</p>
              ) : (
                conversations.map((c) => (
                  <Link
                    key={c.appointment_id}
                    to={`/appointments/${c.appointment_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    {c.unread ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" title="Unread" />
                    ) : (
                      <span className="h-2 w-2 shrink-0" />
                    )}
                    <span className={`flex-1 text-sm ${c.unread ? 'font-semibold' : 'font-medium'}`}>
                      {c.prospect_name || `Lead #${c.appointment_id}`}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatET(c.last_at)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
