import { z } from 'zod';

export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  broker: z.string().nullable(),
  mode: z.enum(['LIVE', 'PAPER']),
  currency: z.string(),
  created_at: z.string(),
  archived_at: z.string().nullable(),
});

export const listAccountsResponseSchema = z.object({
  accounts: z.array(accountSchema),
});

export type Account = z.infer<typeof accountSchema>;

export type ListAccountsResponse =
  z.infer<typeof listAccountsResponseSchema>;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  broker: z.string().trim().optional(),
  mode: z.enum(['LIVE', 'PAPER']),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
});

export type CreateAccountInput =
  z.input<typeof createAccountSchema>;

export type CreateAccount =
  z.output<typeof createAccountSchema>;

export const accountParamsSchema = z.object({
  id: z.uuid(),
});

export type AccountParams = z.infer<typeof accountParamsSchema>;

export const updateAccountSchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type UpdateAccount = z.infer<typeof updateAccountSchema>;

export const listAccountsQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export type ListAccountsQuery =
  z.infer<typeof listAccountsQuerySchema>;