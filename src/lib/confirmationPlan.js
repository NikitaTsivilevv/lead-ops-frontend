/**
 * Returns the ordered list of confirmation stage keys for a given appointment.
 * Mirrors the backend logic in lead-ops-api (Phase 2 ordinal confirmations).
 *
 * Rules (America/New_York local time):
 *   - Meeting at/after 12:00  → ['day_before', 'morning_of', '2h_before']
 *   - Meeting before  12:00   → ['day_before', 'night_before']
 *
 * @param {string|null|undefined} appointmentAtISO - ISO timestamp of the appointment (UTC)
 * @param {string} tz - IANA timezone for "local hour" determination
 * @returns {string[]} ordered stage keys
 */
export function confirmationPlan(appointmentAtISO, tz = 'America/New_York') {
  if (!appointmentAtISO) return ['day_before', 'morning_of', '2h_before']; // safe fallback
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(appointmentAtISO));
  const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
  return hour >= 12
    ? ['day_before', 'morning_of', '2h_before']
    : ['day_before', 'night_before'];
}

/**
 * Human-readable label for each stage key.
 */
export const STAGE_HUMAN_LABEL = {
  day_before: 'Day before',
  morning_of: 'Morning of',
  '2h_before': '2h before',
  night_before: 'Night before',
};

/**
 * Positional label (1st / 2nd / Final) given a stage list and index.
 * The last stage is always "Final"; earlier stages are 1st, 2nd, …
 */
export function positionalLabel(stages, index) {
  if (index === stages.length - 1) return 'Final';
  const ordinals = ['1st', '2nd', '3rd', '4th'];
  return ordinals[index] ?? `#${index + 1}`;
}
