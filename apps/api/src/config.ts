import { z } from 'zod';

const csv = z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGINS: csv.pipe(z.array(z.url()).min(1)),
  OTP_HASH_SECRET: z.string().min(32),
  OTP_PROVIDER: z.enum(['fixture', 'kavenegar']),
  /** Kavenegar Verify Lookup (OTP_PROVIDER=kavenegar). Server-side only; never logged. */
  KAVENEGAR_API_KEY: z.string().min(20).optional(),
  KAVENEGAR_VERIFY_TEMPLATE: z.string().regex(/^[\w-]{1,64}$/).optional(),
  OTP_FIXTURE_CODE: z.string().regex(/^\d{6}$/).optional(),
  OTP_REQUESTS_PER_IP_PER_10_MIN: z.coerce.number().int().min(1).default(10),
  TURN_TABLE_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  TURN_TABLE_LIMIT_PREMIUM: z.coerce.number().int().min(1).max(200).default(30),
  /** none = checkout disabled (honest blocker); fake = development-only gateway, refused in production. */
  PAYMENT_PROVIDER: z.enum(['none', 'fake', 'zarinpal']).default('none'),
  /** Zarinpal merchant id (PAYMENT_PROVIDER=zarinpal). Server-side only; never logged. */
  ZARINPAL_MERCHANT_ID: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'must be a 36-character merchant id').optional(),
  /** true = Zarinpal sandbox (moves no money); refused in production. */
  ZARINPAL_SANDBOX: z.enum(['true', 'false']).default('false'),
  /** Public URL of the web app for gateway return/redirect URLs (default: first WEB_ORIGINS entry). */
  PUBLIC_WEB_URL: z.url().optional(),
  /** Bearer token for GET /api/metrics. Unset in production → endpoint disabled; unset elsewhere → open. */
  METRICS_TOKEN: z.string().min(24).optional(),
  /** Reverse-proxy hops in front of the API in production (Caddy = 1; Caddy behind Coolify/Traefik = 2). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export type Config = ReturnType<typeof loadConfig>;

/**
 * Validates environment at startup. Production fails closed: no development OTP fixture,
 * no "local-only" placeholder secrets, HTTPS origins only.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env) {
  // Orchestrators (Compose `${X:-}`, Coolify) pass unset optionals as empty strings: treat those as unset.
  const parsed = envSchema.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${fields}`);
  }
  const c = parsed.data;
  const isProd = c.NODE_ENV === 'production';
  if (isProd) {
    const problems: string[] = [];
    if (c.OTP_PROVIDER === 'fixture') {
      problems.push('OTP_PROVIDER=fixture is development-only; configure a real SMS provider adapter');
    }
    if (c.PAYMENT_PROVIDER === 'fake') problems.push('PAYMENT_PROVIDER=fake is development-only');
    if (c.PAYMENT_PROVIDER === 'zarinpal' && c.ZARINPAL_SANDBOX === 'true') problems.push('ZARINPAL_SANDBOX=true moves no money and is not allowed in production');
    if (c.OTP_HASH_SECRET.includes('local-only') || c.DATABASE_URL.includes('local-only')) {
      problems.push('placeholder secrets from .env.example are not allowed');
    }
    if (c.WEB_ORIGINS.some((o) => !o.startsWith('https://'))) problems.push('WEB_ORIGINS must be https');
    if (problems.length) throw new Error(`Refusing to start in production: ${problems.join('; ')}`);
  }
  if (c.OTP_PROVIDER === 'fixture' && !c.OTP_FIXTURE_CODE) {
    throw new Error('Invalid configuration — OTP_FIXTURE_CODE is required for the fixture provider');
  }
  if (c.OTP_PROVIDER === 'kavenegar' && (!c.KAVENEGAR_API_KEY || !c.KAVENEGAR_VERIFY_TEMPLATE)) {
    throw new Error('Invalid configuration — KAVENEGAR_API_KEY and KAVENEGAR_VERIFY_TEMPLATE are required for OTP_PROVIDER=kavenegar');
  }
  if (c.PAYMENT_PROVIDER === 'zarinpal' && !c.ZARINPAL_MERCHANT_ID) {
    throw new Error('Invalid configuration — ZARINPAL_MERCHANT_ID is required for PAYMENT_PROVIDER=zarinpal');
  }
  return {
    env: c.NODE_ENV,
    isProd,
    databaseUrl: c.DATABASE_URL,
    host: c.API_HOST,
    port: c.API_PORT,
    webOrigins: c.WEB_ORIGINS,
    logLevel: c.LOG_LEVEL,
    metricsToken: c.METRICS_TOKEN ?? null,
    trustProxyHops: c.TRUST_PROXY_HOPS,
    otp: {
      hashSecret: c.OTP_HASH_SECRET,
      provider: c.OTP_PROVIDER,
      fixtureCode: c.OTP_FIXTURE_CODE,
      kavenegar: c.OTP_PROVIDER === 'kavenegar' ? { apiKey: c.KAVENEGAR_API_KEY!, template: c.KAVENEGAR_VERIFY_TEMPLATE! } : null,
      ttlSeconds: 120,
      maxAttempts: 5,
      resendAfterSeconds: 60,
      maxPerMobilePerHour: 5,
      requestsPerIpPer10Min: c.OTP_REQUESTS_PER_IP_PER_10_MIN
    },
    play: { turnTableLimit: c.TURN_TABLE_LIMIT, turnTableLimitPremium: c.TURN_TABLE_LIMIT_PREMIUM },
    payments: {
      provider: c.PAYMENT_PROVIDER,
      publicWebUrl: (c.PUBLIC_WEB_URL ?? c.WEB_ORIGINS[0]!).replace(/\/$/, ''),
      zarinpal: c.PAYMENT_PROVIDER === 'zarinpal' ? { merchantId: c.ZARINPAL_MERCHANT_ID!, sandbox: c.ZARINPAL_SANDBOX === 'true' } : null
    },
    session: { ttlDays: 30, cookieName: isProd ? '__Host-bg_sid' : 'bg_sid' }
  };
}
