/**
 * Test organiser accounts.
 *
 * Deliberately obvious placeholder credentials for a local/CI database only. The seed
 * and setup paths refuse to run against production (see global-setup).
 */
export const TEST_ACCOUNTS = {
  admin: {
    email: 'e2e-admin@example.test',
    password: 'e2e-only-password-123',
    name: 'E2E Admin',
    role: 'admin' as const,
  },
  organiser: {
    email: 'e2e-organiser@example.test',
    password: 'e2e-only-password-123',
    name: 'E2E Organiser',
    role: 'organiser' as const,
  },
  viewer: {
    email: 'e2e-viewer@example.test',
    password: 'e2e-only-password-123',
    name: 'E2E Viewer',
    role: 'viewer' as const,
  },
}
