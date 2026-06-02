/**
 * Display name for an appointment/lead.
 *
 * For client viewers the backend redacts `prospect_name` to null until the meeting is
 * accepted (D-60). Rather than showing a blank "—" or "Untitled", fall back to a
 * friendly placeholder so the lists, the detail card, and the banner read consistently.
 *
 * Staff always have the real name (never redacted), so this returns it unchanged for them.
 */
export function leadDisplayName(appt) {
  return (appt && appt.prospect_name) || 'New appointment';
}
