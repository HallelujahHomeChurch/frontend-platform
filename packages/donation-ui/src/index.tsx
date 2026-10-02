'use client';

import {useRef, useState} from 'react';
import {Button, Form, Input, Label, TextField} from '@hallelujahhomechurch/ui';
import {DonationApiError, type DonationOrder, type DonationTransport} from '@hallelujahhomechurch/donation-client';

const defaultLabels = {
  amount: '金額（TWD）', create: '建立付款', retry: '重試相同付款', created: '付款已建立',
  invalid: '金額請輸入 TWD 0.01–9,999,999.99，最多兩位小數。',
  unavailable: '銀行服務暫時無法使用。請重試相同付款；不要另開付款。',
  error: '付款結果尚未確認。請重試相同付款；金額已鎖定。',
  forbidden: '沒有付款測試權限。', login: '登入已失效。請重新登入後查詢原付款。',
  conflict: '付款識別與金額不一致。請查詢原付款。',
  blocked: '原付款重試資料已失效或無法使用。請交由維護者查詢原付款；不要建立另一筆付款。',
  storage: '無法保留原付款重試資料。請恢復瀏覽器儲存後再試。',
};
export type DonationFormLabels = typeof defaultLabels;

type PendingIntent = {idempotencyKey: string; amountMinor: number; createdAt: number};
const intentLifetime = 15 * 60 * 1000;

function restoreIntent(key: string | undefined): {intent: PendingIntent | null; blocked: boolean} {
  if (!key) return {intent: null, blocked: false};
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return {intent: null, blocked: false};
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object' || Object.keys(value).length !== 3) return {intent: null, blocked: true};
    const intent = value as PendingIntent;
    const valid = typeof intent.idempotencyKey === 'string' && /^[!-~]{16,128}$/.test(intent.idempotencyKey)
      && Number.isSafeInteger(intent.amountMinor) && intent.amountMinor > 0 && intent.amountMinor <= 999999999
      && Number.isSafeInteger(intent.createdAt) && intent.createdAt <= Date.now() && Date.now() - intent.createdAt < intentLifetime;
    return valid ? {intent, blocked: false} : {intent: null, blocked: true};
  } catch { return {intent: null, blocked: true}; }
}

export function DonationForm({transport, onOrder, labels = defaultLabels, intentStorageKey}: {
  transport: DonationTransport;
  onOrder: (order: DonationOrder) => void;
  labels?: DonationFormLabels;
  intentStorageKey?: string;
}) {
  const [restored] = useState(() => restoreIntent(intentStorageKey));
  const [amount, setAmount] = useState(restored.intent ? (restored.intent.amountMinor / 100).toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | undefined>(restored.blocked ? labels.blocked : undefined);
  const [blocked, setBlocked] = useState(restored.blocked);
  const intent = useRef<PendingIntent | null>(restored.intent);
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current || created || blocked) return;
    if (intent.current && Date.now() - intent.current.createdAt >= intentLifetime) {setBlocked(true); setError(labels.blocked); return;}
    if (!intent.current) {
      const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
      const minor = match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : NaN;
      if (!Number.isSafeInteger(minor) || minor < 1 || minor > 999999999) { setError(labels.invalid); return; }
      intent.current = {amountMinor: minor, idempotencyKey: crypto.randomUUID(), createdAt: Date.now()};
    }
    if (intentStorageKey) {
      try {sessionStorage.setItem(intentStorageKey, JSON.stringify(intent.current));}
      catch {setError(labels.storage); return;}
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const order = await transport.createCheckout({amount_minor: intent.current.amountMinor}, intent.current.idempotencyKey);
      onOrder(order);
      setCreated(true);
      if (intentStorageKey) {
        try {sessionStorage.removeItem(intentStorageKey);} catch { /* The known order remains the recovery path. */ }
      }
    } catch (failure) {
      setError(failure instanceof DonationApiError
        ? failure.status === 403 ? labels.forbidden : failure.status === 401 ? labels.login : failure.status === 409 ? labels.conflict : failure.status === 503 ? labels.unavailable : labels.error
        : labels.error);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return <Form onSubmit={(event) => {event.preventDefault(); void submit();}}>
    <TextField value={amount} onChange={setAmount} isDisabled={busy || blocked || intent.current !== null}>
      <Label>{labels.amount}</Label><Input inputMode="decimal" autoComplete="off" />
    </TextField>
    {error ? <p role="alert">{error}</p> : null}
    <Button type="submit" isDisabled={busy || blocked || created}>{created ? labels.created : intent.current ? labels.retry : labels.create}</Button>
  </Form>;
}
