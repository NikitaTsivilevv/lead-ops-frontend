import React from 'react';
import { confirmationPlan, STAGE_HUMAN_LABEL, positionalLabel } from '@/lib/confirmationPlan';

const STATUS_CLASS = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-orange-100 text-orange-800 border-orange-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  reschedule: 'bg-blue-100 text-blue-800 border-blue-200',
};

/**
 * Renders per-stage confirmation badges for a single appointment card.
 *
 * Props:
 *   confirmations   - array of confirmation objects from the API
 *   appointmentAt   - ISO timestamp of the appointment (used to compute the
 *                     stage plan so night_before renders under "Final" for
 *                     early-morning meetings)
 */
export default function ConfirmationBadges({ confirmations, appointmentAt }) {
  const stages = confirmationPlan(appointmentAt);
  const byStage = Object.fromEntries((confirmations || []).map((c) => [c.stage, c]));

  return (
    <div className="flex gap-1.5 flex-wrap">
      {stages.map((s, i) => {
        const row = byStage[s];
        const status = row?.status || 'pending';
        const cls = STATUS_CLASS[status] || STATUS_CLASS.pending;
        const posLabel = positionalLabel(stages, i);
        const humanLabel = STAGE_HUMAN_LABEL[s] ?? s;
        return (
          <span
            key={s}
            title={`${humanLabel}: ${status}`}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
          >
            {posLabel}: {status}
          </span>
        );
      })}
    </div>
  );
}
