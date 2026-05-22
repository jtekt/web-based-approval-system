import { z } from 'zod';

export const fileParamsSchema = z.object({
  file_id: z.string().min(1),
  application_id: z.uuid(),
});
