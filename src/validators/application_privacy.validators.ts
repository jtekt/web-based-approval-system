import { z } from 'zod';

export const updateApplicationPrivacySchema = z.object({
  private: z.boolean(),
});

export const applicationIdParamsSchema = z.object({
  application_id: z.string().min(1),
});

export const groupVisibilityBodySchema = z.object({
  group_id: z.string().min(1),
});

export const applicationGroupParamsSchema = z.object({
  application_id: z.string().min(1),
  group_id: z.string().min(1),
});
