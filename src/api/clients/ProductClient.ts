import { type APIRequestContext } from '@playwright/test';
import { type ApiMessageResponse, type ApiResponse, BaseApiClient } from './BaseApiClient';

export interface ProductCategory {
  readonly usertype: {
    readonly usertype: string;
  };
  readonly category: string;
}

export interface ProductItem {
  readonly id: number;
  readonly name: string;
  readonly price: string;
  readonly brand: string;
  readonly category: ProductCategory;
}

export interface ProductsListResponse {
  readonly responseCode: number;
  readonly products: ProductItem[];
}

export type SearchProductResponse = ProductsListResponse | ApiMessageResponse;

export class ProductClient extends BaseApiClient {
  constructor(request: APIRequestContext, baseUrl?: string) {
    super(request, baseUrl);
  }

  async getAllProducts(): Promise<ApiResponse<ProductsListResponse>> {
    return this.execute<ProductsListResponse>('GET', '/api/productsList');
  }

  async postProductsList(): Promise<ApiResponse<ApiMessageResponse>> {
    return this.execute<ApiMessageResponse>('POST', '/api/productsList');
  }

  async searchProducts(searchTerm?: string): Promise<ApiResponse<SearchProductResponse>> {
    const form = searchTerm !== undefined ? { search_product: searchTerm } : undefined;
    return this.execute<SearchProductResponse>('POST', '/api/searchProduct', { form });
  }
}
