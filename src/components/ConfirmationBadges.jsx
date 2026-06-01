import React from 'react';

const STAGE_LABEL = {
  day_before: '1st',
  morning_of: '2nd',
  '2h_before': 'Final',
};

const STAGE_ORDER = ['day_before', 'morning_of', '2h_before'];

const STATUS_CLASS = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-orange-100 text-orange-800 border-orange-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  reschedule: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function ConfirmationBadges({ confirmations }) {
  const byStage = Object.fromEntries((confirmations || []).map(c => [c.stage, c]));
  return (
    <div className="flex gap-1.5 flex-wrap">
      {STAGE_ORDER.map((s) => {
        const row = byStage[s];
        const status = row?.status || 'pending';
        const cls = STATUS_CLASS[status] || STATUS_CLASS.pending;
        return (
          <span key={s} title={status}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {STAGE_LABEL[s]}: {status}
          </span>
        );
      })}
    </div>
  );
}
