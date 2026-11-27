import { analyzeFailures } from './aiAnalyzer';
import { sendDiscordNotifications } from './discordNotifier';
import { parsePlaywrightReport } from './reportParser';
import { type TriagedFailure } from './types';

async function main(): Promise<void> {
  console.log('[Triage] Parsing Playwright JSON report...');
  const summary = parsePlaywrightReport();

  console.log(
    `[Triage] Run Summary -> Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}, Duration: ${summary.durationMs}ms`,
  );

  let triagedFailures: TriagedFailure[] = [];

  if (summary.failures.length > 0) {
    console.log(`[Triage] Analyzing ${summary.failures.length} failure(s) with Gemini AI...`);
    triagedFailures = await analyzeFailures(summary.failures);
  } else {
    console.log('[Triage] Zero failures detected. Skipping Gemini analysis.');
  }

  await sendDiscordNotifications(summary, triagedFailures);
  console.log('[Triage] Completed.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[Triage] Fatal error: ${message}`);
  process.exitCode = 1;
});
