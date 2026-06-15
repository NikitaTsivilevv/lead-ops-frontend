import { createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SEAM (Phase 3.1): this is a MINIMAL STUB shipped by the SMS track so CommToggle
// can render its call button (disabled) and the app builds without the Voice track.
//
// The VOICE track (Alex) OWNS the real implementation of this file: a CallProvider
// that holds the Twilio Device and a `useCall()` that returns
//   (phone, appointmentId) => void   // place a browser call
// The Voice track's CallWidget provides the real value. Contract:
//   - useCall() returns { call, ready }.
//     call:  (phone, appointmentId) => void   (places a browser call; null for non-comms roles)
//     ready: boolean                          (Twilio Device registered + usable)
//   - CommToggle disables the call button while `ready` is false.
// ─────────────────────────────────────────────────────────────────────────────

// Safe default when no CallWidget is mounted (e.g. tests): calling not available.
const CallContext = createContext({ call: null, ready: false });

// Returns { call, ready }.
export function useCall() {
  return useContext(CallContext);
}

export default CallContext;
