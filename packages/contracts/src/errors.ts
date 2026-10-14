import { z } from 'zod';

/** Stable machine codes with Persian user messages (Requirements §10). */
export const ERRORS = {
  VALIDATION_FAILED: 'اطلاعات ارسال‌شده معتبر نیست.',
  UNAUTHENTICATED: 'برای ادامه وارد حساب خود شوید.',
  FORBIDDEN: 'دسترسی لازم برای این کار را ندارید.',
  NOT_FOUND: 'مورد درخواستی پیدا نشد.',
  RATE_LIMITED: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.',
  CSRF_ORIGIN_REJECTED: 'درخواست از مبدأ مجاز ارسال نشده است.',
  INVALID_MOBILE: 'شماره موبایل معتبر نیست.',
  OTP_INVALID: 'کد واردشده درست نیست.',
  OTP_EXPIRED: 'کد منقضی شده است؛ کد تازه بگیرید.',
  OTP_ALREADY_USED: 'این کد قبلاً استفاده شده است؛ کد تازه بگیرید.',
  OTP_TOO_MANY_ATTEMPTS: 'تعداد تلاش‌ها بیش از حد مجاز است؛ کد تازه بگیرید.',
  OTP_RESEND_TOO_SOON: 'کمی صبر کنید و سپس دوباره کد بگیرید.',
  OTP_DELIVERY_FAILED: 'ارسال کد ممکن نشد؛ دوباره تلاش کنید.',
  NOT_PARTICIPANT: 'شما عضو این میز نیستید.',
  TABLE_FULL: 'ظرفیت این میز تکمیل است.',
  TABLE_NOT_OPEN: 'این میز دیگر پذیرای عضو تازه نیست.',
  REMATCH_CLOSED: 'درخواست بازی دوباره بسته شده است.',
  ALREADY_JOINED: 'شما عضو این میز هستید.',
  INVITE_REQUIRED: 'ورود به این میز خصوصی فقط با لینک دعوت ممکن است.',
  GAME_NOT_ACCEPTING_TABLES: 'ساخت میز تازه برای این بازی فعلاً ممکن نیست.',
  MODE_NOT_SUPPORTED: 'این بازی از این حالت پشتیبانی نمی‌کند.',
  RANKED_NOT_AVAILABLE: 'میز رتبه‌دار فقط از حریف‌یابی رتبه‌دار ساخته می‌شود؛ میز دستی دوستانه است.',
  PREMIUM_REQUIRED: 'این بازی به اشتراک پریمیوم نیاز دارد.',
  TURN_TABLE_LIMIT: 'به سقف میزهای نوبتی هم‌زمان رسیده‌اید.',
  ALREADY_IN_LIVE_TABLE: 'شما در یک میز زنده دیگر حضور دارید.',
  INVALID_TIME_SETTING: 'زمان نوبت انتخاب‌شده مجاز نیست.',
  OPTION_NOT_ALLOWED: 'گزینه قانون انتخاب‌شده برای این بازی مجاز نیست.',
  GAME_SETTINGS_INVALID: 'این تنظیمات خارج از قابلیت‌های این بازی است.',
  COMMAND_ID_REUSED: 'شناسه این حرکت قبلاً برای حرکت دیگری استفاده شده است.',
  INCIDENT_ALREADY_OPEN: 'یک توقف سراسری از قبل فعال است.',
  BLOCKED: 'امکان ارتباط با این کاربر وجود ندارد.',
  DM_NOT_ALLOWED: 'این کاربر فقط از دوستانش پیام می‌پذیرد.',
  ALREADY_QUEUED: 'شما در صف حریف‌یابی هستید.',
  TICKET_NOT_ACTIVE: 'این درخواست حریف‌یابی دیگر فعال نیست.',
  ALREADY_FRIENDS: 'شما با این کاربر دوست هستید.',
  CANNOT_TARGET_SELF: 'این کار روی حساب خودتان ممکن نیست.',
  CHAT_RESTRICTED: 'ارسال پیام برای حساب شما موقتاً محدود شده است.',
  CHAT_TOO_FAST: 'پیام‌ها خیلی پشت سر هم است؛ چند ثانیه صبر کنید.',
  CHAT_SLOW_MODE: 'حالت آهسته فعال است؛ کمی بعد پیام بعدی را بفرستید.',
  EDIT_WINDOW_CLOSED: 'زمان ویرایش این پیام گذشته است.',
  ACCOUNT_SUSPENDED: 'حساب شما موقتاً تعلیق شده است.',
  NOT_A_MEMBER: 'شما عضو این گروه یا باشگاه نیستید.',
  MANAGER_REQUIRED: 'این کار فقط از مدیر باشگاه یا گروه برمی‌آید.',
  OWNER_REQUIRED: 'این کار فقط از مالک برمی‌آید.',
  INVITE_ONLY: 'عضویت فقط با دعوت ممکن است.',
  SLUG_TAKEN: 'این نشانی قبلاً گرفته شده است.',
  TUTORIAL_DISABLED: 'آموزش این بازی موقتاً غیرفعال است.',
  BOT_NOT_AVAILABLE: 'برای این بازی هنوز ربات نداریم.',
  APPEAL_EXISTS: 'برای این محدودیت قبلاً اعتراض ثبت کرده‌اید.',
  ALREADY_SUSPENDED: 'این حساب همین حالا تعلیق است.',
  PAYMENT_UNAVAILABLE: 'خرید فعلاً ممکن نیست.',
  INSUFFICIENT_COINS: 'سکه کافی ندارید.',
  COSMETIC_LOCKED: 'این آیتم هنوز برای شما باز نشده است.',
  ALREADY_OWNED: 'این آیتم را از قبل دارید.',
  NOT_FOR_SALE: 'این آیتم فروشی نیست و با پیشرفت در بازی باز می‌شود.',
  PREMIUM_UNLIMITED: 'پریمیوم شما بدون تاریخ پایان است؛ خرید روز پریمیوم لازم نیست.',
  PAYMENT_PROVIDER_ERROR: 'ارتباط با درگاه پرداخت برقرار نشد؛ مبلغی کسر نشده است. دوباره تلاش کنید.',
  TOURNAMENT_NOT_OPEN: 'ثبت‌نام این تورنمنت بسته است.',
  TOURNAMENT_FULL: 'ظرفیت این تورنمنت تکمیل است.',
  ALREADY_REGISTERED: 'شما در این تورنمنت ثبت‌نام کرده‌اید.',
  NOT_REGISTERED: 'شما در این تورنمنت ثبت‌نام نکرده‌اید.',
  TOURNAMENT_PAY_ONLINE: 'ورودی این تورنمنت با پرداخت آنلاین است.',
  TOURNAMENT_SETTINGS_INVALID: 'تنظیمات تورنمنت با قابلیت‌های این بازی جور نیست.',
  ACCOUNT_HAS_ACTIVE_GAMES: 'پیش از حذف حساب، بازی‌ها و میزهای باز خود را تمام یا ترک کنید و از تورنمنت‌های فعال انصراف دهید.',
  ACCOUNT_DELETE_ADMIN: 'حساب مدیر یا ناظر را نمی‌توان حذف کرد؛ ابتدا نقش آن برداشته شود.',
  ONBOARDING_STEP_NOT_DONE: 'این مرحله هنوز انجام نشده است؛ کار خواسته‌شده را انجام دهید.',
  SEASON_CLOSED: 'این فصل بسته شده است و فقط از مسیر اصلاح ثبت‌شده تغییر می‌کند.',
  SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست.',
  INTERNAL_ERROR: 'خطای غیرمنتظره رخ داد؛ دوباره تلاش کنید.'
} as const;

export type ErrorCode = keyof typeof ERRORS;
export const errorCodeSchema = z.enum(Object.keys(ERRORS) as [ErrorCode, ...ErrorCode[]]);

export const apiErrorSchema = z.object({
  errorCode: errorCodeSchema,
  messageFa: z.string(),
  requestId: z.string(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  retryAfterSeconds: z.number().int().optional()
});
export type ApiError = z.infer<typeof apiErrorSchema>;

const STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400, INVALID_MOBILE: 400, OTP_INVALID: 400, OTP_EXPIRED: 400, OTP_ALREADY_USED: 400,
  MODE_NOT_SUPPORTED: 400, RANKED_NOT_AVAILABLE: 400, INVALID_TIME_SETTING: 400, OPTION_NOT_ALLOWED: 400, GAME_SETTINGS_INVALID: 400,
  OTP_TOO_MANY_ATTEMPTS: 429, OTP_RESEND_TOO_SOON: 429, RATE_LIMITED: 429, CHAT_TOO_FAST: 429, CHAT_SLOW_MODE: 429, EDIT_WINDOW_CLOSED: 409,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403, CSRF_ORIGIN_REJECTED: 403, NOT_PARTICIPANT: 403, INVITE_REQUIRED: 403, PREMIUM_REQUIRED: 403,
  NOT_FOUND: 404,
  TABLE_FULL: 409, TABLE_NOT_OPEN: 409, REMATCH_CLOSED: 409, ALREADY_JOINED: 409, GAME_NOT_ACCEPTING_TABLES: 409, TURN_TABLE_LIMIT: 409,
  ALREADY_IN_LIVE_TABLE: 409, COMMAND_ID_REUSED: 409, INCIDENT_ALREADY_OPEN: 409,
  ALREADY_QUEUED: 409, TICKET_NOT_ACTIVE: 409, ALREADY_FRIENDS: 409, SLUG_TAKEN: 409, TUTORIAL_DISABLED: 409, BOT_NOT_AVAILABLE: 409, APPEAL_EXISTS: 409, ALREADY_SUSPENDED: 409, INSUFFICIENT_COINS: 409, PREMIUM_UNLIMITED: 409, ALREADY_OWNED: 409, NOT_FOR_SALE: 409, COSMETIC_LOCKED: 403,
  BLOCKED: 403, DM_NOT_ALLOWED: 403, CHAT_RESTRICTED: 403, ACCOUNT_SUSPENDED: 403, NOT_A_MEMBER: 403, MANAGER_REQUIRED: 403,
  OWNER_REQUIRED: 403, INVITE_ONLY: 403, CANNOT_TARGET_SELF: 400,
  OTP_DELIVERY_FAILED: 502, PAYMENT_PROVIDER_ERROR: 502, SERVICE_UNAVAILABLE: 503, PAYMENT_UNAVAILABLE: 409, SEASON_CLOSED: 409, ONBOARDING_STEP_NOT_DONE: 409, ACCOUNT_HAS_ACTIVE_GAMES: 409, ACCOUNT_DELETE_ADMIN: 409,
  TOURNAMENT_NOT_OPEN: 409, TOURNAMENT_FULL: 409, ALREADY_REGISTERED: 409, NOT_REGISTERED: 409, TOURNAMENT_PAY_ONLINE: 409, TOURNAMENT_SETTINGS_INVALID: 400
};

/** Server-side domain error; rendered as the standard envelope by the API error handler. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryAfterSeconds: number | undefined;
  constructor(code: ErrorCode, opts: { retryAfterSeconds?: number } = {}) {
    super(code);
    this.code = code;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
  get statusCode(): number {
    return STATUS[this.code] ?? 500;
  }
}
