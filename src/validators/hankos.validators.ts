import { z } from 'zod';

export const hankoParamsSchema = z.object({
  application_id: z.string().min(1),
});

export const updateHankosSchema = z.object({
  attachment_hankos: z
    .any()
    .refine((v) => v !== undefined && v !== null, {
      message: 'attachment_hankos not defined',
    }),
});
