import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  private readonly loginNavLink: Locator;
  private readonly productsNavLink: Locator;
  private readonly cartNavLink: Locator;
  private readonly logoutNavLink: Locator;
  private readonly loggedInText: Locator;
  private readonly heroHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.loginNavLink = page.getByRole('link', { name: /Signup \/ Login/i });
    this.productsNavLink = page.locator('header').getByRole('link', { name: /Products/i });
    this.cartNavLink = page.locator('header').getByRole('link', { name: /Cart/i });
    this.logoutNavLink = page.getByRole('link', { name: /Logout/i });
    this.loggedInText = page.locator('header').getByText(/Logged in as/i);
    this.heroHeading = page.getByRole('heading', { name: /AutomationExercise/i }).first();
  }

  async gotoHome(): Promise<void> {
    await this.goto('/');
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.heroHeading).toBeVisible();
  }

  async goToLogin(): Promise<void> {
    await this.loginNavLink.click();
  }

  async goToProducts(): Promise<void> {
    await this.productsNavLink.click();
  }

  async goToCart(): Promise<void> {
    await this.cartNavLink.click();
  }

  async logout(): Promise<void> {
    await this.logoutNavLink.click();
  }

  async expectLoggedInAs(userName: string): Promise<void> {
    await expect(this.loggedInText).toBeVisible();
    await expect(this.loggedInText).toContainText(userName);
  }
}
