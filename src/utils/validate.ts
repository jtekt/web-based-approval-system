import createHttpError from 'http-errors';
import z, { ZodError, type ZodType } from 'zod';

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createHttpError(400, z.treeifyError(err));
    }
    throw err;
  }
}
