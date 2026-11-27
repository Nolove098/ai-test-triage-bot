import { env, hasEnvValue } from '../utils/env';
import {
  type FailureSeverity,
  type RunSummary,
  type TriagedFailure,
} from './types';

interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

interface DiscordEmbed {
  readonly title: string;
  readonly description?: string;
  readonly color: number;
  readonly fields: DiscordEmbedField[];
  readonly footer?: { readonly text: string };
  readonly timestamp: string;
}

interface DiscordWebhookPayload {
  readonly username: string;
  readonly embeds: DiscordEmbed[];
}

const COLOR_PASS = 0x2ecc71;
const COLOR_FAIL = 0xe74c3c;
const COLOR_CRITICAL = 0x992d22;
const COLOR_HIGH = 0xe67e22;
const COLOR_MEDIUM = 0xf1c40f;

const MAX_TRIAGE_EMBEDS = 5;
const MAX_FIELD_CHARS = 1000;
const MAX_TITLE_CHARS = 250;
const POST_DELAY_MS = 500;

function truncateText(text: string, maxChars: number): string {
  const clean = text.trim() || 'N/A';
  if (clean.length <= maxChars) {
    return clean;
  }
  return `${clean.slice(0, maxChars - 3)}...`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getSeverityColor(severity: FailureSeverity): number {
  switch (severity) {
    case 'CRITICAL':
      return COLOR_CRITICAL;
    case 'HIGH':
      return COLOR_HIGH;
    case 'MEDIUM':
      return COLOR_MEDIUM;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSummaryEmbed(summary: RunSummary): DiscordEmbed {
  const isSuccess = summary.failed === 0;
  const links: string[] = [];

  if (hasEnvValue(env.allureReportUrl)) {
    links.push(`[View Allure Report](${env.allureReportUrl})`);
  }
  if (hasEnvValue(env.githubRunUrl)) {
    links.push(`[GitHub Actions Run](${env.githubRunUrl})`);
  }

  const fields: DiscordEmbedField[] = [
    { name: 'Total Tests', value: String(summary.total), inline: true },
    { name: 'Passed', value: `${summary.passed}`, inline: true },
    { name: 'Failed', value: `${summary.failed}`, inline: true },
    { name: 'Skipped', value: String(summary.skipped), inline: true },
    { name: 'Duration', value: formatDuration(summary.durationMs), inline: true },
    {
      name: 'Status',
      value: isSuccess ? 'ALL PASSED' : 'ACTION REQUIRED',
      inline: true,
    },
  ];

  if (summary.failures.length > MAX_TRIAGE_EMBEDS) {
    fields.push({
      name: 'Triage Cap Notice',
      value: `Showing top ${MAX_TRIAGE_EMBEDS} of ${summary.failures.length} failures to prevent channel spam.`,
      inline: false,
    });
  }

  if (links.length > 0) {
    fields.push({
      name: 'Reports & CI Links',
      value: truncateText(links.join(' | '), MAX_FIELD_CHARS),
      inline: false,
    });
  }

  return {
    title: isSuccess
      ? 'Playwright Test Suite Passed'
      : `Playwright Test Failures Detected (${summary.failed})`,
    description: isSuccess
      ? 'All automated checks passed cleanly.'
      : 'AI Triage Engine analyzed the failed specs and attached root-cause guidance below.',
    color: isSuccess ? COLOR_PASS : COLOR_FAIL,
    fields,
    footer: { text: 'AI Test Triage Bot • Automation Exercise' },
    timestamp: new Date().toISOString(),
  };
}

function buildTriageEmbed(item: TriagedFailure, index: number): DiscordEmbed {
  const { context, analysis } = item;

  const fields: DiscordEmbedField[] = [
    {
      name: 'Test Name',
      value: truncateText(context.testTitle, MAX_FIELD_CHARS),
      inline: false,
    },
    {
      name: 'Category',
      value: `\`${analysis.category}\``,
      inline: true,
    },
    {
      name: 'Severity',
      value: `**${analysis.severity}**`,
      inline: true,
    },
    {
      name: 'Owner',
      value: analysis.owner,
      inline: true,
    },
    {
      name: 'Browser / Spec',
      value: truncateText(`${context.browser} • \`${context.filePath}\``, MAX_FIELD_CHARS),
      inline: false,
    },
    {
      name: 'Root Cause (AI)',
      value: truncateText(analysis.rootCause, MAX_FIELD_CHARS),
      inline: false,
    },
    {
      name: 'Suggested Fix',
      value: truncateText(analysis.suggestedFix, MAX_FIELD_CHARS),
      inline: false,
    },
  ];

  return {
    title: truncateText(`Failure #${index + 1}: ${context.testTitle}`, MAX_TITLE_CHARS),
    color: getSeverityColor(analysis.severity),
    fields,
    footer: { text: truncateText(`URL: ${context.currentUrl || 'N/A'}`, 200) },
    timestamp: new Date().toISOString(),
  };
}

async function postWebhookPayload(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 429) {
    const retryHeader = response.headers.get('retry-after');
    const waitMs = retryHeader ? Math.ceil(Number(retryHeader) * 1000) : 1500;
    await sleep(Number.isFinite(waitMs) ? waitMs : 1500);

    const retryResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!retryResponse.ok) {
      const errorText = await retryResponse.text().catch(() => '');
      throw new Error(
        `Discord webhook retry failed (${retryResponse.status}): ${errorText.slice(0, 200)}`,
      );
    }
    return;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Discord webhook request failed (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }
}

/**
 * Sends a Run Summary Embed followed by up to 5 AI Triage Embeds
 * to the configured Discord Webhook URL with rate-limit protection.
 */
export async function sendDiscordNotifications(
  summary: RunSummary,
  triagedFailures: readonly TriagedFailure[],
): Promise<void> {
  const summaryEmbed = buildSummaryEmbed(summary);
  const cappedFailures = triagedFailures.slice(0, MAX_TRIAGE_EMBEDS);
  const triageEmbeds = cappedFailures.map((item, idx) => buildTriageEmbed(item, idx));

  if (!hasEnvValue(env.discordWebhookUrl)) {
    console.warn(
      '[Discord Notifier] DISCORD_WEBHOOK_URL is not configured. Skipping webhook POST and printing payload preview:',
    );
    console.log(JSON.stringify({ summaryEmbed, triageEmbeds }, null, 2));
    return;
  }

  await postWebhookPayload(env.discordWebhookUrl, {
    username: 'AI Test Triage Bot',
    embeds: [summaryEmbed],
  });

  for (const embed of triageEmbeds) {
    await sleep(POST_DELAY_MS);
    await postWebhookPayload(env.discordWebhookUrl, {
      username: 'AI Test Triage Bot',
      embeds: [embed],
    });
  }

  console.log(
    `[Discord Notifier] Sent summary embed and ${triageEmbeds.length} triage embed(s) successfully.`,
  );
}
