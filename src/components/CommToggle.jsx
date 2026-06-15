import SmsPopover from '@/components/SmsPopover';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { useCall } from '@/lib/CallContext'; // provided by the Voice track; safe null fallback in the stub

export default function CommToggle({ lead, unread }) {
  const call = useCall(); // (phone, appointmentId) => void  | null
  return (
    <span className="inline-flex items-center gap-1">
      <Button size="icon" variant="ghost" disabled={!call}
        onClick={() => call?.(lead.phone, lead.id)} title="Call">
        <Phone className="h-4 w-4" />
      </Button>
      <SmsPopover leadId={lead.id} />
      {unread && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-500" title="Unread" />}
    </span>
  );
}
