import { z } from 'zod';

export const createApplicationSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  form_data: z.any(),
  recipients_ids: z.array(z.string()).min(1),
  private: z.boolean().optional().default(false),
  group_ids: z.array(z.string()).optional().default([]),
});

export const readApplicationsQuerySchema = z.object({
  user_id: z.string().optional(),
  group_id: z.string().optional(),
  relationship: z.string().optional(),
  state: z.string().optional(),
  type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  hanko_id: z.string().optional(),
  start_index: z.coerce.number().optional().default(0),
  batch_size: z.coerce.number().optional().default(10),
  deleted: z.coerce.boolean().optional().default(false),
});

export const applicationIdParamsSchema = z.object({
  application_id: z.string().min(1),
});

export const approveApplicationSchema = z.object({
  comment: z.string().optional().default(''),
  attachment_hankos: z.any().optional(),
});

export const rejectApplicationSchema = z.object({
  comment: z.string().optional().default(''),
});
