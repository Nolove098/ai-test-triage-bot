import { type Locator, type Page } from '@playwright/test';

const AD_HOSTS: readonly string[] = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'adservice.google.com',
  'adtrafficquality.google',
  'fundingchoicesmessages.google.com',
];

const initializedPages = new WeakSet<Page>();

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Registers ad-network blockers and Playwright locator handlers once per Page
   * so cookie consent dialogs and Google Vignette ad popups cannot hijack E2E flows.
   */
  protected async registerPageProtections(): Promise<void> {
    if (initializedPages.has(this.page)) {
      return;
    }
    initializedPages.add(this.page);

    await this.page.route(
      (url) => AD_HOSTS.some((host) => url.hostname.includes(host)),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: '',
        });
      },
    );

    const consentButton = this.page.locator('button.fc-cta-consent');
    await this.page.addLocatorHandler(consentButton, async (locator) => {
      await locator.click({ force: true }).catch(() => undefined);
    });
  }

  /**
   * Navigates to a relative path (or full URL) and ensures overlays and transient
   * SUT 503 queue-full pages do not block interaction.
   */
  async goto(path = '/'): Promise<void> {
    await this.registerPageProtections();
    await this.navigateWithQueueRecovery(async () => {
      await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    });
    await this.dismissConsentIfVisible();
  }

  /**
   * Executes a navigation action and recovers from Automation Exercise's
   * transient 503 "website is under heavy load (queue full)" response.
   */
  protected async navigateWithQueueRecovery(action: () => Promise<void>): Promise<void> {
    await action();
    await this.page.waitForLoadState('domcontentloaded');

    const queueFullHeading = this.page.getByRole('heading', {
      name: /website is under heavy load/i,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const isQueueFull = await queueFullHeading.isVisible().catch(() => false);
      if (!isQueueFull) {
        return;
      }
      await this.page.reload({ waitUntil: 'domcontentloaded' });
    }
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
   * Waits for the DOM readiness state without using hard waits.
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
