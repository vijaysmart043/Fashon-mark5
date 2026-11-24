import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  EmailDeliveryStatus,
  EmailLogRecord,
  TransactionalEmailType,
} from '../types/shippingReturns';
import { generateSafeId, writeAuditLog } from './shippingReturnsService';

export interface TriggerEmailPayload {
  templateType: TransactionalEmailType;
  recipientEmail: string;
  recipientName?: string;
  userId?: string;
  idempotencyKey: string;
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

function toSafeLogDocId(idempotencyKey: string): string {
  const cleaned = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || generateSafeId('EML');
}

export async function triggerTransactionalEmail(
  payload: TriggerEmailPayload
): Promise<EmailLogRecord | null> {
  const cleanEmail = (payload.recipientEmail || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return null;
  }

  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  const logDocId = toSafeLogDocId(payload.idempotencyKey);

  // Client-side Firestore idempotency check before hitting provider API
  try {
    const existingSnap = await getDoc(doc(db, 'emailLogs', logDocId));
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as EmailLogRecord;
      if (
        existingData.status === 'sent_to_provider' ||
        existingData.status === 'delivered' ||
        existingData.status === 'queued'
      ) {
        return existingData;
      }
    }
  } catch {
    // Proceed to server idempotency check
  }

  let serverRes: any = null;
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    serverRes = await res.json();
  } catch (err) {
    serverRes = {
      ok: false,
      requestId: generateSafeId('EML'),
      resendEmailId: '',
      idempotencyKey: payload.idempotencyKey,
      status: 'failed',
      lastEvent: 'client_network_error',
      statusNote: 'Unable to reach /api/emails/send endpoint.',
      errorCode: 'NETWORK_ERROR',
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }

  const record: EmailLogRecord = {
    id: logDocId,
    requestId: String(serverRes?.requestId || generateSafeId('EML')).slice(0, 64),
    resendEmailId: String(serverRes?.resendEmailId || '').slice(0, 128),
    idempotencyKey: String(payload.idempotencyKey).slice(0, 250),
    templateType: payload.templateType,
    recipientEmail: cleanEmail.slice(0, 160),
    userId: (payload.userId || user.uid).slice(0, 128),
    orderNumber: (payload.orderNumber || '').slice(0, 32),
    status: (serverRes?.status || 'failed') as EmailDeliveryStatus,
    lastEvent: String(serverRes?.lastEvent || 'unknown').slice(0, 64),
    statusNote: String(serverRes?.statusNote || '').slice(0, 400),
    errorCode: String(serverRes?.errorCode || '').slice(0, 64),
    errorMessage: String(serverRes?.errorMessage || '').slice(0, 300),
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'emailLogs', logDocId), record);
  } catch (err) {
    console.warn('Unable to persist emailLog to Firestore:', err);
  }

  return record;
}

export async function triggerPasswordResetNoticeEmail(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) return;
  try {
    await fetch('/api/emails/password-reset-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
  } catch {
    // Non-blocking supplementary notice; Firebase Auth reset email remains primary
  }
}

export async function fetchEmailLogsForAdmin(): Promise<EmailLogRecord[]> {
  const path = 'emailLogs';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as EmailLogRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function refreshResendEmailDeliveryStatus(params: {
  log: EmailLogRecord;
  actorUid: string;
  actorEmail?: string;
}): Promise<EmailLogRecord> {
  const { log, actorUid, actorEmail } = params;
  if (!log.resendEmailId) {
    throw new Error('This log entry does not have a Resend email ID to verify.');
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Staff authentication required.');
  }

  const token = await user.getIdToken();
  const res = await fetch(`/api/emails/status/${encodeURIComponent(log.resendEmailId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(data?.errorMessage || data?.statusNote || 'Failed to inspect Resend delivery status.');
  }

  const path = `emailLogs/${log.id}`;
  try {
    await updateDoc(doc(db, 'emailLogs', log.id), {
      status: data.status,
      lastEvent: String(data.lastEvent || '').slice(0, 64),
      statusNote: String(data.statusNote || '').slice(0, 400),
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      entityType: 'email',
      entityId: log.id,
      action: `Checked Resend status for ${log.resendEmailId}: ${data.status}`,
      actorUid,
      actorEmail,
      beforeValues: { status: log.status, lastEvent: log.lastEvent },
      afterValues: { status: data.status, lastEvent: data.lastEvent },
    });

    return {
      ...log,
      status: data.status,
      lastEvent: data.lastEvent,
      statusNote: data.statusNote,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
