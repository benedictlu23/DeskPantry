# DeskPantry Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Privilege Isolation**: No signed-in coworker can self-assign `admin`, `super_admin`, `delivery_staff`, `ownedStoreIds`, `assignedStoreIds`, or `cashAssistanceEnabled: true` on `users/{userId}` creation or update. Only the bootstrapped Super Admin (`benedictlu23@gmail.com`) or an Admin can modify RBAC roles, store assignments, or Cash Assistance flags.
2. **PII Isolation**: Private `users/{userId}` documents (email, debtBalance, storeDebtBalances, cashAssistanceLimit, cashAssistanceEnabled) are strictly readable only by the document owner or Admin/SuperAdmin (`isOwner(userId) || isAdmin()`).
3. **Confidential Cash Assistance Protection**:
   - `/config/cashAssistance` and `/loans/{loanId}` are never readable by Guests or non-authorized coworkers. Non-admin list queries on `loans` are strictly constrained by `resource.data.userId == request.auth.uid || resource.data.storeOwnerId == request.auth.uid`.
   - `/storeCashAssistance/{storeId}` (which stores `visibleToOwner` and `'locked'` add-on upsell state) is readable ONLY by Admin/SuperAdmin OR the specific `storeOwnerId` when `visibleToOwner == true || status in ['pending_approval', 'active', 'suspended']`. Non-store-owner coworkers can never read `/storeCashAssistance`.
4. **Per-Store Ownership & Isolation**:
   - Store Owners (`storeOwnerId == request.auth.uid`) can create/update/delete `storeItems`, log `stockAdjustments`, review `orders` and `paymentProofs`, and settle `storeCustomerCredits` ONLY for their own `storeId`. Cross-store writes by another Store Owner are denied.
   - Store Applications (`storeApplications/{applicationId}`) can only be created by the verified applicant with `status: 'pending'`, and approved/rejected solely by Admin/SuperAdmin.
5. **Order & Payment Proof Ownership**: Non-admin/non-delivery users can only create orders/proofs where `userId == request.auth.uid`, and payment proofs must always initialize with `status == 'pending'`.
6. **Path & Size Bounds**: Every document ID matches `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and every string and array field has explicit `.size()` bounds to prevent resource exhaustion.
7. **Verified Email Mandate**: All authenticated mutations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Privilege Escalation (User Create)**: Member creates `/users/{uid}` with `role: 'super_admin'`. Expected: `PERMISSION_DENIED`.
2. **Self-Grant Cash Assistance (User Update)**: Member updates `/users/{uid}` changing `cashAssistanceEnabled: true` or `cashAssistanceLimit: 50000`. Expected: `PERMISSION_DENIED`.
3. **PII Cross-Read**: Member A calls `get` on `/users/memberB` to read email/debtBalance. Expected: `PERMISSION_DENIED`.
4. **Confidential Cash Assistance Leak**: Regular coworker calls `get` on `/storeCashAssistance/store-roastery` (even when `visibleToOwner: false`). Expected: `PERMISSION_DENIED`.
5. **Loan Scraping (List All Loans)**: Restricted member runs unfiltered `list` on `/loans`. Expected: `PERMISSION_DENIED`.
6. **Cross-Store Item Mutation**: Store B owner tries to modify a `storeItems` document owned by Store A (`storeOwnerId: 'u-benedict'`). Expected: `PERMISSION_DENIED`.
7. **Auto-Approved Store Application / Payment Proof**: Member creates `/storeApplications/app-99` with `status: 'approved'` or `/paymentProofs/prf-999` with `status: 'approved'`. Expected: `PERMISSION_DENIED`.
8. **Shadow Ghost Field Injection**: Member updates `/users/{uid}` with `extraAdminFlag: true`. Expected: `PERMISSION_DENIED`.
9. **Unverified Email Bypass**: User with `email_verified: false` (even with admin email string) attempts write. Expected: `PERMISSION_DENIED`.
10. **ID Poisoning**: Write to `/storeItems/invalid$id..` or 200-char ID. Expected: `PERMISSION_DENIED`.
11. **Value Poisoning**: Update `/storeItems/{id}` setting `stock: -50` or `price: "free"`. Expected: `PERMISSION_DENIED`.
12. **Chat Message Impersonation**: Member A posts `/chatThreads/thread-pantry/messages/m1` with `senderId: 'memberB'`. Expected: `PERMISSION_DENIED`.
