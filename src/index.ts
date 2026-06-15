import 'dotenv/config';
import pkg from '../package.json';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import promBundle from 'express-prom-bundle';
import router from './routes/index';
import {
  get_connected as get_neo4j_connection_status,
  init as db_init,
} from './db';
import { env } from './env';
import { logger } from './logger';
import middleware, { Options } from '@jtekt/express-authentication-middleware';

const { version, author } = pkg;

console.log(`Shinsei manager v${version}`);

db_init();

const corsOptions = {
  exposedHeaders: 'Content-Disposition',
};
const promOptions = { includeMethod: true, includePath: true };

const app = express();

app.use(express.json());
app.use(cors(corsOptions));
app.use(promBundle(promOptions));

app.get('/', (_req: Request, res: Response) => {
  res.send({
    application_name: 'Shinsei-manager',
    author,
    version,
    neo4j: {
      url: env.NEO4J_URL,
      connected: get_neo4j_connection_status(),
    },
    auth: {
      identification_url: env.IDENTIFICATION_URL,
      local_jwt: !!env.JWT_DECODE_SECRET,
    },
    attachments: {
      uploads_path: !env.S3_BUCKET ? env.UPLOADS_PATH : undefined,
      s3: env.S3_BUCKET
        ? {
            bucket: env.S3_BUCKET,
            region: env.S3_REGION,
            endpoint: env.S3_ENDPOINT,
          }
        : undefined,
    },
    loki_url: env.LOKI_URL,
  });
});

// Require authentication for all following routes
// Strategies
const options: Options = {
  strategies: {},
  identifierFieldName: '_id'
};

if (env.IDENTIFICATION_URL) {
  options.strategies.identification = {
    url: env.IDENTIFICATION_URL,
    identifierField: '_id',
  };
}

if (env.JWT_DECODE_SECRET) {
  options.strategies.local = {
    secret: env.JWT_DECODE_SECRET,
    identifierField: 'user_id',
  };
}

if (Object.keys(options.strategies).length === 0) {
  throw new Error(
    'At least one authentication strategy must be configured. Set IDENTIFICATION_URL or JWT_DECODE_SECRET.'
  );
}

app.use(middleware(options));

app.use('/', router);
app.use('/v1', router);
app.use('/v2', router);

// error handling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err);
  res.status(err.statusCode || 500).send(err.message);
});

app.listen(env.APP_PORT, () => {
  console.log(`[Express] listening on port ${env.APP_PORT}`);
});

export { app };
