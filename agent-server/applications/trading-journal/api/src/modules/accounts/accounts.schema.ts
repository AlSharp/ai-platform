import { z } from 'zod';

export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  broker: z.string().nullable(),
  mode: z.enum(['LIVE', 'PAPER']),
  currency: z.string(),
  created_at: z.string(),
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