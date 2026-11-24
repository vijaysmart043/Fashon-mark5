import crypto from 'node:crypto';
import { Resend } from 'resend';

export const TRANSACTIONAL_EMAIL_TYPES = [
  'welcome',
  'email_verification',
  'password_reset',
  'order_confirmation',
  'payment_status',
  'invoice_notification',
  'shipment_update',
  'return_update',
  'refund_update',
] as const;

export type TransactionalEmailType = (typeof TRANSACTIONAL_EMAIL_TYPES)[number];

export type EmailDeliveryStatus =
  | 'queued'
  | 'sent_to_provider'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'skipped_unconfigured';

export interface TransactionalEmailRequest {
  templateType: TransactionalEmailType;
  recipientEmail: string;
  recipientName?: string;
  idempotencyKey?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  amount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shipmentStatus?: string;
  returnNumber?: string;
  returnStatus?: string;
  refundNumber?: string;
  refundStatus?: string;
  referenceId?: string;
  notes?: string;
}

export interface TransactionalEmailResult {
  ok: boolean;
  requestId: string;
  resendEmailId: string;
  idempotencyKey: string;
  templateType: TransactionalEmailType;
  recipientEmail: string;
  status: EmailDeliveryStatus;
  lastEvent: string;
  statusNote: string;
  deduped?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface EmailDeliveryStatusResult {
  ok: boolean;
  resendEmailId: string;
  status: EmailDeliveryStatus;
  lastEvent: string;
  statusNote: string;
  errorMessage?: string;
}

export interface ResendClientLike {
  emails: {
    send: (
      payload: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        text: string;
      },
      options?: { idempotencyKey?: string }
    ) => Promise<{ data: { id: string } | null; error: { name?: string; message?: string } | null }>;
    get: (
      id: string
    ) => Promise<{ data: { id: string; last_event?: string } | null; error: { name?: string; message?: string } | null }>;
  };
}

export function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 160;
}

export function getResendConfig() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || '').trim();
  return {
    apiKeyConfigured: Boolean(apiKey),
    fromConfigured: Boolean(fromEmail),
    configured: Boolean(apiKey && fromEmail),
    fromEmail,
  };
}

function defaultResendFactory(): ResendClientLike | null {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  return new Resend(apiKey) as unknown as ResendClientLike;
}

function formatCurrencyInr(amount?: number): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return '₹0';
  }
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function buildTransactionalEmailContent(req: TransactionalEmailRequest): {
  subject: string;
  html: string;
  text: string;
} {
  const customerName = escapeHtml(req.recipientName?.trim() || 'Valued Patron');
  const orderNumber = escapeHtml(req.orderNumber || '');
  const invoiceNumber = escapeHtml(req.invoiceNumber || (req.orderNumber ? `INV-${req.orderNumber}` : ''));
  const amountLabel = escapeHtml(formatCurrencyInr(req.amount));
  const paymentMethod = escapeHtml((req.paymentMethod || '').toUpperCase());
  const paymentStatus = escapeHtml(req.paymentStatus || '');
  const courierName = escapeHtml(req.courierName || 'Authorized Courier Partner');
  const trackingNumber = escapeHtml(req.trackingNumber || 'Pending assignment');
  const shipmentStatus = escapeHtml(req.shipmentStatus || 'Updated');
  const returnNumber = escapeHtml(req.returnNumber || '');
  const returnStatus = escapeHtml(req.returnStatus || '');
  const refundNumber = escapeHtml(req.refundNumber || '');
  const refundStatus = escapeHtml(req.refundStatus || '');
  const refId = escapeHtml(req.referenceId || '');
  const notes = escapeHtml(req.notes || '');

  const rawTrackingUrl = (req.trackingUrl || '').trim();
  const safeTrackingUrl =
    /^https?:\/\//i.test(rawTrackingUrl) ? escapeHtml(rawTrackingUrl) : '';

  let subject = 'SDA Collections Notification';
  let headline = 'SDA Collections Update';
  let bodyLines: string[] = [];

  switch (req.templateType) {
    case 'welcome':
      subject = 'Welcome to SDA Collections — Crafted Elegance';
      headline = `Welcome to SDA Collections, ${customerName}`;
      bodyLines = [
        'Thank you for registering with SDA Collections.',
        'Explore handcrafted 22K gold jewellery, pure Kanchipuram silk sarees, and curated bridal ensembles.',
        'Your customer account, wishlist, saved addresses, and order history are now ready.',
      ];
      break;

    case 'email_verification':
      subject = 'Verify Your Email Address — SDA Collections';
      headline = 'Email Verification Reminder';
      bodyLines = [
        `Hello ${customerName}, a Firebase email verification link has been dispatched to verify your account email.`,
        'Please open the official Firebase verification email in your inbox to activate full checkout and order tracking access.',
        'If you did not create an account on SDA Collections, you can safely ignore this notice.',
      ];
      break;

    case 'password_reset':
      subject = 'Password Reset Requested — SDA Collections';
      headline = 'Security Notice: Password Reset Initiated';
      bodyLines = [
        'A password reset request was initiated for your SDA Collections account via Firebase Authentication.',
        'Use the official Firebase password reset link sent to your email address to choose a new password.',
        'If you did not request this reset, please review your account security immediately.',
      ];
      break;

    case 'order_confirmation':
      subject = `Order Confirmed (${req.orderNumber || 'SDA'}) — SDA Collections`;
      headline = `Order ${orderNumber} Confirmed`;
      bodyLines = [
        `Thank you, ${customerName}. Your order ${orderNumber} has been recorded.`,
        `Payable Total: ${amountLabel} | Payment Mode: ${paymentMethod || 'N/A'} (${paymentStatus || 'Recorded'})`,
        notes || 'Our atelier team is preparing and packing your pieces.',
      ];
      break;

    case 'payment_status':
      subject = `Payment ${req.paymentStatus || 'Update'} for Order ${req.orderNumber || ''} — SDA Collections`;
      headline = `Payment ${paymentStatus || 'Update'} (${orderNumber})`;
      bodyLines = [
        `Hello ${customerName}, here is the payment status record for order ${orderNumber}.`,
        `Method: ${paymentMethod || 'Demo'} | Amount: ${amountLabel} | Status: ${paymentStatus || 'Recorded'}`,
        refId ? `Reference ID: ${refId}` : '',
        notes || 'Note: Online demo checkout methods use simulated payment processing.',
      ].filter(Boolean);
      break;

    case 'invoice_notification':
      subject = `Tax Invoice ${req.invoiceNumber || ''} Issued — SDA Collections`;
      headline = `Invoice ${invoiceNumber} Ready`;
      bodyLines = [
        `Hello ${customerName}, the tax invoice ${invoiceNumber} for order ${orderNumber} has been generated.`,
        `Invoice Grand Total: ${amountLabel}`,
        'You can view or print your GST invoice anytime inside your SDA Collections Account under Order History.',
      ];
      break;

    case 'shipment_update':
      subject = `Shipment Update (${req.shipmentStatus || 'Updated'}) — Order ${req.orderNumber || ''}`;
      headline = `Shipment Update: ${shipmentStatus}`;
      bodyLines = [
        `Order ${orderNumber} shipment status is now "${shipmentStatus}".`,
        `Courier Partner: ${courierName} | Tracking Number: ${trackingNumber}`,
        safeTrackingUrl ? `Tracking Link: ${safeTrackingUrl}` : '',
        notes ? `Dispatch Note: ${notes}` : '',
      ].filter(Boolean);
      break;

    case 'return_update':
      subject = `Return Request ${req.returnNumber || ''} (${req.returnStatus || 'Updated'}) — SDA Collections`;
      headline = `Return ${returnNumber}: ${returnStatus}`;
      bodyLines = [
        `Hello ${customerName}, your return request ${returnNumber} for order ${orderNumber} has moved to "${returnStatus}".`,
        notes ? `Review / Inspection Note: ${notes}` : '',
      ].filter(Boolean);
      break;

    case 'refund_update':
      subject = `Simulated Refund ${req.refundNumber || ''} (${req.refundStatus || 'Updated'}) — SDA Collections`;
      headline = `Refund ${refundNumber}: ${refundStatus}`;
      bodyLines = [
        `Hello ${customerName}, simulated refund ${refundNumber} for order ${orderNumber} (${amountLabel}) is currently "${refundStatus}".`,
        refId ? `Simulated Reference ID: ${refId}` : '',
        notes || 'All refunds processed in this demonstration store are simulated records.',
      ].filter(Boolean);
      break;
  }

  const htmlParagraphs = bodyLines
    .map((line) => `<p style="margin:0 0 12px;color:#333;font-size:14px;line-height:1.6;">${line}</p>`)
    .join('');

  const html = `
  <div style="font-family:Georgia,serif;background:#F8F1E4;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #D4AF62;border-radius:12px;overflow:hidden;">
      <div style="background:#120D0B;padding:24px 28px;border-bottom:2px solid #D4AF62;">
        <div style="color:#D4AF62;font-size:20px;font-weight:bold;letter-spacing:2px;">SDA COLLECTIONS</div>
        <div style="color:#F8F1E4;font-size:11px;letter-spacing:3px;opacity:0.75;margin-top:4px;">SHOP SMART · BE STYLISH</div>
      </div>
      <div style="padding:28px;font-family:Arial,sans-serif;">
        <h2 style="margin:0 0 16px;color:#120D0B;font-size:18px;">${headline}</h2>
        ${htmlParagraphs}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="margin:0;color:#777;font-size:11px;line-height:1.5;">
          SDA Collections · Banjara Hills Road No. 12, Hyderabad, Telangana 500034<br/>
          This is an automated transactional notification from SDA Collections.
        </p>
      </div>
    </div>
  </div>`.trim();

  const text = `${headline}\n\n${bodyLines
    .map((l) => l.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
    .join('\n')}\n\n— SDA Collections`;

  return { subject, html, text };
}

export function mapResendLastEventToStatus(lastEvent?: string): {
  status: EmailDeliveryStatus;
  lastEvent: string;
  statusNote: string;
} {
  const normalized = (lastEvent || '').toLowerCase().trim();
  if (normalized === 'delivered') {
    return {
      status: 'delivered',
      lastEvent: normalized,
      statusNote: 'Confirmed delivered by Resend delivery status API.',
    };
  }
  if (normalized === 'bounced') {
    return {
      status: 'bounced',
      lastEvent: normalized,
      statusNote: 'Resend reported email bounced.',
    };
  }
  if (normalized === 'complained') {
    return {
      status: 'complained',
      lastEvent: normalized,
      statusNote: 'Resend reported recipient spam complaint.',
    };
  }
  if (normalized === 'delivery_delayed') {
    return {
      status: 'delivery_delayed',
      lastEvent: normalized,
      statusNote: 'Resend reported delivery delayed; retrying automatically.',
    };
  }
  if (normalized === 'failed' || normalized === 'canceled') {
    return {
      status: 'failed',
      lastEvent: normalized,
      statusNote: `Resend reported status "${normalized}".`,
    };
  }
  return {
    status: 'sent_to_provider',
    lastEvent: normalized || 'sent',
    statusNote: 'Queued/sent to provider; awaiting final recipient delivery confirmation.',
  };
}

// In-memory idempotency cache prevents duplicate provider calls in short bursts
const idempotencyResultsCache = new Map<string, TransactionalEmailResult>();

export function clearEmailIdempotencyCacheForTests() {
  idempotencyResultsCache.clear();
}

export async function sendTransactionalEmailWithResend(
  req: TransactionalEmailRequest,
  clientOverride?: ResendClientLike | null
): Promise<TransactionalEmailResult> {
  const requestId = `EML-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  const cleanEmail = (req.recipientEmail || '').trim();
  const idempotencyKey = (
    req.idempotencyKey ||
    `sda-${req.templateType}-${cleanEmail.toLowerCase()}-${req.orderNumber || req.returnNumber || req.refundNumber || Date.now()}`
  )
    .replace(/[^a-zA-Z0-9_:/.-]/g, '-')
    .slice(0, 250);

  if (!isValidEmailAddress(cleanEmail)) {
    return {
      ok: false,
      requestId,
      resendEmailId: '',
      idempotencyKey,
      templateType: req.templateType,
      recipientEmail: cleanEmail.slice(0, 160),
      status: 'failed',
      lastEvent: 'validation_error',
      statusNote: 'Recipient email address is missing or invalid.',
      errorCode: 'INVALID_EMAIL',
      errorMessage: 'Recipient email address is missing or invalid.',
    };
  }

  const cached = idempotencyResultsCache.get(idempotencyKey);
  if (cached && cached.ok) {
    return {
      ...cached,
      deduped: true,
    };
  }

  const cfg = getResendConfig();
  const client = clientOverride !== undefined ? clientOverride : defaultResendFactory();
  const fromEmail = cfg.fromEmail;

  if (!client || !fromEmail) {
    return {
      ok: false,
      requestId,
      resendEmailId: '',
      idempotencyKey,
      templateType: req.templateType,
      recipientEmail: cleanEmail,
      status: 'skipped_unconfigured',
      lastEvent: 'unconfigured',
      statusNote:
        'Resend server credentials (RESEND_API_KEY and/or RESEND_FROM_EMAIL) are not configured. Email was not sent.',
      errorCode: 'RESEND_UNCONFIGURED',
      errorMessage:
        'Missing RESEND_API_KEY or RESEND_FROM_EMAIL in server environment.',
    };
  }

  const content = buildTransactionalEmailContent(req);

  try {
    const response = await client.emails.send(
      {
        from: fromEmail,
        to: [cleanEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
      },
      { idempotencyKey }
    );

    if (response.error) {
      return {
        ok: false,
        requestId,
        resendEmailId: '',
        idempotencyKey,
        templateType: req.templateType,
        recipientEmail: cleanEmail,
        status: 'failed',
        lastEvent: 'provider_error',
        statusNote: 'Resend API rejected or failed to accept this email request.',
        errorCode: String(response.error.name || 'RESEND_API_ERROR').slice(0, 64),
        errorMessage: String(response.error.message || 'Resend API error').slice(0, 300),
      };
    }

    const resendEmailId = response.data?.id || '';
    const result: TransactionalEmailResult = {
      ok: Boolean(resendEmailId),
      requestId,
      resendEmailId,
      idempotencyKey,
      templateType: req.templateType,
      recipientEmail: cleanEmail,
      status: resendEmailId ? 'sent_to_provider' : 'queued',
      lastEvent: resendEmailId ? 'sent' : 'queued',
      statusNote:
        'Accepted by Resend (queued/sent to provider); delivery will be confirmed only after provider delivery event.',
    };

    if (resendEmailId) {
      idempotencyResultsCache.set(idempotencyKey, result);
      if (idempotencyResultsCache.size > 500) {
        const firstKey = idempotencyResultsCache.keys().next().value;
        if (firstKey) idempotencyResultsCache.delete(firstKey);
      }
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      requestId,
      resendEmailId: '',
      idempotencyKey,
      templateType: req.templateType,
      recipientEmail: cleanEmail,
      status: 'failed',
      lastEvent: 'network_exception',
      statusNote: 'Failed to reach Resend API.',
      errorCode: 'RESEND_EXCEPTION',
      errorMessage: err instanceof Error ? err.message.slice(0, 300) : 'Unknown Resend SDK failure',
    };
  }
}

export async function checkResendDeliveryStatus(
  resendEmailId: string,
  clientOverride?: ResendClientLike | null
): Promise<EmailDeliveryStatusResult> {
  const cleanId = resendEmailId.trim();
  if (!cleanId) {
    return {
      ok: false,
      resendEmailId: '',
      status: 'failed',
      lastEvent: 'invalid_id',
      statusNote: 'Missing Resend email ID.',
      errorMessage: 'Missing Resend email ID.',
    };
  }

  const client = clientOverride !== undefined ? clientOverride : defaultResendFactory();
  if (!client) {
    return {
      ok: false,
      resendEmailId: cleanId,
      status: 'skipped_unconfigured',
      lastEvent: 'unconfigured',
      statusNote: 'RESEND_API_KEY is not configured in server environment.',
      errorMessage: 'RESEND_API_KEY missing.',
    };
  }

  try {
    const response = await client.emails.get(cleanId);
    if (response.error || !response.data) {
      return {
        ok: false,
        resendEmailId: cleanId,
        status: 'failed',
        lastEvent: 'lookup_error',
        statusNote: 'Unable to retrieve delivery status from Resend.',
        errorMessage: response.error?.message || 'Email record not returned by Resend.',
      };
    }

    const mapped = mapResendLastEventToStatus(response.data.last_event);
    return {
      ok: true,
      resendEmailId: response.data.id || cleanId,
      status: mapped.status,
      lastEvent: mapped.lastEvent,
      statusNote: mapped.statusNote,
    };
  } catch (err) {
    return {
      ok: false,
      resendEmailId: cleanId,
      status: 'failed',
      lastEvent: 'lookup_exception',
      statusNote: 'Exception while querying Resend delivery status.',
      errorMessage: err instanceof Error ? err.message.slice(0, 300) : 'Lookup failed',
    };
  }
}
