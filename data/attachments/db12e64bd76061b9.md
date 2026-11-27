# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui/search-filter.spec.ts >> Product Search & Filter UI @ui >> Search keyword "Blue Top" returns expected results
- Location: tests/ui/search-filter.spec.ts:15:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'All Products' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'All Products' }) with timeout 10000ms
  - waiting for getByRole('heading', { name: 'All Products' })

```

# Test source

```ts
  1   | import { expect, type Locator, type Page } from '@playwright/test';
  2   | import { BasePage } from './BasePage';
  3   | 
  4   | export class ProductsPage extends BasePage {
  5   |   private readonly allProductsHeading: Locator;
  6   |   private readonly searchedProductsHeading: Locator;
  7   |   private readonly searchInput: Locator;
  8   |   private readonly searchButton: Locator;
  9   |   private readonly productTitles: Locator;
  10  |   private readonly productCards: Locator;
  11  |   private readonly cartModal: Locator;
  12  |   private readonly viewCartLink: Locator;
  13  |   private readonly continueShoppingButton: Locator;
  14  | 
  15  |   constructor(page: Page) {
  16  |     super(page);
  17  |     this.allProductsHeading = page.getByRole('heading', { name: 'All Products' });
  18  |     this.searchedProductsHeading = page.getByRole('heading', { name: 'Searched Products' });
  19  |     this.searchInput = page.getByPlaceholder('Search Product');
  20  |     this.searchButton = page.locator('#submit_search');
  21  |     this.productTitles = page.locator('.features_items .productinfo p');
  22  |     this.productCards = page.locator('.features_items .product-image-wrapper');
  23  |     this.cartModal = page.locator('#cartModal');
  24  |     this.viewCartLink = this.cartModal.getByRole('link', { name: 'View Cart' });
  25  |     this.continueShoppingButton = this.cartModal.getByRole('button', {
  26  |       name: 'Continue Shopping',
  27  |     });
  28  |   }
  29  | 
  30  |   async gotoProducts(): Promise<void> {
  31  |     await this.goto('/products');
> 32  |     await expect(this.allProductsHeading).toBeVisible();
      |                                           ^ Error: expect(locator).toBeVisible() failed
  33  |   }
  34  | 
  35  |   async searchProduct(keyword: string): Promise<void> {
  36  |     await this.searchInput.fill(keyword);
  37  |     await this.navigateWithQueueRecovery(async () => {
  38  |       await Promise.all([
  39  |         this.page.waitForURL(
  40  |           (url) => url.pathname === '/products' && url.searchParams.has('search'),
  41  |         ),
  42  |         this.searchButton.click(),
  43  |       ]);
  44  |     });
  45  |     await expect(this.searchedProductsHeading).toBeVisible();
  46  |   }
  47  | 
  48  |   async getDisplayedProductNames(): Promise<string[]> {
  49  |     const names = await this.productTitles.allTextContents();
  50  |     return names.map((name) => name.trim()).filter((name) => name.length > 0);
  51  |   }
  52  | 
  53  |   async expectSearchMatches(expectedProduct: string, minCount: number): Promise<void> {
  54  |     const names = await this.getDisplayedProductNames();
  55  |     expect(names.length).toBeGreaterThanOrEqual(minCount);
  56  | 
  57  |     if (expectedProduct.trim().length > 0) {
  58  |       const hasMatch = names.some((name) =>
  59  |         name.toLowerCase().includes(expectedProduct.toLowerCase()),
  60  |       );
  61  |       expect(hasMatch).toBe(true);
  62  |     }
  63  |   }
  64  | 
  65  |   async expectNoProductsDisplayed(): Promise<void> {
  66  |     await expect(this.productTitles).toHaveCount(0);
  67  |   }
  68  | 
  69  |   async addFirstProductToCart(): Promise<string> {
  70  |     const firstCard = this.productCards.first();
  71  |     await expect(firstCard).toBeVisible();
  72  |     await this.scrollIntoView(firstCard);
  73  | 
  74  |     // Ensure jQuery & /static/js/cart.js click handlers have executed before clicking add-to-cart
  75  |     await this.page.waitForLoadState('load').catch(() => undefined);
  76  | 
  77  |     const productName = (await firstCard.locator('.productinfo p').textContent())?.trim() ?? '';
  78  |     const addToCartLink = firstCard.locator('.productinfo a.add-to-cart');
  79  |     await Promise.all([
  80  |       this.page.waitForResponse(
  81  |         (res) => res.url().includes('/add_to_cart/') && res.status() < 400,
  82  |       ),
  83  |       addToCartLink.click(),
  84  |     ]);
  85  |     await expect(this.cartModal).toBeVisible();
  86  |     return productName;
  87  |   }
  88  | 
  89  |   async clickViewCartInModal(): Promise<void> {
  90  |     await expect(this.viewCartLink).toBeVisible();
  91  |     await this.viewCartLink.click();
  92  |   }
  93  | 
  94  |   async clickContinueShoppingInModal(): Promise<void> {
  95  |     await expect(this.continueShoppingButton).toBeVisible();
  96  |     await this.continueShoppingButton.click();
  97  |     await expect(this.cartModal).toBeHidden();
  98  |   }
  99  | }
  100 | 
```