import z from 'zod';

const envSchema = z.object({
  // App configuration
  APP_PORT: z.string().default('8000'),
  TZ: z.string().default('Asia/Tokyo'),

  // Legacy identification service
  IDENTIFICATION_URL: z.url().optional(),

  // Local file storage
  UPLOADS_PATH: z.string().default('/usr/share/pv'),

  // S3 storage
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  HTTPS_PROXY: z.string().optional(),

  // Neo4J
  NEO4J_URL: z.string().default('bolt://neo4j:7687'),
  NEO4J_USERNAME: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('password'),

  // Loki
  LOKI_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
