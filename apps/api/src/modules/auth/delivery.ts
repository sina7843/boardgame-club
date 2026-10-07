import type { Config } from '../../config.ts';
import { kavenegarDelivery } from './kavenegar.ts';

/** Boundary for SMS providers. A real provider adapter is required before production (see DECISIONS.md). */
export interface OtpDelivery {
  readonly isFixture: boolean;
  /** Return the code to issue; the fixture returns its fixed development code. */
  issueCode(generate: () => string): string;
  send(mobile: string, code: string): Promise<void>;
}

/** Development/test-only: never sends SMS, always issues OTP_FIXTURE_CODE. Rejected by production config. */
export function fixtureDelivery(fixedCode: string): OtpDelivery {
  return {
    isFixture: true,
    issueCode: () => fixedCode,
    send: async () => {}
  };
}

export function createDelivery(config: Config): OtpDelivery {
  if (config.otp.provider === 'fixture') {
    if (!config.allowTestProviders || !config.otp.fixtureCode) throw new Error('OTP fixture provider is not allowed here');
    return fixtureDelivery(config.otp.fixtureCode);
  }
  if (config.otp.provider === 'kavenegar' && config.otp.kavenegar) return kavenegarDelivery(config.otp.kavenegar);
  throw new Error(`Unknown OTP provider ${String(config.otp.provider)}`);
}
