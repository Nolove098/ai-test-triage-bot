import { type APIRequestContext } from '@playwright/test';
import { type UserProfile } from '../../test-data/dataGenerator';
import { type ApiMessageResponse, type ApiResponse, BaseApiClient } from './BaseApiClient';

export interface UserDetail {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly title?: string;
  readonly birth_day?: string;
  readonly birth_month?: string;
  readonly birth_year?: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly company?: string;
  readonly address1?: string;
  readonly address2?: string;
  readonly country: string;
  readonly state?: string;
  readonly city?: string;
  readonly zipcode?: string;
}

export interface UserDetailResponse {
  readonly responseCode: number;
  readonly user: UserDetail;
}

export class AuthClient extends BaseApiClient {
  constructor(request: APIRequestContext, baseUrl?: string) {
    super(request, baseUrl);
  }

  async createAccount(user: UserProfile): Promise<ApiResponse<ApiMessageResponse>> {
    return this.execute<ApiMessageResponse>('POST', '/api/createAccount', {
      form: {
        name: user.name,
        email: user.email,
        password: user.password,
        title: user.title,
        birth_date: user.birthDate,
        birth_month: user.birthMonth,
        birth_year: user.birthYear,
        firstname: user.firstName,
        lastname: user.lastName,
        company: user.company,
        address1: user.address1,
        address2: user.address2,
        country: user.country,
        zipcode: user.zipcode,
        state: user.state,
        city: user.city,
        mobile_number: user.mobileNumber,
      },
    });
  }

  async verifyLogin(
    email?: string,
    password?: string,
  ): Promise<ApiResponse<ApiMessageResponse>> {
    const form: Record<string, string> = {};
    if (email !== undefined) {
      form.email = email;
    }
    if (password !== undefined) {
      form.password = password;
    }

    return this.execute<ApiMessageResponse>('POST', '/api/verifyLogin', {
      form: Object.keys(form).length > 0 ? form : undefined,
    });
  }

  async getUserDetailByEmail(email: string): Promise<ApiResponse<UserDetailResponse>> {
    return this.execute<UserDetailResponse>('GET', '/api/getUserDetailByEmail', {
      params: { email },
    });
  }

  async deleteAccount(
    email: string,
    password: string,
  ): Promise<ApiResponse<ApiMessageResponse>> {
    return this.execute<ApiMessageResponse>('DELETE', '/api/deleteAccount', {
      form: { email, password },
    });
  }
}
