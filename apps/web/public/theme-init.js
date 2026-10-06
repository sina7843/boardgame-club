// Apply saved display preferences before first paint to avoid a theme flash.
// External file (not inline) so the Content-Security-Policy can forbid inline scripts.
/* global matchMedia, document */
try {
  var p = JSON.parse(localStorage.getItem('bg.prefs') || '{}');
  var t = p.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : (p.theme || 'dark');
  document.documentElement.dataset.theme = t;
  if (p.motion && p.motion !== 'system') document.documentElement.dataset.motion = p.motion;
} catch {
  // storage unavailable: default theme applies
}
