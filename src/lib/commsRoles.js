// Roles permitted to use in-app communications (call/text). Mirrors the backend
// COMMS_ROLES set (src/services/commsVisibility.js). Excluded: caller, qa.
export const COMMS_ROLES = ['admin', 'operations', 'confirmation', 'call_center_admin', 'client'];

export function canUseComms(role) {
  return COMMS_ROLES.includes(role);
}
