import { test } from '../../src/fixtures/base.fixture';
import { type PaymentDetails } from '../../src/pages/CheckoutPage';

const TEST_PAYMENT: PaymentDetails = {
  nameOnCard: 'QA Automation User',
  cardNumber: '4111111111111111',
  cvc: '311',
  expiryMonth: '12',
  expiryYear: '2029',
};

test.describe('Hybrid E2E Checkout Flow @hybrid', () => {
  test('API Create User -> UI Login & Checkout -> API Delete User', async ({
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
    await productsPage.searchProduct('Blue Top');
    const addedProductName = await productsPage.addFirstProductToCart();
    await productsPage.clickViewCartInModal();

    await cartPage.expectProductInCart(addedProductName);
    await cartPage.proceedToCheckout();

    await checkoutPage.expectDeliveryAddressContains(registeredUser.city);
    await checkoutPage.expectDeliveryAddressContains(registeredUser.address1);
    await checkoutPage.enterOrderComment('Hybrid API+UI E2E automated checkout verification');
    await checkoutPage.clickPlaceOrder();

    await checkoutPage.fillPaymentDetails({
      ...TEST_PAYMENT,
      nameOnCard: registeredUser.name,
    });
    await checkoutPage.confirmOrder();
    await checkoutPage.expectOrderConfirmed();
  });
});
