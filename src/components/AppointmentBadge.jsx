import React from 'react';

export function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className || ''}`}>
      {children}
    </span>
  );
}

export const STATUS_COLORS = {
  confirmed: '#22c55e',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  completed: '#6366f1',
};

export const QUAL_BADGE = {
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-800',
};

export const OUTCOME_BADGE = {
  sold: 'bg-green-100 text-green-800',
  not_sold: 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-700',
  reschedule_needed: 'bg-orange-100 text-orange-800',
};

export const SHOW_STATUS_BADGE = {
  show: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-700',
};

export const SALE_STATUS_BADGE = {
  sold: 'bg-green-100 text-green-800',
  not_sold: 'bg-red-100 text-red-800',
};

export function clientDecisionColor(val) {
  if (val === true || val === 'accepted' || val === 'auto_accepted') return 'bg-green-100 text-green-800';
  if (val === false || val === 'rejected') return 'bg-red-100 text-red-800';
  if (val === 'auto-accepted') return 'bg-blue-100 text-blue-800';
  if (val === 'request_reschedule' || val === 'pending_reapproval') return 'bg-orange-100 text-orange-800';
  return 'bg-muted text-muted-foreground';
}

export function clientDecisionLabel(val) {
  if (val === null || val === undefined) return 'Pending';
  if (val === true || val === 'accepted') return 'Accepted';
  if (val === false || val === 'rejected') return 'Rejected';
  if (val === 'auto_accepted' || val === 'auto-accepted') return 'Auto-accepted';
  if (val === 'request_reschedule') return 'Reschedule requested';
  if (val === 'pending_reapproval') return 'Pending re-approval';
  return String(val);
}
