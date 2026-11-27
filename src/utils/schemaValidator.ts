import Ajv, { type ValidateFunction } from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });
const validatorCache = new Map<object, ValidateFunction>();

/**
 * Validates a parsed JSON payload against a JSON Schema using Ajv.
 * Throws a detailed error listing every schema violation on mismatch.
 */
export function validateSchema<T>(
  schema: object,
  data: unknown,
  schemaName: string,
): T {
  let validate = validatorCache.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    validatorCache.set(schema, validate);
  }

  const isValid = validate(data);
  if (!isValid) {
    const details = (validate.errors ?? [])
      .map((err) => {
        const path = err.instancePath || '<root>';
        return `  - ${path}: ${err.message ?? 'validation error'}`;
      })
      .join('\n');

    throw new Error(
      `Schema validation failed for "${schemaName}":\n${details || '  - Unknown validation failure'}`,
    );
  }

  return data as T;
}
