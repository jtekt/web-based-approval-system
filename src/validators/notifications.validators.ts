import { z } from 'zod';

export const notificationParamsSchema = z.object({
  recipient_id: z.uuid(),
  application_id: z.uuid(),
});
