import { createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SEAM (Phase 3.1): this is a MINIMAL STUB shipped by the SMS track so CommToggle
// can render its call button (disabled) and the app builds without the Voice track.
//
// The VOICE track (Alex) OWNS the real implementation of this file: a CallProvider
// that holds the Twilio Device and a `useCall()` that returns
//   (phone, appointmentId) => void   // place a browser call
// When the Voice track lands, it REPLACES this stub. Contract to keep stable:
//   - export `useCall()` returning either a `(phone, appointmentId) => void` fn or `null`.
//   - CommToggle treats `null` as "calling not available yet" (button disabled).
// ─────────────────────────────────────────────────────────────────────────────

const CallContext = createContext(null);

// Returns a `(phone, appointmentId) => void` fn when a CallProvider is mounted, else null.
export function useCall() {
  return useContext(CallContext);
}

export default CallContext;
