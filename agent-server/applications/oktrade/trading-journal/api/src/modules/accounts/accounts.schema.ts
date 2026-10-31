import { z } from 'zod';

export const accountRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  broker: z.string().nullable(),
  mode: z.enum(['LIVE', 'PAPER']),
  currency: z.string(),
  created_at: z.string(),
  archived_at: z.string().nullable(),
});

export const listAccountsResponseSchema = z.object({
  accounts: z.array(accountRecordSchema),
});

export type AccountRecord = z.infer<typeof accountRecordSchema>;

export type ListAccountsResponse =
  z.infer<typeof listAccountsResponseSchema>;

export const createAccountRequestSchema = z.object({
  name: z.string().trim().min(1),
  broker: z.string().trim().optional(),
  mode: z.enum(['LIVE', 'PAPER']),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
});

export type CreateAccountRequestInput =
  z.input<typeof createAccountRequestSchema>;

export type CreateAccountRequest =
  z.output<typeof createAccountRequestSchema>;

export const accountPathParamsSchema = z.object({
  id: z.uuid(),
});

export type AccountPathParams = z.infer<typeof accountPathParamsSchema>;

export const updateAccountRequestSchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type UpdateAccountRequest = z.infer<typeof updateAccountRequestSchema>;

export const listAccountsQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export type ListAccountsQuery =
  z.infer<typeof listAccountsQuerySchema>;