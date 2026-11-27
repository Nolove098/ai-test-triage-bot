import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  private readonly cartTable: Locator;
  private readonly cartProductLinks: Locator;
  private readonly proceedToCheckoutButton: Locator;
  private readonly nonExistentCheckoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.cartTable = page.locator('#cart_info_table');
    this.cartProductLinks = page.locator('#cart_info_table tbody td.cart_description h4 a');
    this.proceedToCheckoutButton = page.locator('a.check_out');
    this.nonExistentCheckoutButton = page.locator('#non-existent-checkout-btn');
  }

  async gotoCart(): Promise<void> {
    await this.goto('/view_cart');
  }

  async expectProductInCart(productName: string): Promise<void> {
    await expect(this.cartTable).toBeVisible();
    await expect(this.cartProductLinks.filter({ hasText: productName }).first()).toBeVisible();
  }

  async proceedToCheckout(): Promise<void> {
    await expect(this.proceedToCheckoutButton).toBeVisible();
    await this.proceedToCheckoutButton.click();
  }

  /**
   * Intentionally attempts to click a missing locator to simulate
   * a broken UI selector in the @demo-fail triage suite.
   */
  async clickNonExistentCheckoutButton(timeoutMs = 3000): Promise<void> {
    await this.nonExistentCheckoutButton.click({ timeout: timeoutMs });
  }
}
