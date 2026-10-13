import { z } from 'zod';

/**
 * Site onboarding registry. Adding a guide for a new feature = adding one entry here (plus `data-tour` anchors in the UI).
 * - kind 'tour': guided tour; each step is a highlighted element with a short note, completed by «بعدی».
 * - kind 'walkthrough': the player really does each step. `doneOn` steps finish when the page path matches;
 *   `verify` steps are checked by the server against real data, so they cannot be claimed without doing them.
 * The «Getting Started» achievement needs every step of every guide here (packages/play goalFacts → 'onboarding').
 */
export const ONBOARDING_CHECKS = ['joined_table', 'profile_customized', 'friend_request'] as const;
export type OnboardingCheck = typeof ONBOARDING_CHECKS[number];

export interface OnboardingStep {
  key: string;
  titleFa: string;
  bodyFa: string;
  /** `data-tour` value of the element to highlight; missing or hidden → the note shows without a highlight. */
  target?: string;
  /** Walkthrough: finished when location.pathname matches this regex. */
  doneOn?: string;
  /** Walkthrough: a shortcut link for screens where the target is not visible (e.g. phone dock). */
  href?: string;
  /** Walkthrough: server-verified real action. */
  verify?: OnboardingCheck;
}
export interface OnboardingTour { key: string; kind: 'tour' | 'walkthrough'; titleFa: string; summaryFa: string; steps: OnboardingStep[] }

export const ONBOARDING_TOURS: readonly OnboardingTour[] = [
  {
    key: 'welcome', kind: 'tour', titleFa: 'آشنایی با باشگاه', summaryFa: 'گشتی کوتاه در بخش‌های اصلی سایت.',
    steps: [
      { key: 'games', target: 'nav-games', titleFa: 'بازی‌ها', bodyFa: 'همهٔ بازی‌ها با قانون، آموزش تعاملی و ساخت میز از همین‌جا.' },
      { key: 'tables', target: 'nav-tables', titleFa: 'میزها و حریف‌یابی', bodyFa: 'به میز باز دیگران بپیوندید، با حریف‌یابی سریع هم‌بازی هم‌سطح پیدا کنید یا در تورنمنت شرکت کنید.' },
      { key: 'progress', target: 'nav-progress', titleFa: 'پیشرفت و رتبه', bodyFa: 'سطح، مأموریت‌های هفتگی، دستاوردها و رتبهٔ شما در لیگ اینجاست.' },
      { key: 'messages', target: 'nav-messages', titleFa: 'پیام و دوستان', bodyFa: 'گفت‌وگوها، دوستان، گروه‌های خصوصی و باشگاه‌های عمومی.' },
      { key: 'profile', target: 'nav-profile', titleFa: 'پروفایل شما', bodyFa: 'آواتار، معرفی و ویترین دستاوردها؛ چیزی که دیگران می‌بینند.' },
      { key: 'guides', target: 'nav-guides', titleFa: 'راهنما', bodyFa: 'هر آموزش را هر وقت خواستید از اینجا دوباره اجرا کنید.' }
    ]
  },
  {
    key: 'first-table', kind: 'walkthrough', titleFa: 'اولین میز', summaryFa: 'یک بازی انتخاب کنید و پشت میز بنشینید.',
    steps: [
      { key: 'catalog', target: 'nav-games', href: '/games', doneOn: '^/games/?$', titleFa: 'بازی‌ها را باز کنید', bodyFa: 'روی «بازی‌ها» بزنید.' },
      { key: 'game', target: 'catalog-grid', doneOn: '^/games/[^/]+/?$', titleFa: 'یک بازی انتخاب کنید', bodyFa: 'روی کارت یکی از بازی‌ها بزنید.' },
      { key: 'table', target: 'game-actions', verify: 'joined_table', titleFa: 'پشت میز بنشینید',
        bodyFa: 'یک میز بسازید، آموزش تعاملی را شروع کنید یا به میز دیگران بپیوندید.' }
    ]
  },
  {
    key: 'profile', kind: 'walkthrough', titleFa: 'پروفایل شما', summaryFa: 'پروفایلتان را شخصی کنید.',
    steps: [
      { key: 'open', target: 'nav-profile', href: '/me/profile', doneOn: '^/me/profile/?$', titleFa: 'پروفایل را باز کنید', bodyFa: 'روی آواتار خودتان بزنید.' },
      { key: 'customize', target: 'profile-editor', verify: 'profile_customized', titleFa: 'شخصی‌سازی کنید',
        bodyFa: 'آواتار را عوض کنید، یک معرفی کوتاه بنویسید یا بازی محبوبتان را انتخاب کنید و ذخیره کنید.' }
    ]
  },
  {
    key: 'social', kind: 'walkthrough', titleFa: 'دوست‌یابی', summaryFa: 'بازیکنی پیدا کنید و درخواست دوستی بدهید.',
    steps: [
      { key: 'open', target: 'nav-messages', href: '/friends', doneOn: '^/friends/?$', titleFa: 'صفحهٔ دوستان', bodyFa: 'در «پیام و دوستان» زبانهٔ «دوستان» را بزنید.' },
      { key: 'request', target: 'friends-search', verify: 'friend_request', titleFa: 'درخواست دوستی',
        bodyFa: 'در زبانهٔ «یافتن» نام یک بازیکن را جست‌وجو کنید و «افزودن دوست» را بزنید.' }
    ]
  }
];

/** A guide is complete when every step currently in the registry is done (a newly added step reopens it). */
export const tourComplete = (tour: OnboardingTour, done: readonly string[]) => tour.steps.every((s) => done.includes(s.key));

export const onboardingState = z.object({
  tours: z.array(z.object({ key: z.string(), completedSteps: z.array(z.string()), completed: z.boolean(), dismissed: z.boolean() })),
  /** The «Getting Started» achievement: granted once every guide is complete. */
  achievement: z.object({ key: z.string(), grantedAt: z.iso.datetime().nullable() })
});
export type OnboardingState = z.infer<typeof onboardingState>;
export const GETTING_STARTED_KEY = 'getting_started';
