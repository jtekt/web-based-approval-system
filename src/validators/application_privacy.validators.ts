import { z } from 'zod';

export const updateApplicationPrivacySchema = z.object({
  private: z.boolean(),
});

export const applicationIdParamsSchema = z.object({
  application_id: z.uuid(),
});

export const groupVisibilityBodySchema = z.object({
  group_id: z.uuid(),
});

export const applicationGroupParamsSchema = z.object({
  application_id: z.uuid(),
  group_id: z.uuid(),
});
