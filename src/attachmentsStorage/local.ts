import mv from 'mv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import createHttpError from 'http-errors';
import { Response } from 'express';
import { env } from '../env';

export const store_file_locally = (file_to_upload: {
  path: string;
  name: string;
}): Promise<string> =>
  new Promise((resolve, reject) => {
    const { path: old_path, name: file_name } = file_to_upload;

    const file_id = uuidv4();
    const new_directory_path = path.join(env.UPLOADS_PATH, file_id);
    const new_file_path = path.join(new_directory_path, file_name);

    mv(old_path, new_file_path, { mkdirp: true }, (err) => {
      if (err) reject(err);
      resolve(file_id);
    });
  });

export const download_file_from_local_folder = async (
  res: Response,
  file_id: string
): Promise<void> => {
  const directory_path = path.join(env.UPLOADS_PATH, file_id);
  const files = fs.readdirSync(directory_path);

  const file_to_download = files[0];
  if (!file_to_download) throw createHttpError(500, `Could not open file`);

  res.download(path.join(directory_path, file_to_download), file_to_download);
};
