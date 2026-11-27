import { type APIRequestContext, type APIResponse } from '@playwright/test';

export interface ApiResponse<T> {
  readonly status: number;
  readonly responseTimeMs: number;
  readonly rawBody: string;
  readonly body: T;
}

export interface ApiMessageResponse {
  readonly responseCode: number;
  readonly message: string;
}

type RequestOptions = {
  readonly form?: Record<string, string>;
  readonly params?: Record<string, string>;
};

/**
 * Base API client handling Automation Exercise's JSON-inside-text/html
 * responses and accurate per-request timing measurement.
 */
export abstract class BaseApiClient {
  protected readonly request: APIRequestContext;
  protected readonly baseUrl: string;

  constructor(request: APIRequestContext, baseUrl = 'https://automationexercise.com') {
    this.request = request;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  protected async execute<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = performance.now();
      const response = await this.sendRequest(method, url, options);
      const rawBody = await response.text();
      const responseTimeMs = Math.round(performance.now() - startedAt);

      if (
        response.status() === 503 &&
        rawBody.includes('under heavy load') &&
        attempt < maxAttempts
      ) {
        continue;
      }

      const parsedBody = this.parseJsonSafely<T>(rawBody, method, url, response.status());

      return {
        status: response.status(),
        responseTimeMs,
        rawBody,
        body: parsedBody,
      };
    }

    throw new Error(`Exceeded max attempts for ${method} ${url}`);
  }

  private async sendRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    options: RequestOptions,
  ): Promise<APIResponse> {
    switch (method) {
      case 'GET':
        return this.request.get(url, { params: options.params });
      case 'POST':
        return this.request.post(url, { form: options.form, params: options.params });
      case 'PUT':
        return this.request.put(url, { form: options.form, params: options.params });
      case 'DELETE':
        return this.request.delete(url, { form: options.form, params: options.params });
    }
  }

  private parseJsonSafely<T>(
    rawBody: string,
    method: string,
    url: string,
    status: number,
  ): T {
    const trimmed = rawBody.trim();
    try {
      return JSON.parse(trimmed) as T;
    } catch (error) {
      const preview = trimmed.slice(0, 300);
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse JSON response from ${method} ${url} (HTTP ${status}): ${reason}\nBody preview: ${preview}`,
      );
    }
  }
}
