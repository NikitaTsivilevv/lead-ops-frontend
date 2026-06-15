import { useEffect, useRef, useState, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import CallContext from '@/lib/CallContext';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';

// Roles permitted to use in-app comms (mirrors backend COMMS_ROLES).
const COMMS_ROLES = ['admin', 'operations', 'confirmation', 'call_center_admin', 'client'];

// Global softphone: holds the Twilio Device, sends presence heartbeats, exposes a
// click-to-call function via CallContext, and pops up inbound calls (answer/reject).
export default function CallWidget({ children }) {
  const { user } = useAuth();
  const deviceRef = useRef(null);
  const [active, setActive] = useState(null);     // current outbound/answered Call
  const [incoming, setIncoming] = useState(null);  // ringing inbound Call
  const enabled = !!user && COMMS_ROLES.includes(user.role);

  useEffect(() => {
    if (!enabled) return undefined;
    let device;
    let hb;
    let destroyed = false;
    (async () => {
      try {
        const { token } = await apiClient.getVoiceToken();
        device = new Device(token, { logLevel: 'error' });
        device.on('registered', () => apiClient.setPresence(true).catch(() => {}));
        device.on('incoming', (call) => setIncoming(call));
        device.on('tokenWillExpire', async () => {
          try { device.updateToken((await apiClient.getVoiceToken()).token); } catch {}
        });
        await device.register();
        if (destroyed) { device.destroy(); return; }
        deviceRef.current = device;
        hb = setInterval(() => apiClient.setPresence(true).catch(() => {}), 30_000);
      } catch {
        toast.error('Calling unavailable');
      }
    })();
    return () => {
      destroyed = true;
      clearInterval(hb);
      apiClient.setPresence(false).catch(() => {});
      deviceRef.current = null;
      device?.destroy();
    };
  }, [enabled]);

  const call = useCallback((phone, appointmentId) => {
    const device = deviceRef.current;
    if (!device || !phone) return;
    device
      .connect({ params: { To: phone, appointmentId: String(appointmentId ?? '') } })
      .then((c) => {
        setActive(c);
        c.on('disconnect', () => setActive(null));
        c.on('error', () => { setActive(null); toast.error('Call error'); });
      })
      .catch(() => toast.error('Could not place call'));
  }, []);

  const answer = () => {
    if (!incoming) return;
    incoming.accept();
    incoming.on('disconnect', () => setActive(null));
    setActive(incoming);
    setIncoming(null);
  };
  const reject = () => { incoming?.reject(); setIncoming(null); };

  return (
    <CallContext.Provider value={enabled ? call : null}>
      {children}
      {enabled && (active || incoming) && (
        <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-background p-3 shadow-lg">
          {incoming && !active && (
            <div className="space-y-2">
              <div className="text-sm">Incoming call from {incoming.parameters?.From || 'unknown'}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={answer}>
                  <Phone className="mr-1 h-4 w-4" />Answer
                </Button>
                <Button size="sm" variant="destructive" onClick={reject}>Reject</Button>
              </div>
            </div>
          )}
          {active && (
            <div className="flex items-center justify-between">
              <span className="text-sm">On call…</span>
              <Button size="sm" variant="destructive" onClick={() => active.disconnect()}>
                <PhoneOff className="mr-1 h-4 w-4" />End
              </Button>
            </div>
          )}
        </div>
      )}
    </CallContext.Provider>
  );
}
