// Apply saved display preferences before first paint to avoid a theme flash.
// External file (not inline) so the Content-Security-Policy can forbid inline scripts.
/* global document */
try {
  var p = JSON.parse(localStorage.getItem('bg.prefs') || '{}');
  // Default follows the device; tokens.css handles "no data-theme" through prefers-color-scheme.
  if (p.theme === 'light' || p.theme === 'dark') document.documentElement.dataset.theme = p.theme;
  if (p.motion && p.motion !== 'system') document.documentElement.dataset.motion = p.motion;
} catch {
  // storage unavailable: default theme applies
}
