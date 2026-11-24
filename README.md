# SDA COLLECTIONS — FASHION · BEAUTY · STYLE

> **Shop Smart... Be Stylish... Your Style... Our Priority...**  
> Full-stack luxury Indian jewellery, pure silk sarees, and designer ethnic fashion storefront with Firebase Authentication, Cloud Firestore, Express API security layer, unified 28-section Admin Operations Portal, and Resend transactional email integration.

---

## 1. Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion (`motion/react`).
- **Backend Server**: Express (`server.ts`) running Vite middleware in development (`tsx server.ts`) and serving compiled static assets + `/api/*` endpoints in production (`NODE_ENV=production node server.ts` on Node.js v22+).
- **Authentication**: Firebase Authentication (Email/Password + Email Verification, Google Sign-In, Password Reset).
- **Database & Rules**: Cloud Firestore Enterprise Edition (`ai-studio-sdacollections-2e391d86-a56f-41b3-b6a1-08c692c08a72` in Firebase project `smart-bebop-zxq1s`) hardened via `firestore.rules` and schema blueprint `firebase-blueprint.json`.
- **Storage**: Firebase Storage (`smart-bebop-zxq1s.firebasestorage.app`) for admin banner/product image uploads (optional URL fallback supported if Storage rules/tier are unconfigured).
- **Transactional Email**: Official `resend` Node.js SDK (`server/resendEmailService.ts`) with server-side `RESEND_API_KEY` + `RESEND_FROM_EMAIL`, idempotency protection, HTML/URL escaping, honest `sent_to_provider` vs confirmed `delivered` tracking, and Firestore `emailLogs`.
- **Payments Mode**: **Demonstration / Simulated Only** (`upi`, `card`, `netbanking`, `wallet`, `cod`). No real card numbers, CVVs, UPI PINs, banking credentials, or real payment gateways are connected.

---

## 2. Project Structure

```text
├── server.ts                         # Express backend + Vite dev middleware / prod static host
├── server/
│   └── resendEmailService.ts         # Official Resend SDK service, 9 templates, idempotency & status checks
├── src/
│   ├── App.tsx                       # Storefront router, lazy-loaded AdminDashboard, state & modals
│   ├── firebase.ts                   # Firebase SDK init (Auth, Firestore DB ID, Storage, testConnection)
│   ├── context/AuthContext.tsx       # Auth lifecycle, staff RBAC lookup, welcome & verification emails
│   ├── data/mockData.ts              # Initial luxury catalog, metal rates & category metadata
│   ├── hooks/useCartAndWishlist.ts   # Cart & wishlist persistence (local + Firestore sync)
│   ├── services/
│   │   ├── storeConfigService.ts     # Store settings, catalogue, variants, coupons, checkout, staff RBAC
│   │   ├── shippingReturnsService.ts # Orders, shipments, tracking events, returns, refunds, audit logs
│   │   ├── analyticsReportsService.ts# Revenue accounting, 14 CSV reports + formula-injection defense
│   │   └── emailClientService.ts     # Authenticated client wrapper for /api/emails/* & emailLogs
│   ├── types/shippingReturns.ts      # Shared domain TypeScript interfaces & transition rules
│   ├── components/                   # Storefront, Checkout, Account, Invoice, Tracker & Admin UI panels
│   └── tests/                        # Vitest suites (milestone8, shippingReturns, resendEmail)
├── firebase-applet-config.json       # Public Firebase web client configuration (no private secrets)
├── firebase-blueprint.json           # Canonical entity schemas & collection catalog
├── firestore.rules                   # Hardened Firestore Security Rules (ESLint-verified)
├── firestore.indexes.json            # Firestore index definitions (single-field auto-indexed queries)
├── security_spec.md                  # Security & RBAC test specification
├── walkthrough.md                    # Security review summary & verification trace
├── .env.example                      # Environment variable template (never commit real .env)
└── package.json                      # Scripts: dev, build, start, lint, test
```

---

## 3. Environment Configuration (Dev / Test / Production)

Never commit `.env`, `.env.local`, service-account JSONs, or API keys to GitHub. Client-side code never accesses `RESEND_API_KEY` or `RESEND_FROM_EMAIL`.

### Environment Matrix
| Environment | Frontend Serving | Backend Execution | Resend Mode | Firebase Project |
|---|---|---|---|---|
| **Development** | Vite middleware (`tsx server.ts`) | Express on `PORT=3000` | `onboarding@resend.dev` test sender or `skipped_unconfigured` if unset | `smart-bebop-zxq1s` |
| **Testing** | Vitest unit & Express integration (`NODE_ENV=test`) | Mocked `ResendClientLike` + Express ephemeral port | Deterministic mocks; zero live emails dispatched | Tested offline / deterministic |
| **Deployment** | Compiled static bundle in `dist/` (`npm run build`) | `NODE_ENV=production node server.ts` | Newly rotated `RESEND_API_KEY` + verified sender domain in AI Studio Secrets | `smart-bebop-zxq1s` |

### Variables (`.env.example`)
- `GEMINI_API_KEY`: Server-side AI Studio runtime secret (if AI features are invoked).
- `APP_URL`: Public application deployment URL.
- `RESEND_API_KEY`: Newly rotated Resend server-side API key (`re_...`). **Never** use any previously exposed key and **never** prefix with `VITE_`.
- `RESEND_FROM_EMAIL`: Sender identity (e.g., `SDA Collections <onboarding@resend.dev>` for sandbox testing, or `SDA Collections <orders@yourdomain.com>` after DNS verification).
- `SMS_PROVIDER_API_KEY`: Optional external SMS key; leave empty to operate in-app notifications cleanly.

---

## 4. Local Setup & Verification Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure local environment variables (optional for Resend live testing)
cp .env.example .env

# 3. Start development server (Express + Vite on http://localhost:3000)
npm run dev

# 4. Run full verification suite
npm test                # Vitest unit + Express API security/pricing/Resend tests
npm run lint            # TypeScript check (tsc --noEmit)
npx eslint firestore.rules
npm run build           # Production Vite bundle -> dist/
NODE_ENV=production npm start
```

---

## 5. Firebase Configuration & Free-Tier Limits

- **Project ID**: `smart-bebop-zxq1s`
- **Firestore Database ID**: `ai-studio-sdacollections-2e391d86-a56f-41b3-b6a1-08c692c08a72`
- **Authentication**: Email/Password & Google Login (`signInWithPopup` compatible with AI Studio preview & deployed URLs). Remember to add your final deployed domain (and any custom domain) under **Firebase Console -> Authentication -> Settings -> Authorized domains**.
- **Firestore Edition & Spark Free-Tier Notes**:
  - Provisioned on **Firestore Enterprise Edition** free tier via AI Studio.
  - All storefront and admin queries use single-field equality or single-field sort (`where('userId', '==', uid)` or `orderBy('createdAt', 'desc')`), requiring **zero custom composite indexes** (`firestore.indexes.json`).
  - Free daily read/write/delete quotas apply under the Spark free tier (`Quota exceeded` resets daily). Do **not** upgrade to **Blaze (Pay-as-you-go)** without explicit budget approval.
  - **Firebase Storage**: Configured (`smart-bebop-zxq1s.firebasestorage.app`), though Storage bucket provisioning/rules under external Firebase plans may require Blaze depending on project creation date. If Storage upload fails on Spark, admins can paste verified HTTPS image URLs directly in Product/Banner editors.
  - **Firebase Admin SDK**: `server.ts` uses `firebase-admin/auth`'s `verifyIdToken(token)` which requires **zero IAM permissions** and works on Google-hosted Starter Tier without a billing account. Server-side Firestore Admin SDK mutations are intentionally avoided so Starter Tier stays 100% compatible.

---

## 6. Resend Email Configuration & Domain Setup

1. Rotate/generate a fresh API key in the **Resend Dashboard** and store it in **AI Studio -> Settings -> Secrets** (or host environment) as `RESEND_API_KEY`.
2. Set `RESEND_FROM_EMAIL`:
   - **Sandbox testing**: `SDA Collections <onboarding@resend.dev>` (note: Resend restricts sandbox sender recipients to your verified Resend account email only).
   - **Production domain**: Verify your domain in Resend and set e.g. `SDA Collections <orders@sdacollections.com>`.
3. **Resend Free Tier Limits**:
   - Up to **3,000 emails / month** and **100 emails / day** on Resend's free tier, 1 custom domain.
4. **Honest Delivery Status**:
   - Accepting an email via `resend.emails.send()` records `sent_to_provider` in `emailLogs`.
   - True recipient delivery (`delivered`), `bounced`, `complained`, or `delivery_delayed` is updated only when Resend's `emails.get(id)` API confirms `last_event` (via **Check Status** in Admin -> Notifications).

---

## 7. Admin Access Setup

- Primary bootstrapped Super Admin email configured in `firestore.rules` & `AuthContext.tsx`: `vsmart996@gmail.com` (must sign in with verified email).
- Additional staff accounts (`super_admin`, `order_manager`, `customer_support`, `delivery_manager`, `inventory_manager`, `product_manager`) are managed inside **Admin Portal -> Staff Management** (backed by Firestore `admins/{uid}`).
- Last-active `super_admin` protection prevents accidental self-demotion, deactivation, or revocation.

---

## 8. Deployment Procedure (Cost-Protected)

1. **Preferred Route — Google AI Studio Publish (Starter Tier / Free Shared Hosting)**:
   - Verify `npm test`, `npm run lint`, and `npm run build` succeed cleanly.
   - Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in AI Studio **Secrets** (do not hardcode).
   - Use **Publish / Share** in Google AI Studio. Confirm whether the Starter Tier hosts the app at `₹0` without attaching a Google Cloud Billing Account.
   - **Do NOT** attach a Cloud Billing account, upgrade Firebase to Blaze, or deploy paid Cloud Run autoscaling instances without explicit user budget approval.
2. **Domain & HTTPS Setup (Future Custom Domain)**:
   - Keep the free AI Studio deployment URL for initial demo (`₹0`).
   - When ready for a custom domain (e.g., `shop.yourdomain.com`):
     1. Map the custom domain in your hosting/Cloud Run domain mapping panel (managed Google TLS/HTTPS certificate provisions automatically).
     2. Add DNS records at your registrar (`A`/`AAAA` for apex `@` or `CNAME` for `www` pointing to the host target).
     3. Add the custom domain to **Firebase Console -> Authentication -> Settings -> Authorized domains**.
     4. In **Resend -> Domains**, add your domain and publish the requested **SPF (`TXT`)**, **DKIM (`TXT`)**, and **Return-Path (`MX`)** DNS records, wait for Verified status, and update `RESEND_FROM_EMAIL`.

---

## 9. GitHub Source-Code Backup

Before pushing to a private GitHub repository:
1. Verify `.env*` (except `.env.example`), `node_modules/`, `dist/`, `*service-account*.json`, and `*.key`/`*.pem` remain excluded in `.gitignore`.
2. Scan staged files for accidental credentials before every commit.
3. Run:
   ```bash
   git init
   git add .
   git status            # Confirm no .env, dist/, or key files appear
   git commit -m "Milestone 9: SDA Collections production handover"
   git branch -M main
   git remote add origin <YOUR_PRIVATE_GITHUB_REPO_URL>
   git push -u origin main
   ```

---

## 10. Troubleshooting & Known Limitations

- **Payments & Refunds are Simulated**: Before accepting real customer money, integrate an RBI/PCI-DSS compliant payment gateway (e.g., Razorpay/Cashfree) with server-side webhook signature verification (`HMAC-SHA256`), server-authoritative order creation, and a GSTIN-verified tax entity.
- **`skipped_unconfigured` Email Status**: Appears whenever `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing from server secrets; Firestore logs and in-app notifications still record cleanly without crashing checkout.
- **Playwright / Live Browser E2E**: Browser-level automation tests against the live deployed URL require running against the published host with real test user credentials; see Milestone 9 Final Report for the exact distinction between tested and manual/post-publish checks.
