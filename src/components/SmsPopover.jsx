import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/api/apiClient';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

function applyTemplate(body, lead) {
  const name = (lead?.prospect_name || '').trim();
  const parts = name.split(/\s+/);
  const apptDate = lead?.appointment_at
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
      }).format(new Date(lead.appointment_at))
    : '';
  const apptTime = lead?.appointment_at
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(new Date(lead.appointment_at))
    : '';
  const vars = {
    first_name: parts[0] || '',
    last_name: parts.length > 1 ? parts[parts.length - 1] : '',
    full_name: name,
    name,
    phone: lead?.phone || '',
    address: lead?.address_street || '',
    city: lead?.address_city || '',
    state: lead?.address_state || '',
    zip: lead?.address_zip || '',
    appointment_date: apptDate,
    appointment_time: apptTime,
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? vars[key] : `{{${key}}}`));
}

export default function SmsPopover({ lead, children }) {
  const leadId = lead?.id;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectKey, setSelectKey] = useState(0);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['comms', leadId], queryFn: () => apiClient.getCommunications(leadId), enabled: open,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['sms-templates'], queryFn: () => apiClient.listSmsTemplates(), enabled: open,
  });

  const messages = (data?.thread || []).filter((x) => x.type === 'message').slice(-5);

  const send = useMutation({
    mutationFn: () => apiClient.sendMessage(leadId, text),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['comms', leadId] });
      toast.success('Sent');
    },
    onError: (e) => toast.error(e.message || 'Failed to send'),
  });

  function handleTemplateSelect(templateId) {
    const tpl = templates.find((t) => String(t.id) === templateId);
    if (!tpl) return;
    setText(applyTemplate(tpl.body, lead));
    // Reset the Select back to placeholder by remounting it
    setSelectKey((k) => k + 1);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button size="icon" variant="ghost"><MessageSquare className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>

        <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
          {messages.map((m) => (
            <div key={m.id} className={m.direction === 'outbound' ? 'text-right' : 'text-left'}>
              <span className="inline-block rounded px-2 py-1 bg-muted">{m.body}</span>
            </div>
          ))}
          {messages.length === 0 && <div className="text-muted-foreground text-sm">No messages yet.</div>}
        </div>

        {templates.length > 0 && (
          <Select key={selectKey} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Insert template…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a text…" />
        <Button disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}>Send</Button>
      </DialogContent>
    </Dialog>
  );
}
