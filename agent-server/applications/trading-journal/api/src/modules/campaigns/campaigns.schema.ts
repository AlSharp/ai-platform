import { z } from 'zod';

export const campaignSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});

export type Campaign = z.infer<typeof campaignSchema>;

export const createCampaignSchema = z.object({
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().nullable().optional(),
});

export type CreateCampaignParams = z.infer<typeof createCampaignSchema>;

export const listCampaignsSchema = z.object({
  accountId: z.uuid(),
  status: z.enum(['active', 'completed', 'all']).default('active'),
});

export type ListCampaignsParams = z.infer<typeof listCampaignsSchema>;

export const listCampaignsResponseSchema = z.object({
  campaigns: z.array(campaignSchema),
});

export const updateCampaignSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().nullable().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export type UpdateCampaignParams = z.infer<typeof updateCampaignSchema>;

export const campaignParamsSchema = z.object({
  id: z.uuid(),
});