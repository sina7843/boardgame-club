// QA run without the deadline worker, so live tables keep their state while the screens are captured. Gitignored? no: small, documented in VERDICT.md.
import base from '../../playwright.config.ts';
export default { ...base, testDir: '../../e2e', outputDir: '../../test-results',
  webServer: (base.webServer as { command: string }[]).filter((s) => !s.command.includes('@bg/worker')) };
