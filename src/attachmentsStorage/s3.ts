import path from 'path';
import { addProxyToClient } from 'aws-sdk-v3-proxy';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Response } from 'express';
import { env } from '../env';

const s3ClientOptions = {
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
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

export const store_file_on_s3 = async (file_to_upload: {
  path: string;
  name: string;
}): Promise<string> => {
  const file_id = uuidv4();
  const Key = `${file_id}/${file_to_upload.name}`;
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Body: fs.readFileSync(file_to_upload.path),
    Key,
  });
  await s3Client!.send(command);
  return file_id;
};

export const download_file_from_s3 = async (
  res: Response,
  file_id: string
): Promise<void> => {
  const listObjectsresult = await s3Client!.send(
    new ListObjectsCommand({
      Bucket: env.S3_BUCKET,
      Prefix: file_id,
    })
  );

  if (!listObjectsresult.Contents || !listObjectsresult.Contents.length)
    throw `File ${file_id} does not exist`;

  const { Key } = listObjectsresult.Contents[0];
  const getObjectResult = await s3Client!.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key,
    })
  );

  const { base: filename } = path.parse(Key!);

  getObjectResult.Body!.transformToWebStream().pipeTo(
    new WritableStream({
      start() {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${encodeURIComponent(filename)}`
        );
      },
      write(chunk) {
        res.write(chunk);
      },
      close() {
        res.end();
      },
    })
  );
};

export { s3Client };
