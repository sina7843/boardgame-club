// Persian text helpers shared by server search and client input handling.

const ARABIC_TO_PERSIAN: Record<string, string> = {
  'ي': 'ی', 'ى': 'ی', 'ئ': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ؤ': 'و'
};

/** Map Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Canonical search form: unify Arabic/Persian yeh and kaf (FR-02), drop diacritics (Unicode Mn),
 * tatweel and zero-width joiners, treat ZWNJ as a space, lowercase Latin, collapse spaces.
 */
export function normalizeSearch(input: string): string {
  return toAsciiDigits(input.normalize('NFC'))
    .replace(/[يىئكةۀأإآؤ]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c)
    .replace(/\p{Mn}|\u0640|[\u200D-\u200F]/gu, '')
    .replace(/\u200C/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize an Iranian mobile number to 09XXXXXXXXX, or null when invalid. */
export function normalizeIranMobile(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[\s\-()]/g, '');
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/** Display-safe mask for the owner's own number, e.g. 0912***4567. Never used on public views. */
export function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}
