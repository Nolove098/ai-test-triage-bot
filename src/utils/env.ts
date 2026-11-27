import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  readonly baseUrl: string;
  readonly geminiApiKey: string;
  readonly discordWebhookUrl: string;
  readonly allureReportUrl: string;
  readonly githubRunUrl: string;
}

const DEFAULT_BASE_URL = 'https://automationexercise.com';

function validateUrl(rawValue: string, varName: string): string {
  try {
    const parsed = new URL(rawValue);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid URL configured for ${varName}: "${rawValue}"`);
  }
}

function getOptionalUrl(varName: string): string {
  const value = process.env[varName]?.trim() ?? '';
  if (!value) {
    return '';
  }
  return validateUrl(value, varName);
}

function loadEnvConfig(): EnvConfig {
  const rawBaseUrl = process.env.BASE_URL?.trim() || DEFAULT_BASE_URL;

  return {
    baseUrl: validateUrl(rawBaseUrl, 'BASE_URL'),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
    discordWebhookUrl: getOptionalUrl('DISCORD_WEBHOOK_URL'),
    allureReportUrl: getOptionalUrl('ALLURE_REPORT_URL'),
    githubRunUrl: getOptionalUrl('GITHUB_RUN_URL'),
  };
}

export const env: EnvConfig = loadEnvConfig();

export function hasEnvValue(value: string): boolean {
  return value.trim().length > 0;
}
