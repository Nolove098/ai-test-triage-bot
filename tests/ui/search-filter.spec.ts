import { test } from '../../src/fixtures/base.fixture';
import searchData from '../../src/test-data/searchData.json';

interface SearchTestCase {
  readonly keyword: string;
  readonly expectedProduct: string;
  readonly minResults: number;
  readonly expectEmpty: boolean;
}

const cases: readonly SearchTestCase[] = searchData;

test.describe('Product Search & Filter UI @ui', () => {
  for (const testCase of cases) {
    test(`Search keyword "${testCase.keyword}" returns expected results`, async ({
      productsPage,
    }) => {
      await productsPage.gotoProducts();
      await productsPage.searchProduct(testCase.keyword);

      if (testCase.expectEmpty) {
        await productsPage.expectNoProductsDisplayed();
      } else {
        await productsPage.expectSearchMatches(testCase.expectedProduct, testCase.minResults);
      }
    });
  }
});
