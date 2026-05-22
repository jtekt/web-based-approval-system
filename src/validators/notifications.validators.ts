import { z } from 'zod';

export const notificationParamsSchema = z.object({
  recipient_id: z.string().min(1),
  application_id: z.string().min(1),
});
