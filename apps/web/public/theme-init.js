// Apply saved display preferences before first paint to avoid a theme flash.
// External file (not inline) so the Content-Security-Policy can forbid inline scripts.
/* global document, window */
try {
  var p = JSON.parse(localStorage.getItem('bg.prefs') || '{}');
  // BGV tokens switch only on data-theme, so "system" resolves the device scheme here (prefs.tsx keeps it live).
  var t = p.theme === 'light' || p.theme === 'dark' ? p.theme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  if (p.motion && p.motion !== 'system') document.documentElement.dataset.motion = p.motion;
} catch {
  // storage unavailable: light theme applies
}
