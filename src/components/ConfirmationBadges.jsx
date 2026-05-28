import React from 'react';
import { Badge } from '@/components/ui/badge';

const STAGE_LABEL = {
  day_before: '1st',
  morning_of: '2nd',
  '2h_before': 'Final',
};

const STAGE_ORDER = ['day_before', 'morning_of', '2h_before'];

function variantFor(status) {
  if (status === 'confirmed') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'reschedule') return 'secondary';
  return 'outline';
}

export default function ConfirmationBadges({ confirmations }) {
  const byStage = Object.fromEntries((confirmations || []).map(c => [c.stage, c]));
  return (
    <div className="flex gap-1.5 flex-wrap">
      {STAGE_ORDER.map((s) => {
        const row = byStage[s];
        return (
          <Badge key={s} variant={variantFor(row?.status)} title={row?.status || 'pending'}>
            {STAGE_LABEL[s]}: {row?.status || 'pending'}
          </Badge>
        );
      })}
    </div>
  );
}
