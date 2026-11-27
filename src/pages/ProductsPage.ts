import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductsPage extends BasePage {
  private readonly allProductsHeading: Locator;
  private readonly searchedProductsHeading: Locator;
  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  private readonly productTitles: Locator;
  private readonly productCards: Locator;
  private readonly cartModal: Locator;
  private readonly viewCartLink: Locator;
  private readonly continueShoppingButton: Locator;

  constructor(page: Page) {
    super(page);
    this.allProductsHeading = page.getByRole('heading', { name: 'All Products' });
    this.searchedProductsHeading = page.getByRole('heading', { name: 'Searched Products' });
    this.searchInput = page.getByPlaceholder('Search Product');
    this.searchButton = page.locator('#submit_search');
    this.productTitles = page.locator('.features_items .productinfo p');
    this.productCards = page.locator('.features_items .product-image-wrapper');
    this.cartModal = page.locator('#cartModal');
    this.viewCartLink = this.cartModal.getByRole('link', { name: 'View Cart' });
    this.continueShoppingButton = this.cartModal.getByRole('button', {
      name: 'Continue Shopping',
    });
  }

  async gotoProducts(): Promise<void> {
    await this.goto('/products');
    await expect(this.allProductsHeading).toBeVisible();
  }

  async searchProduct(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.navigateWithQueueRecovery(async () => {
      await Promise.all([
        this.page.waitForURL(
          (url) => url.pathname === '/products' && url.searchParams.has('search'),
        ),
        this.searchButton.click(),
      ]);
    });
    await expect(this.searchedProductsHeading).toBeVisible();
  }

  async getDisplayedProductNames(): Promise<string[]> {
    const names = await this.productTitles.allTextContents();
    return names.map((name) => name.trim()).filter((name) => name.length > 0);
  }

  async expectSearchMatches(expectedProduct: string, minCount: number): Promise<void> {
    const names = await this.getDisplayedProductNames();
    expect(names.length).toBeGreaterThanOrEqual(minCount);

    if (expectedProduct.trim().length > 0) {
      const hasMatch = names.some((name) =>
        name.toLowerCase().includes(expectedProduct.toLowerCase()),
      );
      expect(hasMatch).toBe(true);
    }
  }

  async expectNoProductsDisplayed(): Promise<void> {
    await expect(this.productTitles).toHaveCount(0);
  }

  async addFirstProductToCart(): Promise<string> {
    const firstCard = this.productCards.first();
    await expect(firstCard).toBeVisible();
    await this.scrollIntoView(firstCard);

    // Ensure jQuery & /static/js/cart.js click handlers have executed before clicking add-to-cart
    await this.page.waitForLoadState('load').catch(() => undefined);

    const productName = (await firstCard.locator('.productinfo p').textContent())?.trim() ?? '';
    const addToCartLink = firstCard.locator('.productinfo a.add-to-cart');
    await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().includes('/add_to_cart/') && res.status() < 400,
      ),
      addToCartLink.click(),
    ]);
    await expect(this.cartModal).toBeVisible();
    return productName;
  }

  async clickViewCartInModal(): Promise<void> {
    await expect(this.viewCartLink).toBeVisible();
    await this.viewCartLink.click();
  }

  async clickContinueShoppingInModal(): Promise<void> {
    await expect(this.continueShoppingButton).toBeVisible();
    await this.continueShoppingButton.click();
    await expect(this.cartModal).toBeHidden();
  }
}
