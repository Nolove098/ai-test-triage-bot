import { type FailedRequestRecord } from '../fixtures/contextCollector.fixture';

export type FailureCategory =
  | 'UI_LOCATOR_CHANGED'
  | 'BACKEND_API_ERROR'
  | 'FLAKY_OR_NETWORK'
  | 'ASSERTION_BUG';

export type FailureSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export type FailureOwner = 'Frontend' | 'Backend' | 'QA Automation';

export interface FailureContext {
  readonly testTitle: string;
  readonly filePath: string;
  readonly browser: string;
  readonly errorMessage: string;
  readonly stackTrace: string;
  readonly consoleErrors: string[];
  readonly failedRequests: FailedRequestRecord[];
  readonly currentUrl: string;
}

export interface AIAnalysisResult {
  readonly category: FailureCategory;
  readonly severity: FailureSeverity;
  readonly rootCause: string;
  readonly suggestedFix: string;
  readonly owner: FailureOwner;
}

export interface TriagedFailure {
  readonly context: FailureContext;
  readonly analysis: AIAnalysisResult;
}

export interface RunSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly failures: FailureContext[];
}
