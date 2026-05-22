import { z } from 'zod';

export const templateIdParamsSchema = z.object({
  template_id: z.string().min(1),
});

export const createTemplateSchema = z.object({
  label: z.string().optional().default('Unnamed template'),
  description: z.string().optional().default(''),
  fields: z.array(z.any()).optional().default([]),
  group_ids: z.array(z.string()).optional().default([]),
});

export const updateTemplateSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.any()).optional(),
  group_ids: z.array(z.string()).optional(),
});

export const addTemplateManagerSchema = z.object({
  user_id: z.string().min(1),
});
