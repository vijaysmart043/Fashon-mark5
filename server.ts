import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  checkResendDeliveryStatus,
  getResendConfig,
  sendTransactionalEmailWithResend,
  TRANSACTIONAL_EMAIL_TYPES,
  type TransactionalEmailRequest,
  type TransactionalEmailType,
} from './server/resendEmailService.ts';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const rawConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    if (rawConfig?.projectId) {
      projectId = String(rawConfig.projectId);
    }
  } catch (err) {
    console.error('Unable to parse firebase-applet-config.json:', err);
  }
}

if (getApps().length === 0) {
  initializeApp(projectId ? { projectId } : undefined);
}

const adminAuth = getAuth();

export interface VerifiedActor {
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider: string;
}

interface AuthenticatedRequest extends Request {
  verifiedActor?: VerifiedActor;
}

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

function createRateLimiter(windowMs: number, maxRequests: number, label: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${label}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length >= maxRequests) {
      res.status(429).json({
        error: `Too many requests to ${label}. Please wait briefly before retrying.`,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      });
      return;
    }
    bucket.timestamps.push(now);
    rateBuckets.set(key, bucket);
    next();
  };
}

async function requireFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer Firebase ID token.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Empty Firebase ID token.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const provider = decoded.firebase?.sign_in_provider || 'password';
    req.verifiedActor = {
      uid: decoded.uid,
      email: decoded.email || '',
      emailVerified: Boolean(decoded.email_verified),
      signInProvider: provider,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Invalid or expired Firebase ID token.',
      detail: err instanceof Error ? err.message : 'Token verification failed',
    });
  }
}

const SENSITIVE_KEY_PATTERN = /(password|passcode|token|secret|cvv|cardNumber|upiPin|apiKey|privateKey)/i;

export function sanitizeAuditSnapshot(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 400);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeAuditSnapshot(item, depth + 1));
  }
  if (typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = sanitizeAuditSnapshot(v, depth + 1);
      }
    }
    return clean;
  }
  return String(value).slice(0, 200);
}

export interface QuoteItemInput {
  productId: string;
  basePrice: number;
  discount: number;
  quantity: number;
  type?: 'jewellery' | 'saree' | 'dress' | 'fashion';
}

export interface QuoteRequestInput {
  items: QuoteItemInput[];
  couponDiscountPercent?: number;
  couponMinOrderAmount?: number;
  couponMaxDiscountAmount?: number;
  couponActive?: boolean;
  couponExpiresAt?: string;
  gstRatePercent?: number;
  jewelleryGstPercent?: number;
  sareeGstPercent?: number;
  freeShippingThreshold?: number;
  flatShippingFee?: number;
}

export function computeAuthoritativeQuote(input: QuoteRequestInput) {
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
    throw new Error('Order quote requires between 1 and 50 items.');
  }

  let subtotal = 0;
  let jewelleryTaxableBase = 0;
  let apparelTaxableBase = 0;
  let totalQuantity = 0;

  for (const item of input.items) {
    const qty = Number(item.quantity);
    const basePrice = Number(item.basePrice);
    const discount = Number(item.discount || 0);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 50) {
      throw new Error(`Invalid item quantity for ${item.productId || 'item'}.`);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0 || basePrice > 5000000) {
      throw new Error(`Invalid item price for ${item.productId || 'item'}.`);
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 95) {
      throw new Error(`Invalid product discount for ${item.productId || 'item'}.`);
    }

    const unitPrice = Math.round(basePrice * (1 - discount / 100));
    const lineSubtotal = unitPrice * qty;
    subtotal += lineSubtotal;
    totalQuantity += qty;

    if (item.type === 'jewellery') {
      jewelleryTaxableBase += lineSubtotal;
    } else {
      apparelTaxableBase += lineSubtotal;
    }
  }

  let discountAmount = 0;
  const pct = Number(input.couponDiscountPercent || 0);
  if (pct > 0) {
    if (input.couponActive === false) {
      throw new Error('Coupon is currently inactive.');
    }
    if (input.couponExpiresAt) {
      const exp = new Date(input.couponExpiresAt);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        throw new Error('Coupon has expired.');
      }
    }
    const minAmount = Number(input.couponMinOrderAmount || 0);
    if (subtotal < minAmount) {
      throw new Error(`Minimum order amount of INR ${minAmount} required for this coupon.`);
    }
    if (pct > 90) {
      throw new Error('Coupon discount cannot exceed 90%.');
    }
    discountAmount = Math.round((subtotal * pct) / 100);
    const maxCap = Number(input.couponMaxDiscountAmount || 0);
    if (maxCap > 0 && discountAmount > maxCap) {
      discountAmount = Math.round(maxCap);
    }
  }

  const threshold = Number.isFinite(Number(input.freeShippingThreshold))
    ? Number(input.freeShippingThreshold)
    : 2000;
  const flatFee = Number.isFinite(Number(input.flatShippingFee))
    ? Number(input.flatShippingFee)
    : 150;
  const shippingFee = subtotal === 0 || subtotal >= threshold ? 0 : Math.max(0, flatFee);

  const jewelleryGst = Number.isFinite(Number(input.jewelleryGstPercent))
    ? Number(input.jewelleryGstPercent)
    : Number.isFinite(Number(input.gstRatePercent))
      ? Number(input.gstRatePercent)
      : 3;
  const sareeGst = Number.isFinite(Number(input.sareeGstPercent))
    ? Number(input.sareeGstPercent)
    : Number.isFinite(Number(input.gstRatePercent))
      ? Number(input.gstRatePercent)
      : 5;

  const discountRatio = subtotal > 0 ? Math.max(0, (subtotal - discountAmount) / subtotal) : 1;
  const gstAmount = Math.round(
    jewelleryTaxableBase * discountRatio * (jewelleryGst / 100) +
      apparelTaxableBase * discountRatio * (sareeGst / 100)
  );

  const total = Math.max(0, subtotal - discountAmount + shippingFee + gstAmount);

  return {
    valid: true,
    totalQuantity,
    subtotal,
    discountAmount,
    shippingFee,
    gstAmount,
    total,
  };
}

export function createApiApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'sda-collections-api',
      projectId: projectId || null,
      timestamp: new Date().toISOString(),
    });
  });

  app.post(
    '/api/auth/verify',
    createRateLimiter(60_000, 40, 'auth-verify'),
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        valid: true,
        actor: req.verifiedActor,
        verifiedAt: new Date().toISOString(),
      });
    }
  );

  app.post(
    '/api/checkout/quote',
    createRateLimiter(60_000, 60, 'checkout-quote'),
    (req: Request, res: Response) => {
      try {
        const quote = computeAuthoritativeQuote(req.body as QuoteRequestInput);
        res.json(quote);
      } catch (err) {
        res.status(400).json({
          valid: false,
          error: err instanceof Error ? err.message : 'Unable to compute quote.',
        });
      }
    }
  );

  app.post(
    '/api/reports/authorize',
    createRateLimiter(60_000, 20, 'report-export'),
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const actor = req.verifiedActor!;
      if (!actor.emailVerified && actor.signInProvider !== 'phone') {
        res.status(403).json({ error: 'Verified account required to export business reports.' });
        return;
      }
      const reportType = String(req.body?.reportType || '').slice(0, 64);
      if (!reportType) {
        res.status(400).json({ error: 'Missing reportType parameter.' });
        return;
      }
      res.json({
        authorized: true,
        correlationId: `EXP-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        actorUid: actor.uid,
        authorizedAt: new Date().toISOString(),
      });
    }
  );

  app.post(
    '/api/audit/prepare',
    createRateLimiter(60_000, 100, 'audit-prepare'),
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const actor = req.verifiedActor!;
      const correlationId =
        typeof req.body?.correlationId === 'string' && req.body.correlationId.trim()
          ? req.body.correlationId.trim().slice(0, 64)
          : `COR-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

      res.json({
        correlationId,
        actorUid: actor.uid,
        serverTimestampIso: new Date().toISOString(),
        beforeValues: sanitizeAuditSnapshot(req.body?.beforeValues ?? null),
        afterValues: sanitizeAuditSnapshot(req.body?.afterValues ?? null),
      });
    }
  );

  app.get('/api/notifications/providers', (_req: Request, res: Response) => {
    const resendCfg = getResendConfig();
    const smsConfigured = Boolean(process.env.SMS_PROVIDER_API_KEY);
    res.json({
      emailConfigured: resendCfg.configured,
      resendConfigured: resendCfg.configured,
      resendFromConfigured: resendCfg.fromConfigured,
      smsConfigured,
      mode: resendCfg.configured || smsConfigured ? 'resend_enabled' : 'in_app_only',
      note: resendCfg.configured
        ? 'Resend transactional email SDK is configured server-side (RESEND_API_KEY & RESEND_FROM_EMAIL set).'
        : 'RESEND_API_KEY or RESEND_FROM_EMAIL is not configured in server environment. Email attempts record honest skipped_unconfigured status while in-app notifications remain active.',
    });
  });

  app.post(
    '/api/emails/send',
    createRateLimiter(60_000, 40, 'email-send'),
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as Partial<TransactionalEmailRequest>;
      const templateType = String(body.templateType || '') as TransactionalEmailType;
      if (!TRANSACTIONAL_EMAIL_TYPES.includes(templateType)) {
        res.status(400).json({ error: 'Invalid transactional email templateType.' });
        return;
      }

      const recipientEmail = String(body.recipientEmail || req.verifiedActor?.email || '').trim();
      const result = await sendTransactionalEmailWithResend({
        ...body,
        templateType,
        recipientEmail,
      });

      res.status(result.status === 'failed' && result.errorCode === 'INVALID_EMAIL' ? 400 : 200).json(result);
    }
  );

  app.post(
    '/api/emails/password-reset-notice',
    createRateLimiter(60_000, 8, 'password-reset-notice'),
    async (req: Request, res: Response) => {
      const recipientEmail = String(req.body?.email || '').trim();
      const bucketKey = `pw-reset:${recipientEmail.toLowerCase()}:${new Date().toISOString().slice(0, 13)}`;
      const result = await sendTransactionalEmailWithResend({
        templateType: 'password_reset',
        recipientEmail,
        idempotencyKey: bucketKey,
      });
      res.status(result.errorCode === 'INVALID_EMAIL' ? 400 : 200).json(result);
    }
  );

  app.get(
    '/api/emails/status/:resendEmailId',
    createRateLimiter(60_000, 30, 'email-status'),
    requireFirebaseAuth,
    async (req: Request, res: Response) => {
      const resendEmailId = String(req.params.resendEmailId || '').trim();
      const result = await checkResendDeliveryStatus(resendEmailId);
      res.status(result.ok ? 200 : result.status === 'skipped_unconfigured' ? 503 : 400).json(result);
    }
  );

  app.post(
    '/api/notifications/dispatch-external',
    createRateLimiter(60_000, 15, 'external-notify'),
    requireFirebaseAuth,
    async (req: Request, res: Response) => {
      const channel = String(req.body?.channel || 'email');
      const resendCfg = getResendConfig();
      const smsConfigured = Boolean(process.env.SMS_PROVIDER_API_KEY);

      if (channel === 'email') {
        if (!resendCfg.configured) {
          res.status(501).json({
            delivered: false,
            channel,
            reason: 'RESEND_API_KEY or RESEND_FROM_EMAIL is not configured in server environment.',
          });
          return;
        }
        const recipientEmail = String(req.body?.recipientEmail || '').trim();
        const emailResult = await sendTransactionalEmailWithResend({
          templateType: 'order_confirmation',
          recipientEmail,
          notes: String(req.body?.message || ''),
          idempotencyKey: String(req.body?.idempotencyKey || `ext-${Date.now()}`),
        });
        res.status(emailResult.ok ? 200 : 502).json(emailResult);
        return;
      }

      if (channel === 'sms' && !smsConfigured) {
        res.status(501).json({
          delivered: false,
          channel,
          reason: 'No SMS_PROVIDER_API_KEY configured in server environment. In-app notification should be used instead.',
        });
        return;
      }

      res.json({
        delivered: false,
        channel,
        reason: 'External SMS SDK transport handler is not connected.',
      });
    }
  );

  return app;
}

async function startServer() {
  const app = createApiApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`SDA Collections server listening on http://0.0.0.0:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  void startServer();
}
