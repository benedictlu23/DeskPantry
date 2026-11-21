/**
 * Phase 0 Payload-First Security Test Spec for DeskPantry Firestore Rules.
 * Verifies that all 12 Dirty Dozen adversarial payloads are rejected (PERMISSION_DENIED).
 */
export interface SecurityTestCase {
  name: string;
  actor: { uid: string; email: string; email_verified: boolean; role?: string; pautanganEnabled?: boolean };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    name: '1. Self-privilege escalation on user create',
    actor: { uid: 'u-attacker', email: 'attacker@gmail.com', email_verified: true },
    operation: 'create',
    path: '/users/u-attacker',
    payload: { id: 'u-attacker', name: 'Attacker', email: 'attacker@gmail.com', department: 'Ops', role: 'super_admin', debtBalance: 0, pautanganEnabled: false, pautanganLimit: 0, avatarInitials: 'AT', totalSpent: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Self-grant Pautangan access on user update',
    actor: { uid: 'u-member', email: 'member@gmail.com', email_verified: true, role: 'member', pautanganEnabled: false },
    operation: 'update',
    path: '/users/u-member',
    payload: { pautanganEnabled: true, pautanganLimit: 50000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-user PII read on /users/{otherId}',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'get',
    path: '/users/u-member-b',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Restricted user reading confidential /config/pautangan',
    actor: { uid: 'u-member', email: 'member@gmail.com', email_verified: true, role: 'member', pautanganEnabled: false },
    operation: 'get',
    path: '/config/pautangan',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Unfiltered list query on /loans',
    actor: { uid: 'u-member', email: 'member@gmail.com', email_verified: true, role: 'member', pautanganEnabled: false },
    operation: 'list',
    path: '/loans',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Spoofed userId on /orders create',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'create',
    path: '/orders/ORD-999',
    payload: { id: 'ORD-999', userId: 'u-member-b', userName: 'Other', items: [], totalAmount: 50, fulfillment: 'Pickup', paymentMethod: 'Cash', status: 'Confirmed', createdAt: 'Now', orderDateIso: '2026-11-20', source: 'store', logs: [] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Pre-approved status on /paymentProofs create',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'create',
    path: '/paymentProofs/PRF-999',
    payload: { id: 'PRF-999', userId: 'u-member-a', userName: 'A', amount: 500, channel: 'GCash', referenceNo: '123', purpose: 'Store Debt Settlement', imageDataUrl: 'data:image/png;base64,AAA', submittedAt: 'Now', status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Shadow ghost field on /users update',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'update',
    path: '/users/u-member-a',
    payload: { name: 'A', isVerifiedAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unverified email spoof of bootstrapped admin',
    actor: { uid: 'u-spoof', email: 'benedictlu23@gmail.com', email_verified: false },
    operation: 'update',
    path: '/config/store',
    payload: { deliveryFee: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Invalid document ID poisoning',
    actor: { uid: 'u-benedict', email: 'benedictlu23@gmail.com', email_verified: true, role: 'super_admin' },
    operation: 'create',
    path: '/storeItems/bad$id',
    payload: { id: 'bad$id' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Negative stock poisoning on /storeItems update',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'update',
    path: '/storeItems/item-1',
    payload: { stock: -10, soldCount: 99 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Chat message sender impersonation',
    actor: { uid: 'u-member-a', email: 'a@gmail.com', email_verified: true, role: 'member' },
    operation: 'create',
    path: '/chatThreads/thread-pantry/messages/m-evil',
    payload: { id: 'm-evil', senderId: 'u-benedict', senderName: 'Benedict', senderRole: 'super_admin', text: 'Fake admin alert', timestamp: 'Now' },
    expected: 'PERMISSION_DENIED',
  },
];
