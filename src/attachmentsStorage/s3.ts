import path from 'path';
import { addProxyToClient } from 'aws-sdk-v3-proxy';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  S3Client,
  S3ClientConfig,
  ListObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Response } from 'express';
import { env } from '../env';

const s3ClientOptions: S3ClientConfig = {
  region: env.S3_REGION,
  ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  endpoint: env.S3_ENDPOINT,
};

let s3Client: S3Client | undefined;

if (env.S3_BUCKET) {
  console.log(
    `[S3] S3_BUCKET is set, uploading attachment to S3 bucket "${env.S3_BUCKET}" in region ${env.S3_REGION}`
  );
  s3Client = env.HTTPS_PROXY
    ? addProxyToClient(new S3Client(s3ClientOptions))
    : new S3Client(s3ClientOptions);
} else {
  console.log(`[S3] S3_BUCKET not set, storing attachments locally`);
}

export const create_s3_upload_stream = (
  name: string
): { file_id: string; stream: PassThrough; done: Promise<unknown> } => {
  const file_id = uuidv4();
  const Key = `${file_id}/${name}`;
  const stream = new PassThrough();

  const upload = new Upload({
    client: s3Client!,
    params: { Bucket: env.S3_BUCKET, Key, Body: stream },
  });

  return { file_id, stream, done: upload.done() };
};

export const download_file_from_s3 = async (
  res: Response,
  file_id: string
): Promise<void> => {
  const listObjectsResult = await s3Client!.send(
    new ListObjectsCommand({
      Bucket: env.S3_BUCKET,
      Prefix: file_id,
    })
  );

  if (!listObjectsResult.Contents || !listObjectsResult.Contents.length)
    throw `File ${file_id} does not exist`;

  const { Key } = listObjectsResult.Contents[0];
  const getObjectResult = await s3Client!.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key,
    })
  );

  const { base: filename } = path.parse(Key!);

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${encodeURIComponent(filename)}`
  );

  await pipeline(getObjectResult.Body as Readable, res);
};

export { s3Client };
