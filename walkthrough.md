# Security Summary

**Reviewed Files**: 22  
**Issues Resolved**: 1  

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Git Ignore Hardening | `.gitignore` | 9–14 | Service-account JSONs, private key files (`*.pem`, `*.key`, `*.p12`), and `.firebase/` cache were not explicitly excluded from future Git backups. | Medium | Fixed | Added explicit exclusions for `*service-account*.json`, `*firebase-adminsdk*.json`, `*.pem`, `*.key`, `*.p12`, and `.firebase/` while retaining `.env.example`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server/resendEmailService.ts`, `server.ts`, `.env.example` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `SMS_PROVIDER_API_KEY` are read strictly from server-side `process.env` and never bundled into `src/`, logged, or persisted to Firestore `emailLogs`. |
| Authentication & Token Verification | `server.ts`, `src/context/AuthContext.tsx` | Protected routes (`/api/auth/verify`, `/api/reports/authorize`, `/api/audit/prepare`, `/api/emails/send`, `/api/emails/status/:resendEmailId`, `/api/notifications/dispatch-external`) verify `Authorization: Bearer <Firebase ID Token>` via `firebase-admin/auth` `verifyIdToken()` and apply per-IP sliding-window rate limiters. |
| Firestore Ownership & RBAC | `firestore.rules` | Default deny-all fallback (`match /{document=**}`); customer collections (`users`, `addresses`, `carts`, `wishlists`, `orders`, `payments`, `invoices`, `stockReservations`, `notifications`, `returnRequests`, `refunds`, `emailLogs`) validate `request.auth.uid` ownership, `email_verified`, field-level schemas, state transitions, and immutable fields. Role changes and `admins/{uid}` writes are locked to verified `super_admin`. |
| XSS & HTML/URL Safety | `server/resendEmailService.ts`, `src/services/analyticsReportsService.ts` | Email template interpolation escapes HTML special characters (`escapeHtml`), rejects non-HTTP(S) tracking URLs (such as `javascript:`), and CSV exports neutralize formula prefixes (`=`, `+`, `-`, `@`) via `sanitizeCsvCell`. |
| Pricing & Stock Integrity | `server.ts`, `src/services/storeConfigService.ts`, `firestore.rules` | Server endpoint `/api/checkout/quote` validates positive integer quantities, bounds prices/discounts, enforces coupon active/expiry/minimums, and matches client quote math. Firestore rules enforce `stock >= 0` and atomic checkout updates. |
| Payment Simulation Boundary | `src/components/Pages.tsx`, `firestore.rules` | Demo online payment options never collect real card numbers, CVVs, UPI PINs, or banking passwords, and refunds enforce `isSimulated == true` and `refundAmount <= eligiblePaidAmount`. |
| Dependency Audit | `bun.lock`, `package.json` | Ran `bun audit`: 0 vulnerabilities in `resend`; 2 pre-existing transitive advisories in `@grpc/grpc-js` (`firebase` / `firebase-admin` dependency chain). |

## PoC Verification

### Unprotected Service Account / Key Exclusion in Git Backup

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Secret-File Exclusions in `.gitignore` |
| Impact | Medium |
| Affected File | `.gitignore:1-14` |
| Test Scenario | Placing a mock `*service-account*.json`, `*.key`, or `.env.production` file in the project directory before running source-code backup. |

#### How It Was Fixed
Added explicit wildcard exclusions to `.gitignore` for service-account credentials, Firebase Admin SDK JSONs, PEM/KEY/P12 private key files, and `.firebase/` deployment caches while keeping `.env.example`, `firestore.rules`, and `firestore.indexes.json` tracked.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Developer runs `git add .` before pushing backup to GitHub | Git evaluates `.gitignore` rules at repository root |
| 2 | `.gitignore` matches `.env*` (except `!.env.example`), `*service-account*.json`, `*firebase-adminsdk*.json`, `*.pem`, `*.key`, `*.p12`, `.firebase/` | Secret files and build artifacts (`dist/`, `node_modules/`) are excluded |
| 3 | Workspace scan confirms zero literal API keys (`re_*`, `sk-*`, `ghp_*`, private keys) inside project files | **Handled Safely** |

#### Conclusion
**Fix Verified** - Repository backup rules prevent accidental staging of local `.env` secrets, private keys, or Firebase service-account JSON credentials.
