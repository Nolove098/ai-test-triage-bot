import { expect, test } from '@playwright/test';
import { AuthClient, type UserDetailResponse } from '../../src/api/clients/AuthClient';
import { type ApiMessageResponse } from '../../src/api/clients/BaseApiClient';
import createAccountSchema from '../../src/api/schemas/createAccount.schema.json';
import userDetailSchema from '../../src/api/schemas/userDetail.schema.json';
import { generateUserProfile, type UserProfile } from '../../src/test-data/dataGenerator';
import { env } from '../../src/utils/env';
import { validateSchema } from '../../src/utils/schemaValidator';

test.describe('Auth API @api', () => {
  let createdUsers: UserProfile[] = [];

  test.beforeEach(() => {
    createdUsers = [];
  });

  test.afterEach(async ({ request }) => {
    const authClient = new AuthClient(request, env.baseUrl);
    for (const user of createdUsers) {
      await authClient.deleteAccount(user.email, user.password).catch(() => undefined);
    }
  });

  test('Full account lifecycle: create -> verify -> fetch detail -> delete', async ({
    request,
  }) => {
    const authClient = new AuthClient(request, env.baseUrl);
    const user = generateUserProfile();

    const createResponse = await authClient.createAccount(user);
    expect(createResponse.status).toBe(200);
    const createdBody = validateSchema<ApiMessageResponse>(
      createAccountSchema,
      createResponse.body,
      'createAccount',
    );
    expect(createdBody.responseCode).toBe(201);
    expect(createdBody.message).toBe('User created!');
    createdUsers.push(user);

    const loginResponse = await authClient.verifyLogin(user.email, user.password);
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.responseTimeMs).toBeLessThan(2000);
    expect(loginResponse.body.responseCode).toBe(200);
    expect(loginResponse.body.message).toBe('User exists!');

    const detailResponse = await authClient.getUserDetailByEmail(user.email);
    expect(detailResponse.status).toBe(200);
    const detailBody = validateSchema<UserDetailResponse>(
      userDetailSchema,
      detailResponse.body,
      'userDetail',
    );
    expect(detailBody.responseCode).toBe(200);
    expect(detailBody.user.email).toBe(user.email);
    expect(detailBody.user.first_name).toBe(user.firstName);

    const deleteResponse = await authClient.deleteAccount(user.email, user.password);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.responseCode).toBe(200);
    expect(deleteResponse.body.message).toBe('Account deleted!');
    createdUsers = [];
  });

  test('POST /api/createAccount rejects duplicate email registration (400)', async ({
    request,
  }) => {
    const authClient = new AuthClient(request, env.baseUrl);
    const user = generateUserProfile();

    const firstCreate = await authClient.createAccount(user);
    expect(firstCreate.body.responseCode).toBe(201);
    createdUsers.push(user);

    const duplicateCreate = await authClient.createAccount(user);
    expect(duplicateCreate.status).toBe(200);
    const body = validateSchema<ApiMessageResponse>(
      createAccountSchema,
      duplicateCreate.body,
      'createAccountDuplicate',
    );
    expect(body.responseCode).toBe(400);
    expect(body.message).toBe('Email already exists!');
  });

  test('POST /api/verifyLogin returns 404 for non-existent user', async ({ request }) => {
    const authClient = new AuthClient(request, env.baseUrl);
    const ghostUser = generateUserProfile();

    const response = await authClient.verifyLogin(ghostUser.email, 'WrongPassword123!');
    expect(response.status).toBe(200);
    expect(response.body.responseCode).toBe(404);
    expect(response.body.message).toBe('User not found!');
  });

  test('POST /api/verifyLogin returns 400 when email parameter is missing', async ({
    request,
  }) => {
    const authClient = new AuthClient(request, env.baseUrl);

    const response = await authClient.verifyLogin(undefined, 'SomePassword123!');
    expect(response.status).toBe(200);
    expect(response.body.responseCode).toBe(400);
    expect(response.body.message).toContain('email or password parameter is missing');
  });
});
