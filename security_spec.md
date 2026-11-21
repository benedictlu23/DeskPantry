# DeskPantry Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Privilege Isolation**: No signed-in coworker can self-assign `admin`, `super_admin`, `delivery_staff`, or `pautanganEnabled: true` on `users/{userId}` creation or update. Only the bootstrapped Super Admin (`benedictlu23@gmail.com`) or an Admin can modify RBAC roles or Pautangan flags.
2. **PII Isolation**: Private `users/{userId}` documents (email, debtBalance, pautanganLimit, pautanganEnabled) are strictly readable only by the document owner or Admin/SuperAdmin (`isOwner(userId) || isAdmin()`).
3. **Confidential Pautangan Protection**: `config/pautangan` and `loans/{loanId}` are never readable by Guests or coworkers with `pautanganEnabled == false`. Non-admin list queries on `loans` are strictly constrained by `resource.data.userId == request.auth.uid`.
4. **Order & Payment Proof Ownership**: Non-admin/non-delivery users can only create orders/proofs where `userId == request.auth.uid`, and payment proofs must always initialize with `status == 'pending'`.
5. **Path & Size Bounds**: Every document ID matches `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and every string and array field has explicit `.size()` bounds to prevent resource exhaustion.
6. **Verified Email Mandate**: All authenticated mutations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Privilege Escalation (User Create)**: Member creates `/users/{uid}` with `role: 'super_admin'`. Expected: `PERMISSION_DENIED`.
2. **Self-Grant Pautangan (User Update)**: Member updates `/users/{uid}` changing `pautanganEnabled: true` or `pautanganLimit: 50000`. Expected: `PERMISSION_DENIED`.
3. **PII Cross-Read**: Member A calls `get` on `/users/memberB` to read email/debtBalance. Expected: `PERMISSION_DENIED`.
4. **Confidential Pautangan Leak**: Restricted member calls `get` on `/config/pautangan`. Expected: `PERMISSION_DENIED`.
5. **Loan Scraping (List All Loans)**: Restricted member runs `list` on `/loans` without `where('userId', '==', uid)`. Expected: `PERMISSION_DENIED`.
6. **Spoofed Order Owner**: Member A creates `/orders/ord-999` with `userId: 'memberB'`. Expected: `PERMISSION_DENIED`.
7. **Auto-Approved Payment Proof**: Member A creates `/paymentProofs/prf-999` with `status: 'approved'`. Expected: `PERMISSION_DENIED`.
8. **Shadow Ghost Field Injection**: Member updates `/users/{uid}` with `extraAdminFlag: true`. Expected: `PERMISSION_DENIED`.
9. **Unverified Email Bypass**: User with `email_verified: false` (even with admin email string) attempts write. Expected: `PERMISSION_DENIED`.
10. **ID Poisoning**: Write to `/storeItems/invalid$id..` or 200-char ID. Expected: `PERMISSION_DENIED`.
11. **Value Poisoning**: Update `/storeItems/{id}` setting `stock: -50` or `price: "free"`. Expected: `PERMISSION_DENIED`.
12. **Chat Message Impersonation**: Member A posts `/chatThreads/thread-pantry/messages/m1` with `senderId: 'memberB'`. Expected: `PERMISSION_DENIED`.
