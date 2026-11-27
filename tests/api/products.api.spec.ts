import { expect, test } from '@playwright/test';
import { ProductClient, type ProductsListResponse } from '../../src/api/clients/ProductClient';
import productsListSchema from '../../src/api/schemas/productsList.schema.json';
import { validateSchema } from '../../src/utils/schemaValidator';
import { env } from '../../src/utils/env';

test.describe('Products API @api', () => {
  test('GET /api/productsList returns valid product catalog within SLA', async ({ request }) => {
    const productClient = new ProductClient(request, env.baseUrl);
    // Warm up TLS/connection so timing reflects API latency rather than cold handshake
    await productClient.getAllProducts();

    const response = await productClient.getAllProducts();

    expect(response.status).toBe(200);
    expect(response.responseTimeMs).toBeLessThan(2000);

    const validated = validateSchema<ProductsListResponse>(
      productsListSchema,
      response.body,
      'productsList',
    );
    expect(validated.responseCode).toBe(200);
    expect(validated.products.length).toBeGreaterThan(0);
  });

  test('POST /api/searchProduct returns matching products for a valid keyword', async ({
    request,
  }) => {
    const productClient = new ProductClient(request, env.baseUrl);
    // Warm up TLS/connection before measuring API response SLA
    await productClient.getAllProducts();

    const response = await productClient.searchProducts('top');

    expect(response.status).toBe(200);
    expect(response.responseTimeMs).toBeLessThan(2000);

    const validated = validateSchema<ProductsListResponse>(
      productsListSchema,
      response.body,
      'searchProductsList',
    );
    expect(validated.responseCode).toBe(200);
    expect(
      validated.products.some((product) => product.name.toLowerCase().includes('top')),
    ).toBe(true);
  });

  test('POST /api/productsList rejects unsupported HTTP method (405)', async ({ request }) => {
    const productClient = new ProductClient(request, env.baseUrl);
    const response = await productClient.postProductsList();

    expect(response.status).toBe(200);
    expect(response.body.responseCode).toBe(405);
    expect(response.body.message).toContain('This request method is not supported');
  });

  test('POST /api/searchProduct without search_product param returns 400', async ({
    request,
  }) => {
    const productClient = new ProductClient(request, env.baseUrl);
    const response = await productClient.searchProducts();

    expect(response.status).toBe(200);
    expect(response.body.responseCode).toBe(400);
    if ('message' in response.body) {
      expect(response.body.message).toContain('search_product parameter is missing');
    } else {
      throw new Error('Expected error message in searchProduct negative response');
    }
  });
});
