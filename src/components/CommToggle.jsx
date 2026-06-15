import SmsPopover from '@/components/SmsPopover';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { useCall } from '@/lib/CallContext'; // { call, ready } from the CallWidget
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { canUseComms } from '@/lib/commsRoles';

export default function CommToggle({ lead, unread }) {
  const { user } = useAuth();
  const { call, ready } = useCall(); // ready === Twilio Device registered + usable
  // Hide call/text actions for roles that can't use comms (e.g. caller, qa) — spec §7.
  if (!user || !canUseComms(user.role)) return null;
  const canCall = ready && !!lead.phone;
  return (
    <span className="inline-flex items-center gap-1">
      <Button size="icon" variant="ghost" disabled={!canCall}
        onClick={() => call?.(lead.phone, lead.id)}
        title={ready ? 'Call' : 'Calling not available'}>
        <Phone className="h-4 w-4" />
      </Button>
      <SmsPopover leadId={lead.id} />
      {unread && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-500" title="Unread" />}
    </span>
  );
}
