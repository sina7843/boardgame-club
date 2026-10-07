// Kavenegar Verify Lookup (per the VibeFarsi `kavenegar-otp` guide): one pre-approved template, the code as `token`.
// The API key lives in the URL path, so URLs are never logged or put into error messages.
import type { OtpDelivery } from './delivery.ts';

export interface KavenegarConfig {
  apiKey: string;
  template: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Kavenegar expects local Iranian mobiles as 09XXXXXXXXX; our accounts are already normalized to that. */
export function toKavenegarReceptor(mobile: string): string {
  const d = mobile.replace(/\D/g, '');
  if (d.startsWith('98') && d.length === 12) return `0${d.slice(2)}`;
  if (d.startsWith('09') && d.length === 11) return d;
  throw new Error('Kavenegar: unsupported receptor format');
}

export function kavenegarDelivery(cfg: KavenegarConfig): OtpDelivery {
  const doFetch = cfg.fetchImpl ?? fetch;
  return {
    isFixture: false,
    issueCode: (generate) => generate(),
    async send(mobile, code) {
      const qs = new URLSearchParams({ receptor: toKavenegarReceptor(mobile), token: code, template: cfg.template });
      const res = await doFetch(`https://api.kavenegar.com/v1/${encodeURIComponent(cfg.apiKey)}/verify/lookup.json?${qs}`, {
        method: 'GET', signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000)
      });
      const body = (await res.json().catch(() => null)) as { return?: { status?: number } } | null;
      // Kavenegar reports logical errors inside return.status (401 key, 411 template, 418 credit, ...), often with HTTP 200.
      const status = body?.return?.status;
      if (!res.ok || status !== 200) throw new Error(`Kavenegar rejected the request (HTTP ${res.status}, status ${String(status)})`);
    }
  };
}
