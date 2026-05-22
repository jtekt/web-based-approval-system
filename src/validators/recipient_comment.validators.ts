import { z } from 'zod';

export const recipientCommentParamsSchema = z.object({
  application_id: z.uuid(),
});

export const updateCommentSchema = z.object({
  comment: z.string().min(1),
});
