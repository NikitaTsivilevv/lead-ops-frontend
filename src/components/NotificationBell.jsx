// src/components/NotificationBell.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiClient } from '@/api/apiClient';

const SOUND_KEY = 'leadops.notify.sound'; // 'on' | 'off'

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => (localStorage.getItem(SOUND_KEY) ?? 'on') === 'on');
  const lastSeenId = useRef(null);     // highest notification id we've already alerted on
  const initialized = useRef(false);   // skip toast/sound on the very first load

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications(),
    refetchInterval: 25000,
  });
  const { data: actionNeeded = [] } = useQuery({
    queryKey: ['action-needed'],
    queryFn: () => apiClient.getActionNeeded(),
    refetchInterval: 25000,
  });

  const notifications = notifData?.notifications ?? [];
  const unread = notifData?.unread_count ?? 0;
  const badge = unread + actionNeeded.length;

  async function onItemClick(n) {
    setOpen(false);
    if (!n.read_at) {
      await apiClient.markNotificationRead(n.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    navigate('/leads');
    setTimeout(() => {
      document.getElementById(`lead-row-${n.appointment_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  // Toast + sound when new notifications arrive between polls.
  useEffect(() => {
    if (!notifications.length) return;
    const maxId = Math.max(...notifications.map((n) => Number(n.id)));
    if (!initialized.current) {
      initialized.current = true;
      lastSeenId.current = maxId;
      return; // do not alert for the backlog present at first load
    }
    if (lastSeenId.current != null && maxId > lastSeenId.current) {
      const fresh = notifications.filter((n) => Number(n.id) > lastSeenId.current);
      const msg = fresh.length === 1 ? fresh[0].payload?.message : `${fresh.length} new notifications`;
      toast(msg, { onClick: () => onItemClick(fresh[0]) });
      if (soundOn) { try { new Audio('/notify.wav').play().catch(() => {}); } catch { /* ignore */ } }
      lastSeenId.current = maxId;
    }
  }, [notifications]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSound() {
    setSoundOn((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      return next;
    });
  }

  async function onMarkAllRead() {
    await apiClient.markAllNotificationsRead().catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={badge > 0 ? `${badge} notifications` : 'Notifications'}
          className={`relative inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
            badge > 0
              ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Bell className="w-4 h-4" />
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-0.5 text-[10px] font-bold leading-none text-white bg-amber-500 rounded-full">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleSound} aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
                    className="text-muted-foreground hover:text-foreground">
              {soundOn ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead} className="text-xs text-amber-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onItemClick(n)}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted ${n.read_at ? '' : 'bg-amber-50'}`}
              >
                <div className="text-sm">{n.payload?.message ?? n.type}</div>
                <div className="text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</div>
              </button>
            ))
          )}

          {actionNeeded.length > 0 && (
            <>
              <div className="px-3 py-2 border-b border-t bg-muted/50 text-xs font-medium text-muted-foreground">
                Action needed
              </div>
              {actionNeeded.map((a) => (
                <button
                  key={`an-${a.id}`}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/leads'); setTimeout(() => document.getElementById(`lead-row-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                  className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted"
                >
                  <div className="text-sm">{a.prospect_name || 'New appointment'}</div>
                  <div className="text-[11px] text-muted-foreground">{a.action_reason}</div>
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
