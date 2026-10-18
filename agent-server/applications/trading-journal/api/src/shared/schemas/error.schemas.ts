import { z } from 'zod';

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  error: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}