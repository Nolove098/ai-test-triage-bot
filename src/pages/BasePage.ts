import { type Locator, type Page } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;
  private consentHandlerRegistered = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Registers Playwright locator handlers to automatically dismiss
   * cookie consent modals and ad overlays when they intercept clicks.
   */
  protected async registerOverlayHandlers(): Promise<void> {
    if (this.consentHandlerRegistered) {
      return;
    }
    this.consentHandlerRegistered = true;

    const consentButton = this.page.locator('button.fc-cta-consent');
    await this.page.addLocatorHandler(consentButton, async (locator) => {
      await locator.click({ force: true }).catch(() => undefined);
    });
  }

  /**
   * Navigates to a relative path (or full URL) and ensures overlays do not block interaction.
   */
  async goto(path = '/'): Promise<void> {
    await this.registerOverlayHandlers();
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.dismissConsentIfVisible();
  }

  /**
   * Proactively dismisses the cookie consent popup if already visible on page load.
   */
  async dismissConsentIfVisible(): Promise<void> {
    const consentButton = this.page.locator('button.fc-cta-consent').first();
    const isVisible = await consentButton.isVisible().catch(() => false);
    if (isVisible) {
      await consentButton.click({ force: true }).catch(() => undefined);
    }
  }

  /**
   * Waits for the DOM and basic page readiness without using hard waits.
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Scrolls a target element into view safely before asserting or interacting.
   */
  protected async scrollIntoView(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }
}
