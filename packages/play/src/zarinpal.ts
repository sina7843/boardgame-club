// Zarinpal payment gateway (REST v4), per the VibeFarsi `zarinpal-payment` guide.
// Amounts are stored and sent in Rial (Zarinpal's API unit). The merchant id never leaves the server and is never logged.
// Flow: create → buyer pays on Zarinpal → callback /api/payments/callback/zarinpal?Authority=…&Status=OK|NOK → verify.
import type { PaymentGateway, VerifyResult } from './billing.ts';

export interface ZarinpalConfig {
  merchantId: string;
  sandbox: boolean;
  /** Absolute callback URL Zarinpal redirects the buyer to (Authority and Status are appended by Zarinpal). */
  callbackUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type ZpResponse = { data?: { code?: number; authority?: string; ref_id?: number | string } | unknown[]; errors?: { code?: number; message?: string } | unknown[] };

/** Verify codes that end a payment for good. Anything else stays pending (the buyer may still be paying). */
const FINAL_FAILURES: Record<number, string> = {
  [-50]: 'AMOUNT_MISMATCH',        // amount differs from the request
  // -51 ("unsuccessful/unpaid") is NOT final: it is also what an unfinished payment returns. A real cancellation
  // arrives as Status=NOK on the callback; an abandoned one expires after the payment TTL.
  [-54]: 'UNKNOWN_AUTHORITY',      // invalid authority
  [-55]: 'UNKNOWN_AUTHORITY'       // transaction not found
};

export function zarinpalGateway(cfg: ZarinpalConfig): PaymentGateway {
  const base = cfg.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  const startPay = cfg.sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://www.zarinpal.com/pg/StartPay/';
  const doFetch = cfg.fetchImpl ?? fetch;

  const post = async (path: string, body: object): Promise<ZpResponse> => {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ merchant_id: cfg.merchantId, ...body }),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000)
    });
    // Zarinpal answers logical errors with 4xx and a JSON body; anything unparsable is a gateway failure.
    try { return (await res.json()) as ZpResponse; } catch { throw new Error(`Zarinpal HTTP ${res.status}`); }
  };
  const code = (r: ZpResponse) => {
    const d = r.data && !Array.isArray(r.data) ? r.data.code : undefined;
    const e = r.errors && !Array.isArray(r.errors) ? r.errors.code : undefined;
    return d ?? e;
  };

  return {
    id: 'zarinpal',
    isFixture: false,
    async create({ amount, description, orderId }) {
      const r = await post('/pg/v4/payment/request.json', { amount, currency: 'IRR', callback_url: cfg.callbackUrl, description, metadata: { order_id: orderId } });
      const data = r.data && !Array.isArray(r.data) ? r.data : undefined;
      if (code(r) !== 100 || !data?.authority) throw new Error(`Zarinpal request rejected (code ${String(code(r))})`);
      return { authority: data.authority, redirectUrl: `${startPay}${encodeURIComponent(data.authority)}` };
    },
    async verify({ authority, amount }): Promise<VerifyResult> {
      let r: ZpResponse;
      try { r = await post('/pg/v4/payment/verify.json', { amount, authority }); } catch { return { status: 'pending' }; } // network: retry later
      const c = code(r);
      const data = r.data && !Array.isArray(r.data) ? r.data : undefined;
      if ((c === 100 || c === 101) && data?.ref_id !== undefined) {
        // Zarinpal verifies the amount server-side (else -50), so the paid amount is the requested one.
        return { status: 'paid', refId: String(data.ref_id), paidAmount: amount };
      }
      if (c !== undefined && FINAL_FAILURES[c]) return { status: 'failed', reason: FINAL_FAILURES[c]! };
      return { status: 'pending' };
    }
  };
}
