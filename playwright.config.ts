import { defineConfig, devices } from '@playwright/test';

// Browser acceptance for the Persian shell. Starts the API (against the dev database, which must be
// migrated and seeded: `pnpm db:migrate && pnpm db:seed`) and the Vite dev server unless already running.
// Values below are the development placeholders from .env.example — never production credentials.
const devEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame',
  WEB_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  OTP_HASH_SECRET: 'local-only-otp-hash-secret-change-me-0000',
  OTP_PROVIDER: 'fixture',
  OTP_FIXTURE_CODE: '123456',
  // E2E runs log in repeatedly from one IP.
  OTP_REQUESTS_PER_IP_PER_10_MIN: '200',
  // Development-only fake payment gateway (the UI labels it; production refuses it).
  PAYMENT_PROVIDER: 'fake',
  PUBLIC_WEB_URL: 'http://127.0.0.1:5173',
  LOG_LEVEL: 'warn'
};

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', locale: 'fa-IR', timezoneId: 'Asia/Tehran', trace: 'retain-on-failure', contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
    { name: 'tablet-768', testIgnore: /(play|social|progress)\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-1920', testIgnore: /(play|social|progress)\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }
  ],
  webServer: [
    { command: 'pnpm --filter @bg/api start', url: 'http://127.0.0.1:3000/api/health/ready', env: devEnv, reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter @bg/web dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter @bg/worker start', url: 'http://127.0.0.1:3010/health', env: { DATABASE_URL: devEnv.DATABASE_URL, WORKER_HEALTH_PORT: '3010', DEADLINE_POLL_MS: '500', PAYMENT_PROVIDER: 'fake', WEB_ORIGINS: 'http://127.0.0.1:5173' }, reuseExistingServer: true, timeout: 60_000 }
  ]
});
