import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface PaymentDetails {
  readonly nameOnCard: string;
  readonly cardNumber: string;
  readonly cvc: string;
  readonly expiryMonth: string;
  readonly expiryYear: string;
}

export class CheckoutPage extends BasePage {
  private readonly deliveryAddressBox: Locator;
  private readonly commentTextarea: Locator;
  private readonly placeOrderLink: Locator;
  private readonly nameOnCardInput: Locator;
  private readonly cardNumberInput: Locator;
  private readonly cvcInput: Locator;
  private readonly expiryMonthInput: Locator;
  private readonly expiryYearInput: Locator;
  private readonly payAndConfirmButton: Locator;
  private readonly orderPlacedHeading: Locator;
  private readonly orderConfirmedText: Locator;

  constructor(page: Page) {
    super(page);
    this.deliveryAddressBox = page.locator('#address_delivery');
    this.commentTextarea = page.locator('textarea[name="message"]');
    this.placeOrderLink = page.getByRole('link', { name: 'Place Order' });
    this.nameOnCardInput = page.locator('[data-qa="name-on-card"]');
    this.cardNumberInput = page.locator('[data-qa="card-number"]');
    this.cvcInput = page.locator('[data-qa="cvc"]');
    this.expiryMonthInput = page.locator('[data-qa="expiry-month"]');
    this.expiryYearInput = page.locator('[data-qa="expiry-year"]');
    this.payAndConfirmButton = page.locator('[data-qa="pay-button"]');
    this.orderPlacedHeading = page.locator('[data-qa="order-placed"]');
    this.orderConfirmedText = page.getByText(
      'Congratulations! Your order has been confirmed!',
    );
  }

  async expectDeliveryAddressContains(expectedText: string, timeoutMs?: number): Promise<void> {
    await expect(this.deliveryAddressBox).toBeVisible({ timeout: timeoutMs });
    await expect(this.deliveryAddressBox).toContainText(expectedText, { timeout: timeoutMs });
  }

  async enterOrderComment(comment: string): Promise<void> {
    await this.scrollIntoView(this.commentTextarea);
    await this.commentTextarea.fill(comment);
  }

  async clickPlaceOrder(): Promise<void> {
    await this.scrollIntoView(this.placeOrderLink);
    await this.placeOrderLink.click();
  }

  async fillPaymentDetails(payment: PaymentDetails): Promise<void> {
    await expect(this.nameOnCardInput).toBeVisible();
    await this.nameOnCardInput.fill(payment.nameOnCard);
    await this.cardNumberInput.fill(payment.cardNumber);
    await this.cvcInput.fill(payment.cvc);
    await this.expiryMonthInput.fill(payment.expiryMonth);
    await this.expiryYearInput.fill(payment.expiryYear);
  }

  async confirmOrder(): Promise<void> {
    await this.payAndConfirmButton.click();
  }

  async expectOrderConfirmed(): Promise<void> {
    await expect(this.orderPlacedHeading).toBeVisible();
    await expect(this.orderConfirmedText).toBeVisible();
  }
}
