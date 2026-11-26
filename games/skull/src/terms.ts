import type { Term } from '@bg/ui';

/** Skull terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  disc: { fa: 'دیسک', bg: 'Disc' }, discs: { fa: 'دیسک', bg: 'Discs' }, mat: { fa: 'زیرانداز', bg: 'Mat' }, matOne: { fa: 'زیرانداز (یک امتیاز)', bg: 'Mat (one point)' },
  challenge: { fa: 'چالش', bg: 'Challenge' }, out: { fa: 'بیرون', bg: 'Out' }, place: { fa: 'گذاشتن', bg: 'Place' }, flip: { fa: 'رو کن', bg: 'Flip' },
  flipTop: { fa: 'رو کردن دیسک بالایی', bg: 'Flip the top Disc of' }, handDiscs: { fa: 'دیسک‌های دست شما', bg: 'Your Hand Discs' },
  passMe: { fa: 'کنار می‌کشم', bg: 'Pass' }, onTable: { fa: 'روی میز است', bg: 'on the table' },
  flipMore: { fa: 'دیسک دیگر رو کنید', bg: 'more Discs to Flip' }, flipsDiscs: { fa: 'دیسک‌ها را رو می‌کند', bg: 'flips the Discs' },
  placeFirst: { fa: 'یک دیسک رو به پایین بگذارید', bg: 'Place a Disc face down' }, raiseOrPass: { fa: 'عدد بالاتر بگویید یا کنار بکشید', bg: 'Raise the Bid or Pass' },
  placeOrBid: { fa: 'دیسک بگذارید یا پیشنهاد بدهید', bg: 'Place a Disc or make a Bid' },
  ruleReveal: { fa: 'اول دیسک‌های خودتان رو می‌شود؛ از هر دستهٔ دیگر فقط دیسک بالایی را رو کنید. به جمجمه که برسید یک دیسک از دست می‌دهید.', bg: 'First flip your own Discs; from each other Stack flip only the top Disc. If you hit a Skull you lose a Disc.' },
  ruleBid: { fa: 'دیسک‌ها رو به پایین‌اند. پیشنهاد یعنی قول می‌دهید این تعداد دیسک را بدون رسیدن به جمجمه رو کنید.', bg: 'Discs are face down. A Bid is a promise to flip that many Discs without hitting a Skull.' },
  placedDisc: { fa: 'یک دیسک گذاشت', bg: 'Placed a Disc' }, passed: { fa: 'کنار کشید', bg: 'Passed' }, wonChallenge: { fa: 'چالش را برد', bg: 'Won the Challenge' },
  eliminated: { fa: 'بیرون رفت', bg: 'Eliminated' }, lostDisc: { fa: 'یک دیسک از دست داد', bg: 'Lost a Disc' },
  skullFlipped: { fa: 'جمجمه رو شد', bg: 'Skull flipped' }, roseFlipped: { fa: 'گل رو شد', bg: 'Rose flipped' },
  skull: { fa: 'جمجمه', bg: 'Skull' }, rose: { fa: 'گل', bg: 'Rose' },
  bid: { fa: 'پیشنهاد', bg: 'Bid' }, pass: { fa: 'پاس', bg: 'Pass' }
} satisfies Record<string, Term>;
