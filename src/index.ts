import 'dotenv/config';
import pkg from '../package.json';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import promBundle from 'express-prom-bundle';
import auth from '@moreillon/express_identification_middleware';
import router from './routes/index';
import {
  get_connected as get_neo4j_connection_status,
  init as db_init,
} from './db';
import { env } from './env';

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
    identification: env.IDENTIFICATION_URL,
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
if (env.IDENTIFICATION_URL) {
  // TODO: add oidc and error if no authentication method is available
  app.use(auth({ url: env.IDENTIFICATION_URL }));
}

app.use('/', router);

// error handling
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err.statusCode || 500).send(err.message);
});

app.listen(env.APP_PORT, () => {
  console.log(`[Express] listening on port ${env.APP_PORT}`);

  console.log(`Access development server at http://localhost:${env.APP_PORT}`);
});

export { app };
