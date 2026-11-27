import fs from 'node:fs';
import path from 'node:path';
import {
  type FailedRequestRecord,
  type FailureContextPayload,
} from '../fixtures/contextCollector.fixture';
import { type FailureContext, type RunSummary } from './types';

interface PlaywrightAttachment {
  readonly name?: string;
  readonly contentType?: string;
  readonly path?: string;
  readonly body?: string;
}

interface PlaywrightTestError {
  readonly message?: string;
  readonly stack?: string;
}

interface PlaywrightTestResult {
  readonly status?: string;
  readonly duration?: number;
  readonly error?: PlaywrightTestError;
  readonly errors?: PlaywrightTestError[];
  readonly attachments?: PlaywrightAttachment[];
}

interface PlaywrightSpecTest {
  readonly projectName?: string;
  readonly status?: string;
  readonly results?: PlaywrightTestResult[];
}

interface PlaywrightSpec {
  readonly title?: string;
  readonly file?: string;
  readonly tests?: PlaywrightSpecTest[];
}

interface PlaywrightSuite {
  readonly title?: string;
  readonly file?: string;
  readonly specs?: PlaywrightSpec[];
  readonly suites?: PlaywrightSuite[];
}

interface PlaywrightJsonReport {
  readonly suites?: PlaywrightSuite[];
  readonly stats?: {
    readonly duration?: number;
    readonly expected?: number;
    readonly skipped?: number;
    readonly unexpected?: number;
    readonly flaky?: number;
  };
}

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFailedRequests(raw: unknown): FailedRequestRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isRecord).map((item) => ({
    url: typeof item.url === 'string' ? item.url : '<unknown>',
    method: typeof item.method === 'string' ? item.method : 'GET',
    status: typeof item.status === 'number' ? item.status : 0,
    responseBody: typeof item.responseBody === 'string' ? item.responseBody : '',
  }));
}

function parseFailureContextAttachment(
  attachments: readonly PlaywrightAttachment[] | undefined,
): FailureContextPayload {
  const emptyContext: FailureContextPayload = {
    consoleErrors: [],
    failedRequests: [],
    currentUrl: '',
  };

  if (!attachments || attachments.length === 0) {
    return emptyContext;
  }

  const contextAttachment = attachments.find((att) => att.name === 'failure-context');
  if (!contextAttachment) {
    return emptyContext;
  }

  let rawJson = '';
  try {
    if (typeof contextAttachment.body === 'string' && contextAttachment.body.length > 0) {
      rawJson = Buffer.from(contextAttachment.body, 'base64').toString('utf-8');
    } else if (
      typeof contextAttachment.path === 'string' &&
      fs.existsSync(contextAttachment.path)
    ) {
      rawJson = fs.readFileSync(contextAttachment.path, 'utf-8');
    }
  } catch {
    return emptyContext;
  }

  if (!rawJson.trim()) {
    return emptyContext;
  }

  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!isRecord(parsed)) {
      return emptyContext;
    }

    const consoleErrors = Array.isArray(parsed.consoleErrors)
      ? parsed.consoleErrors.filter((entry): entry is string => typeof entry === 'string')
      : [];

    const failedRequests = parseFailedRequests(parsed.failedRequests);
    const currentUrl = typeof parsed.currentUrl === 'string' ? parsed.currentUrl : '';

    return {
      consoleErrors,
      failedRequests,
      currentUrl,
    };
  } catch {
    return emptyContext;
  }
}

function extractErrorDetails(result: PlaywrightTestResult | undefined): {
  errorMessage: string;
  stackTrace: string;
} {
  if (!result) {
    return { errorMessage: 'Unknown test failure', stackTrace: '' };
  }

  const primaryError = result.error ?? result.errors?.[0];
  const rawMessage = primaryError?.message ?? 'Unknown test failure';
  const rawStack = primaryError?.stack ?? rawMessage;

  return {
    errorMessage: stripAnsi(rawMessage),
    stackTrace: stripAnsi(rawStack),
  };
}

function buildSuiteTitleChain(parents: readonly string[], specTitle: string): string {
  const meaningfulParents = parents.filter(
    (title) => title.trim().length > 0 && !title.endsWith('.spec.ts'),
  );
  return [...meaningfulParents, specTitle].join(' > ');
}

/**
 * Parses Playwright's JSON report (`test-results/results.json`) recursively
 * and extracts run statistics plus enriched failure contexts.
 */
export function parsePlaywrightReport(
  reportPath = path.resolve(process.cwd(), 'test-results/results.json'),
): RunSummary {
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `Playwright JSON report not found at "${reportPath}". Run a test suite first before running triage.`,
    );
  }

  const rawContent = fs.readFileSync(reportPath, 'utf-8');
  const report = JSON.parse(rawContent) as PlaywrightJsonReport;

  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let accumulatedDurationMs = 0;
  const failures: FailureContext[] = [];

  const visitSuite = (suite: PlaywrightSuite, parentTitles: readonly string[]): void => {
    const nextParents = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs ?? []) {
      const specTitle = spec.title ?? 'Unnamed Test';
      const filePath = spec.file ?? suite.file ?? 'unknown';

      for (const specTest of spec.tests ?? []) {
        total += 1;
        const results = specTest.results ?? [];
        const latestResult = results[results.length - 1];
        accumulatedDurationMs += results.reduce((sum, r) => sum + (r.duration ?? 0), 0);

        const outcome = specTest.status ?? latestResult?.status ?? 'unknown';

        if (outcome === 'expected' || outcome === 'flaky' || outcome === 'passed') {
          passed += 1;
          continue;
        }

        if (outcome === 'skipped') {
          skipped += 1;
          continue;
        }

        failed += 1;
        const { errorMessage, stackTrace } = extractErrorDetails(latestResult);
        const contextAttachment = parseFailureContextAttachment(latestResult?.attachments);

        failures.push({
          testTitle: buildSuiteTitleChain(nextParents, specTitle),
          filePath,
          browser: specTest.projectName ?? 'chromium',
          errorMessage,
          stackTrace,
          consoleErrors: contextAttachment.consoleErrors,
          failedRequests: contextAttachment.failedRequests,
          currentUrl: contextAttachment.currentUrl,
        });
      }
    }

    for (const childSuite of suite.suites ?? []) {
      visitSuite(childSuite, nextParents);
    }
  };

  for (const rootSuite of report.suites ?? []) {
    visitSuite(rootSuite, []);
  }

  const durationMs =
    typeof report.stats?.duration === 'number'
      ? Math.round(report.stats.duration)
      : Math.round(accumulatedDurationMs);

  return {
    total,
    passed,
    failed,
    skipped,
    durationMs,
    failures,
  };
}
