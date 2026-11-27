import { faker } from '@faker-js/faker';

export type UserTitle = 'Mr' | 'Mrs';

export type SupportedCountry =
  | 'India'
  | 'United States'
  | 'Canada'
  | 'Australia'
  | 'Israel'
  | 'New Zealand'
  | 'Singapore';

export interface UserProfile {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly title: UserTitle;
  readonly birthDate: string;
  readonly birthMonth: string;
  readonly birthYear: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly company: string;
  readonly address1: string;
  readonly address2: string;
  readonly country: SupportedCountry;
  readonly state: string;
  readonly city: string;
  readonly zipcode: string;
  readonly mobileNumber: string;
}

const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = [
  'United States',
  'Canada',
  'Australia',
  'Singapore',
];

const MONTHS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Generates a unique, parallel-safe user profile compatible with both
 * Automation Exercise API registration and UI checkout forms.
 */
export function generateUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const firstName = faker.person.firstName().replace(/[^a-zA-Z]/g, '') || 'Alex';
  const lastName = faker.person.lastName().replace(/[^a-zA-Z]/g, '') || 'Tester';
  const uniqueSuffix = `${Date.now()}_${faker.string.alphanumeric(6).toLowerCase()}`;

  return {
    name: `${firstName} ${lastName}`,
    email: `qa_${uniqueSuffix}@example.com`,
    password: `QaPass!${faker.string.alphanumeric(8)}`,
    title: faker.helpers.arrayElement(['Mr', 'Mrs'] as const),
    birthDate: String(faker.number.int({ min: 1, max: 28 })),
    birthMonth: faker.helpers.arrayElement(MONTHS),
    birthYear: String(faker.number.int({ min: 1985, max: 2001 })),
    firstName,
    lastName,
    company: faker.company.name(),
    address1: faker.location.streetAddress(),
    address2: `Suite ${faker.number.int({ min: 100, max: 999 })}`,
    country: faker.helpers.arrayElement(SUPPORTED_COUNTRIES),
    state: faker.location.state(),
    city: faker.location.city(),
    zipcode: faker.location.zipCode('#####'),
    mobileNumber: faker.string.numeric(10),
    ...overrides,
  };
}
