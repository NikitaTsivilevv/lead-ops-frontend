import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/api/apiClient';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

export default function SmsPopover({ leadId, children }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['comms', leadId], queryFn: () => apiClient.getCommunications(leadId), enabled: open,
  });
  const messages = (data?.thread || []).filter((x) => x.type === 'message').slice(-5);
  const send = useMutation({
    mutationFn: () => apiClient.sendMessage(leadId, text),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['comms', leadId] }); toast.success('Sent'); },
    onError: (e) => toast.error(e.message || 'Failed to send'),
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children || <Button size="icon" variant="ghost"><MessageSquare className="h-4 w-4" /></Button>}</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
          {messages.map((m) => (
            <div key={m.id} className={m.direction === 'outbound' ? 'text-right' : 'text-left'}>
              <span className="inline-block rounded px-2 py-1 bg-muted">{m.body}</span>
            </div>
          ))}
          {messages.length === 0 && <div className="text-muted-foreground">No messages yet.</div>}
        </div>
        <Textarea className="mt-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a text…" />
        <Button className="mt-2 w-full" disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}>Send</Button>
      </PopoverContent>
    </Popover>
  );
}
