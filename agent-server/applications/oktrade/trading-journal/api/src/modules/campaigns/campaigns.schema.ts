import { z } from 'zod';

export const campaignRecordSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});

export type CampaignRecord = z.infer<typeof campaignRecordSchema>;

export const createCampaignRequestSchema = z.object({
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().nullable().optional(),
});

export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;

export const listCampaignsQuerySchema = z.object({
  accountId: z.uuid(),
  status: z.enum(['active', 'completed', 'all']).default('active'),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

export const listCampaignsResponseSchema = z.object({
  campaigns: z.array(campaignRecordSchema),
});

export const updateCampaignRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().nullable().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export type UpdateCampaignRequest = z.infer<typeof updateCampaignRequestSchema>;

export const campaignPathParamsSchema = z.object({
  id: z.uuid(),
});