import { expect } from '@playwright/test';
import { AuthClient } from '../api/clients/AuthClient';
import { ProductClient } from '../api/clients/ProductClient';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ProductsPage } from '../pages/ProductsPage';
import { generateUserProfile, type UserProfile } from '../test-data/dataGenerator';
import { env } from '../utils/env';
import { test as contextCollectorTest } from './contextCollector.fixture';

export type FrameworkFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  productsPage: ProductsPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  authClient: AuthClient;
  productClient: ProductClient;
  registeredUser: UserProfile;
};

export const test = contextCollectorTest.extend<FrameworkFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request, env.baseUrl));
  },
  productClient: async ({ request }, use) => {
    await use(new ProductClient(request, env.baseUrl));
  },
  registeredUser: async ({ authClient }, use) => {
    const user = generateUserProfile();
    const createRes = await authClient.createAccount(user);
    expect(createRes.body.responseCode).toBe(201);

    try {
      await use(user);
    } finally {
      await authClient.deleteAccount(user.email, user.password).catch(() => undefined);
    }
  },
});

export { expect };
