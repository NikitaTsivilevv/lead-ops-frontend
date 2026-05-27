// Intentionally a no-op stub.
//
// This app does not use the Base44 SDK. Authentication, data, and all backend
// access go through src/api/apiClient.js, which talks to our own backend at
// https://lead-ops-api-h67zx.ondigitalocean.app.
//
// The Base44 SDK's auth surface (`base44.auth.me/login/logout/redirectToLogin`)
// triggers the Base44 platform login overlay on lead-ops-dash.base44.app, which
// is the exact UX we are bypassing. To prevent any future regression where
// someone re-introduces `import { base44 } from '@/api/base44Client'` and
// calls `base44.auth.X`, this module exports a fully inert object: every
// method is a no-op that returns a resolved promise.
//
// Do not import @base44/sdk in this app. Do not call createClient.

const noop = () => {};
const asyncNoop = async () => undefined;

export const base44 = {
  auth: {
    me: asyncNoop,
    login: asyncNoop,
    logout: asyncNoop,
    redirectToLogin: noop,
  },
  entities: new Proxy({}, {
    get: () => new Proxy({}, { get: () => asyncNoop }),
  }),
  functions: new Proxy({}, { get: () => asyncNoop }),
};

export default base44;