import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { env, hasEnvValue } from '../utils/env';
import {
  type AIAnalysisResult,
  type FailureCategory,
  type FailureContext,
  type FailureOwner,
  type FailureSeverity,
  type TriagedFailure,
} from './types';

const GEMINI_MODEL = 'gemini-2.5-flash';

const VALID_CATEGORIES: readonly FailureCategory[] = [
  'UI_LOCATOR_CHANGED',
  'BACKEND_API_ERROR',
  'FLAKY_OR_NETWORK',
  'ASSERTION_BUG',
];

const VALID_SEVERITIES: readonly FailureSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM'];

const VALID_OWNERS: readonly FailureOwner[] = ['Frontend', 'Backend', 'QA Automation'];

const TRIAGE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: [...VALID_CATEGORIES],
    },
    severity: {
      type: Type.STRING,
      enum: [...VALID_SEVERITIES],
    },
    rootCause: {
      type: Type.STRING,
      description: 'Concise root cause explanation in Vietnamese (maximum 3 sentences).',
    },
    suggestedFix: {
      type: Type.STRING,
      description: 'Concrete, actionable fix recommendation in Vietnamese (maximum 3 sentences).',
    },
    owner: {
      type: Type.STRING,
      enum: [...VALID_OWNERS],
    },
  },
  required: ['category', 'severity', 'rootCause', 'suggestedFix', 'owner'],
};

function isInEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function buildFallbackAnalysis(failure: FailureContext, reason: string): AIAnalysisResult {
  const hasServer5xx = failure.failedRequests.some((req) => req.status >= 500);
  const hasNetworkOr4xx = failure.failedRequests.some((req) => req.status >= 400);
  const combinedError = `${failure.errorMessage}\n${failure.stackTrace}`.toLowerCase();

  let category: FailureCategory = 'ASSERTION_BUG';
  let severity: FailureSeverity = 'MEDIUM';
  let owner: FailureOwner = 'QA Automation';
  let rootCause = `Test thất bại với lỗi: ${failure.errorMessage.slice(0, 220)}. (${reason})`;
  let suggestedFix =
    'Kiểm tra lại stack trace và dữ liệu kỳ vọng trong assertion để xác định lỗi logic hoặc test data.';

  if (hasServer5xx) {
    const failedReq = failure.failedRequests.find((req) => req.status >= 500);
    category = 'BACKEND_API_ERROR';
    severity = 'CRITICAL';
    owner = 'Backend';
    rootCause = `Server trả về HTTP ${failedReq?.status ?? 500} tại ${failedReq?.url ?? 'API endpoint'}: ${failedReq?.responseBody.slice(0, 180) ?? failure.errorMessage}. (${reason})`;
    suggestedFix =
      'Kiểm tra server logs và exception handler tại endpoint gặp lỗi 5xx, sau đó bổ sung regression test cho case này.';
  } else if (
    combinedError.includes('locator') ||
    combinedError.includes('waiting for selector') ||
    combinedError.includes('element(s) not found')
  ) {
    category = 'UI_LOCATOR_CHANGED';
    severity = 'HIGH';
    owner = 'QA Automation';
    rootCause = `Không tìm thấy hoặc không tương tác được với phần tử UI trước khi hết timeout: ${failure.errorMessage.slice(0, 180)}. (${reason})`;
    suggestedFix =
      'Kiểm tra DOM thực tế trên trang hiện tại và cập nhật locator bền vững hơn (data-qa, role, label) trong Page Object.';
  } else if (hasNetworkOr4xx || combinedError.includes('net::') || combinedError.includes('503')) {
    category = 'FLAKY_OR_NETWORK';
    severity = 'MEDIUM';
    owner = 'Frontend';
    rootCause = `Phát hiện lỗi mạng hoặc HTTP >= 400 trong quá trình tải trang: ${failure.errorMessage.slice(0, 180)}. (${reason})`;
    suggestedFix =
      'Xác minh tính ổn định của endpoint/network request và cân nhắc thêm retry hoặc wait condition phù hợp.';
  }

  return {
    category,
    severity,
    rootCause,
    suggestedFix,
    owner,
  };
}

function buildPrompt(failure: FailureContext): string {
  const failedReqSummary =
    failure.failedRequests.length > 0
      ? JSON.stringify(failure.failedRequests.slice(0, 5), null, 2)
      : 'None';

  const consoleSummary =
    failure.consoleErrors.length > 0
      ? failure.consoleErrors.slice(0, 5).join('\n')
      : 'None';

  return `Bạn là một Senior SDET chuyên phân tích lỗi kiểm thử tự động Playwright.
Hãy phân tích lỗi test dưới đây và trả về JSON đúng schema yêu cầu bằng tiếng Việt (ngắn gọn, súc tích, tối đa 3 câu cho rootCause và tối đa 3 câu cho suggestedFix).

Thông tin lỗi:
- Test Title: ${failure.testTitle}
- File Path: ${failure.filePath}
- Browser: ${failure.browser}
- Current URL: ${failure.currentUrl || 'N/A'}
- Error Message:
${failure.errorMessage.slice(0, 1000)}

- Stack Trace (rút gọn):
${failure.stackTrace.slice(0, 1500)}

- Browser Console Errors:
${consoleSummary.slice(0, 800)}

- Failed HTTP Requests (status >= 400):
${failedReqSummary.slice(0, 1500)}

Hướng dẫn phân loại:
- UI_LOCATOR_CHANGED: Không tìm thấy locator, selector thay đổi, element không visible/clickable do DOM.
- BACKEND_API_ERROR: Có HTTP 5xx hoặc lỗi server/API response sai hợp đồng.
- FLAKY_OR_NETWORK: Timeout mạng, 503 queue full, race condition tạm thời.
- ASSERTION_BUG: Dữ liệu/trạng thái thực tế khác với assertion mong đợi do bug nghiệp vụ hoặc test assertion.`;
}

function normalizeAnalysis(raw: unknown, failure: FailureContext): AIAnalysisResult {
  if (typeof raw !== 'object' || raw === null) {
    return buildFallbackAnalysis(failure, 'Invalid JSON object from Gemini');
  }

  const record = raw as Record<string, unknown>;
  if (
    !isInEnum(record.category, VALID_CATEGORIES) ||
    !isInEnum(record.severity, VALID_SEVERITIES) ||
    !isInEnum(record.owner, VALID_OWNERS) ||
    typeof record.rootCause !== 'string' ||
    typeof record.suggestedFix !== 'string' ||
    record.rootCause.trim().length === 0 ||
    record.suggestedFix.trim().length === 0
  ) {
    return buildFallbackAnalysis(failure, 'Incomplete schema fields from Gemini');
  }

  return {
    category: record.category,
    severity: record.severity,
    rootCause: record.rootCause.trim(),
    suggestedFix: record.suggestedFix.trim(),
    owner: record.owner,
  };
}

/**
 * Analyzes a single test failure using Gemini 2.5 Flash with Structured JSON Output.
 * Falls back gracefully to deterministic heuristics if GEMINI_API_KEY is missing or the API fails.
 */
export async function analyzeFailure(failure: FailureContext): Promise<AIAnalysisResult> {
  if (!hasEnvValue(env.geminiApiKey)) {
    console.warn(
      `[AI Triage] GEMINI_API_KEY is not configured. Using deterministic fallback triage for "${failure.testTitle}".`,
    );
    return buildFallbackAnalysis(failure, 'Fallback: chưa cấu hình GEMINI_API_KEY');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(failure),
      config: {
        responseMimeType: 'application/json',
        responseSchema: TRIAGE_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text?.trim() ?? '';
    if (!text) {
      return buildFallbackAnalysis(failure, 'Fallback: Gemini trả về phản hồi rỗng');
    }

    const parsed: unknown = JSON.parse(text);
    return normalizeAnalysis(parsed, failure);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[AI Triage] Gemini API error for "${failure.testTitle}": ${message}. Falling back to heuristic triage.`,
    );
    return buildFallbackAnalysis(failure, 'Fallback: gọi Gemini API thất bại');
  }
}

/**
 * Analyzes all failed tests sequentially to avoid bursting Gemini API rate limits.
 */
export async function analyzeFailures(
  failures: readonly FailureContext[],
): Promise<TriagedFailure[]> {
  const results: TriagedFailure[] = [];

  for (const context of failures) {
    const analysis = await analyzeFailure(context);
    results.push({ context, analysis });
  }

  return results;
}
