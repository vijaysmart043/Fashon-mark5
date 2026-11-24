# SDA Collections — Milestone 7 Security Specification

## 1. Data Invariants
1. **Order Ownership**: Every order belongs to a verified `userId`. Only the owning customer or authorized store staff (`isStaff()`) may read or list an order.
2. **Shipment Integrity**: A `shipment` cannot exist without a valid parent `orderId` (`exists(/databases/$(database)/documents/orders/$(incoming().orderId))`) and must carry the matching `userId`. Only staff may create or update shipments or append to `/shipments/{shipmentId}/events/{eventId}`.
3. **Return Eligibility & Ownership**: Only the owning customer (with verified email when email-authenticated) may submit a `returnRequest` for their own `orderId`, and `orderId` must exist (`exists(...)`) and belong to `request.auth.uid`. Customers cannot self-approve, inspect, or mark their return as `Refunded`.
4. **Simulated Refund Cap & Non-Duplication**: Only staff (`isStaff()`) may create or update `refunds`, and `refundAmount` must satisfy `0 <= refundAmount <= eligiblePaidAmount`.
5. **PII & Role Protection**: `users/{userId}`, `addresses/{addressId}`, `orders/{orderId}`, `returnRequests/{returnId}`, and `refunds/{refundId}` are strictly restricted to owner or staff. Users cannot escalate their `role` on `users/{userId}`, nor write to `admins/{adminId}` or `auditLogs/{logId}` unless they hold staff/admin privileges.
6. **Immutable Audit Trail**: `auditLogs/{logId}` entries cannot be updated or deleted once created.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Order Create**: `{ "userId": "victim_uid", "orderNumber": "SDA-111", "total": 100 }` by `attacker_uid` -> **PERMISSION_DENIED**.
2. **Ghost Field / Shadow Update on User Profile**: `{ "role": "super_admin", "updatedAt": "<serverTime>" }` on `/users/customer_uid` -> **PERMISSION_DENIED**.
3. **Unverified Admin Email Spoof**: Request with `request.auth.token.email == "vsmart996@gmail.com"` and `email_verified == false` reading `/refunds` -> **PERMISSION_DENIED**.
4. **Cross-Customer Shipment Read**: Customer B calling `get` or `list` on `/shipments/ship-customer-a` -> **PERMISSION_DENIED**.
5. **Customer Self-Approving Return Request**: Customer updating `/returnRequests/ret-1` setting `status: "Approved"` -> **PERMISSION_DENIED**.
6. **Orphan Shipment Creation**: Creating `/shipments/ship-999` referencing non-existent `orderId: "non-existent"` -> **PERMISSION_DENIED**.
7. **ID Poisoning**: Creating `/returnRequests/invalid id with spaces and 200 chars...` -> **PERMISSION_DENIED**.
8. **Refund Exceeding Eligible Paid Amount**: Staff or user attempting to write `/refunds/ref-1` with `refundAmount: 999999` when `eligiblePaidAmount: 32000` -> **PERMISSION_DENIED**.
9. **Client Timestamp Forgery**: Creating `/returnRequests/ret-2` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **PERMISSION_DENIED**.
10. **PII Blanket Read on Addresses**: Customer B reading `/addresses/addr-customer-a` -> **PERMISSION_DENIED**.
11. **Audit Log Tampering**: Updating or deleting `/auditLogs/log-1` -> **PERMISSION_DENIED**.
12. **Blanket List Query Scraping**: Customer calling `list` on `/orders` without `userId == request.auth.uid` filter -> **PERMISSION_DENIED**.
