import { test } from '../../src/fixtures/base.fixture';

test.describe('Intentional Failures Demo for AI Triage @demo-fail', () => {
  test.describe.configure({ retries: 0 });

  test('Backend API 500 error during checkout transition @demo-fail', async ({
    page,
    registeredUser,
    homePage,
    loginPage,
    productsPage,
    cartPage,
    checkoutPage,
  }) => {
    await loginPage.gotoLogin();
    await loginPage.login(registeredUser.email, registeredUser.password);
    await homePage.expectLoggedInAs(registeredUser.name);

    await productsPage.gotoProducts();
    const productName = await productsPage.addFirstProductToCart();
    await productsPage.clickViewCartInModal();
    await cartPage.expectProductInCart(productName);

    // Simulate a backend 500 Internal Server Error on /checkout
    await page.route('**/checkout', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'NullPointerException in PaymentService' }),
      });
    });

    await cartPage.proceedToCheckout();
    await checkoutPage.expectDeliveryAddressContains(registeredUser.city, 4000);
  });

  test('UI locator changed on checkout CTA button @demo-fail', async ({
    productsPage,
    cartPage,
  }) => {
    await productsPage.gotoProducts();
    const productName = await productsPage.addFirstProductToCart();
    await productsPage.clickViewCartInModal();
    await cartPage.expectProductInCart(productName);

    // Intentionally attempt to click a non-existent locator with a 3000ms timeout
    await cartPage.clickNonExistentCheckoutButton(3000);
  });
});
