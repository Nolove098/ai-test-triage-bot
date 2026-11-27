import { test as base } from '@playwright/test';

export interface FailedRequestRecord {
  readonly url: string;
  readonly method: string;
  readonly status: number;
  readonly responseBody: string;
}

export interface FailureContextPayload {
  readonly consoleErrors: string[];
  readonly failedRequests: FailedRequestRecord[];
  readonly currentUrl: string;
}

const MAX_RESPONSE_BODY_CHARS = 500;

export type ContextCollectorFixtures = {
  contextCollector: FailureContextPayload;
};

/**
 * Automatically collects browser console errors, uncaught page errors,
 * and failed HTTP responses (>= 400). On test failure, attaches a JSON
 * `failure-context` artifact for the AI Triage Engine.
 */
export const test = base.extend<ContextCollectorFixtures>({
  contextCollector: [
    async ({ page }, use, testInfo) => {
      const consoleErrors: string[] = [];
      const failedRequests: FailedRequestRecord[] = [];
      const pendingReads: Promise<void>[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push(`Uncaught pageerror: ${error.message}`);
      });

      page.on('response', (response) => {
        const status = response.status();
        if (status < 400) {
          return;
        }

        const request = response.request();
        const url = response.url();
        const method = request.method();

        const readPromise = response
          .text()
          .then((body) => body.slice(0, MAX_RESPONSE_BODY_CHARS))
          .catch(() => '<unavailable response body>')
          .then((responseBody) => {
            failedRequests.push({
              url,
              method,
              status,
              responseBody,
            });
          });

        pendingReads.push(readPromise);
      });

      const payload: FailureContextPayload = {
        consoleErrors,
        failedRequests,
        currentUrl: '',
      };

      await use(payload);

      await Promise.allSettled(pendingReads);

      if (testInfo.status !== testInfo.expectedStatus) {
        const currentUrl = page.isClosed() ? '<page closed>' : page.url();
        const failureContext: FailureContextPayload = {
          consoleErrors,
          failedRequests,
          currentUrl,
        };

        await testInfo.attach('failure-context', {
          body: Buffer.from(JSON.stringify(failureContext, null, 2), 'utf-8'),
          contentType: 'application/json',
        });
      }
    },
    { auto: true },
  ],
});
