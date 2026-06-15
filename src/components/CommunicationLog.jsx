import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, Phone } from 'lucide-react';

const TZ = 'America/New_York';

function formatET(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function callSummary(item) {
  const parts = [item.direction === 'inbound' ? 'Inbound call' : 'Outbound call'];
  if (item.status) parts.push(item.status.replace(/_/g, ' '));
  if (item.duration_seconds != null) parts.push(`${item.duration_seconds}s`);
  return parts.join(' · ');
}

// Read-only Communication log beside the Activity log on the lead detail.
// Renders messages ∪ calls (from the Foundation read API), time-sorted, and marks the
// thread read on mount.
export default function CommunicationLog({ appointmentId }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['comms', appointmentId],
    queryFn: () => apiClient.getCommunications(appointmentId),
    enabled: !!appointmentId,
  });

  useEffect(() => {
    if (!appointmentId) return;
    apiClient
      .markCommsRead(appointmentId)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations'] }))
      .catch(() => {});
  }, [appointmentId, qc]);

  const thread = (data?.thread || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Communication log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && <p className="text-sm text-destructive">Failed to load communications.</p>}
        {!isLoading && !isError && thread.length === 0 && (
          <p className="text-sm text-muted-foreground">No calls or texts yet.</p>
        )}
        {thread.map((item) => (
          <div key={`${item.type}-${item.id}`} className="flex items-start gap-2 text-sm">
            {item.type === 'message' ? (
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            ) : (
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.direction}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatET(item.created_at)}
                </span>
              </div>
              {item.type === 'message' ? (
                <p className="break-words">{item.body}</p>
              ) : (
                <p>
                  {callSummary(item)}
                  {item.recording_url && (
                    <>
                      {' · '}
                      <a
                        href={item.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline">
                        recording
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
