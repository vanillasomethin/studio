// Shared fixture constants.
//
// Kept apart from seed.mjs so importing a credential does not re-run the seed:
// seed.mjs does its work at module scope, so anything importing it would reseed
// the database as a side effect of asking for an email address.

export const ADMIN_EMAIL = 'hello@wearealive.in';
// Test fixtures for a throwaway local database, not credentials to anything real.
export const ADMIN_PASSWORD = 'TestAdmin!2026';
export const ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
