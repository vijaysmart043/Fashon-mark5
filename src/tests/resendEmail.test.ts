import http from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../../server';
import {
  buildTransactionalEmailContent,
  checkResendDeliveryStatus,
  clearEmailIdempotencyCacheForTests,
  mapResendLastEventToStatus,
  ResendClientLike,
  sendTransactionalEmailWithResend,
  TRANSACTIONAL_EMAIL_TYPES,
} from '../../server/resendEmailService';

describe('Resend Transactional Email Templates & Sanitization', () => {
  it('renders all 9 required transactional email templates safely and escapes HTML', () => {
    expect(TRANSACTIONAL_EMAIL_TYPES).toHaveLength(9);

    for (const templateType of TRANSACTIONAL_EMAIL_TYPES) {
      const rendered = buildTransactionalEmailContent({
        templateType,
        recipientEmail: 'ananya@example.com',
        recipientName: '<script>alert(1)</script>Ananya',
        orderNumber: 'SDA-900001',
        invoiceNumber: 'INV-SDA-900001',
        amount: 25400,
        paymentMethod: 'upi',
        paymentStatus: 'Successful',
        courierName: 'Blue Dart',
        trackingNumber: 'BD123456',
        trackingUrl: 'javascript:alert(1)',
        shipmentStatus: 'Shipped',
        returnNumber: 'RET-900001',
        returnStatus: 'Approved',
        refundNumber: 'REF-900001',
        refundStatus: 'Completed',
        referenceId: 'SIM-REF-123',
        notes: '<img src=x onerror=alert(1)>Safe dispatch note',
      });

      expect(rendered.subject.length).toBeGreaterThan(5);
      expect(rendered.html).toContain('SDA COLLECTIONS');
      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).not.toContain('<img src=x');
      expect(rendered.html).not.toContain('javascript:alert(1)');
      expect(rendered.text.length).toBeGreaterThan(10);
    }

    const withHttpsUrl = buildTransactionalEmailContent({
      templateType: 'shipment_update',
      recipientEmail: 'ananya@example.com',
      orderNumber: 'SDA-900001',
      trackingUrl: 'https://www.bluedart.com/track?id=BD123456',
    });
    expect(withHttpsUrl.html).toContain('https://www.bluedart.com/track?id=BD123456');
  });
});

describe('Resend Provider Execution, Idempotency & Error Handling', () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;

  beforeEach(() => {
    clearEmailIdempotencyCacheForTests();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;

    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  });

  it('returns skipped_unconfigured cleanly without claiming sent or delivered when env vars are missing', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    const result = await sendTransactionalEmailWithResend({
      templateType: 'order_confirmation',
      recipientEmail: 'patron@example.com',
      orderNumber: 'SDA-1001',
      idempotencyKey: 'order-confirm-SDA-1001',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('skipped_unconfigured');
    expect(result.errorCode).toBe('RESEND_UNCONFIGURED');
    expect(result.resendEmailId).toBe('');
    expect(result.requestId).toMatch(/^EML-/);
  });

  it('sends via Resend SDK with idempotencyKey, distinguishes sent_to_provider from delivered, and deduplicates repeats', async () => {
    process.env.RESEND_API_KEY = 're_test_dummy_key_never_exposed';
    process.env.RESEND_FROM_EMAIL = 'SDA Collections <orders@sdacollections.example>';

    const sendSpy = vi.fn().mockResolvedValue({
      data: { id: 're_email_abc123' },
      error: null,
    });
    const getSpy = vi.fn().mockResolvedValue({
      data: { id: 're_email_abc123', last_event: 'delivered' },
      error: null,
    });
    const mockClient: ResendClientLike = {
      emails: { send: sendSpy, get: getSpy },
    };

    const first = await sendTransactionalEmailWithResend(
      {
        templateType: 'order_confirmation',
        recipientEmail: 'patron@example.com',
        recipientName: 'Priya',
        orderNumber: 'SDA-1002',
        amount: 32000,
        idempotencyKey: 'order-confirm-SDA-1002',
      },
      mockClient
    );

    expect(first.ok).toBe(true);
    expect(first.status).toBe('sent_to_provider');
    expect(first.status).not.toBe('delivered');
    expect(first.resendEmailId).toBe('re_email_abc123');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toEqual({ idempotencyKey: 'order-confirm-SDA-1002' });

    const duplicate = await sendTransactionalEmailWithResend(
      {
        templateType: 'order_confirmation',
        recipientEmail: 'patron@example.com',
        orderNumber: 'SDA-1002',
        idempotencyKey: 'order-confirm-SDA-1002',
      },
      mockClient
    );

    expect(duplicate.deduped).toBe(true);
    expect(duplicate.resendEmailId).toBe('re_email_abc123');
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('handles Resend API error objects and network exceptions without exposing secrets', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_abc';
    process.env.RESEND_FROM_EMAIL = 'SDA Collections <orders@sdacollections.example>';

    const apiErrorClient: ResendClientLike = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { name: 'validation_error', message: 'Domain not verified for sending' },
        }),
        get: vi.fn(),
      },
    };

    const apiErrRes = await sendTransactionalEmailWithResend(
      {
        templateType: 'invoice_notification',
        recipientEmail: 'patron@example.com',
        orderNumber: 'SDA-1003',
        idempotencyKey: 'invoice-SDA-1003',
      },
      apiErrorClient
    );

    expect(apiErrRes.ok).toBe(false);
    expect(apiErrRes.status).toBe('failed');
    expect(apiErrRes.errorCode).toBe('validation_error');
    expect(apiErrRes.errorMessage).toContain('Domain not verified');
    expect(JSON.stringify(apiErrRes)).not.toContain('re_test_secret_abc');

    const networkErrorClient: ResendClientLike = {
      emails: {
        send: vi.fn().mockRejectedValue(new Error('ETIMEDOUT connecting to api.resend.com')),
        get: vi.fn(),
      },
    };

    const netErrRes = await sendTransactionalEmailWithResend(
      {
        templateType: 'payment_status',
        recipientEmail: 'patron@example.com',
        orderNumber: 'SDA-1004',
        idempotencyKey: 'payment-SDA-1004',
      },
      networkErrorClient
    );

    expect(netErrRes.ok).toBe(false);
    expect(netErrRes.status).toBe('failed');
    expect(netErrRes.errorCode).toBe('RESEND_EXCEPTION');
    expect(netErrRes.errorMessage).toContain('ETIMEDOUT');
  });

  it('maps Resend last_event statuses honestly via mapResendLastEventToStatus and checkResendDeliveryStatus', async () => {
    expect(mapResendLastEventToStatus('sent').status).toBe('sent_to_provider');
    expect(mapResendLastEventToStatus('delivered').status).toBe('delivered');
    expect(mapResendLastEventToStatus('bounced').status).toBe('bounced');
    expect(mapResendLastEventToStatus('delivery_delayed').status).toBe('delivery_delayed');

    process.env.RESEND_API_KEY = 're_test_secret_abc';
    const mockClient: ResendClientLike = {
      emails: {
        send: vi.fn(),
        get: vi.fn().mockResolvedValue({
          data: { id: 're_email_xyz', last_event: 'delivered' },
          error: null,
        }),
      },
    };

    const statusRes = await checkResendDeliveryStatus('re_email_xyz', mockClient);
    expect(statusRes.ok).toBe(true);
    expect(statusRes.status).toBe('delivered');
    expect(statusRes.lastEvent).toBe('delivered');
  });
});

describe('Resend Server Express Routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = createApiApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports resendConfigured cleanly without leaking keys on /api/notifications/providers', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/providers`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resendConfigured).toBe(false);
    expect(json).not.toHaveProperty('apiKey');
    expect(json).not.toHaveProperty('fromEmail');
  });

  it('requires Firebase authentication on /api/emails/send and /api/emails/status/:id', async () => {
    const sendRes = await fetch(`${baseUrl}/api/emails/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateType: 'welcome', recipientEmail: 'patron@example.com' }),
    });
    expect(sendRes.status).toBe(401);

    const statusRes = await fetch(`${baseUrl}/api/emails/status/re_12345`);
    expect(statusRes.status).toBe(401);
  });

  it('validates email on /api/emails/password-reset-notice and returns skipped_unconfigured when unconfigured', async () => {
    const invalidRes = await fetch(`${baseUrl}/api/emails/password-reset-notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(invalidRes.status).toBe(400);

    const validRes = await fetch(`${baseUrl}/api/emails/password-reset-notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'patron@example.com' }),
    });
    expect(validRes.status).toBe(200);
    const data = await validRes.json();
    expect(data.status).toBe('skipped_unconfigured');
    expect(data.templateType).toBe('password_reset');
  });
});
