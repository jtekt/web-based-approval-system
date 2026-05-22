import createHttpError from 'http-errors';
import formidable, { Files } from 'formidable';
import { Request, Response, NextFunction } from 'express';
import { driver } from '../db';
import { get_current_user_id } from '../utils';
import { validate } from '../utils/validate';
import { fileParamsSchema } from '../validators/files.validators';
import {
  s3Client,
  store_file_on_s3,
  download_file_from_s3,
} from '../attachmentsStorage/s3';
import {
  store_file_locally,
  download_file_from_local_folder,
} from '../attachmentsStorage/local';

const parse_form = async (req: Request): Promise<Files> => {
  const form = formidable();
  const [_fields, files] = await form.parse(req);
  return files;
};

export const file_upload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = await parse_form(req);
    const uploaded = files.file_to_upload?.[0];
    if (!uploaded) throw createHttpError(400, 'Missing file');

    const file_to_upload = {
      path: uploaded.filepath,
      name: uploaded.originalFilename ?? '',
    };

    let file_id: string;
    if (s3Client) file_id = await store_file_on_s3(file_to_upload);
    else file_id = await store_file_locally(file_to_upload);

    res.send({ file_id });
  } catch (error) {
    next(error);
  }
};

export const get_file = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const { file_id, application_id } = validate(fileParamsSchema, req.params);
    const user_id = get_current_user_id(res);

    const query = `
    // Find current user to check for authorization
    MATCH (user:User {_id: $user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm {_id: $application_id})

    // Enforce privacy
    WITH user, application
    WHERE application.private IS NULL
      OR NOT application.private
      OR (application)-[:SUBMITTED_BY]->(user)
      OR (application)-[:SUBMITTED_TO]->(user)
      OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)

    return application
    `;

    const params = { user_id, file_id, application_id };

    const { records } = await session.run(query, params);

    if (!records.length)
      throw createHttpError(
        400,
        `Application ${application_id} could not be queried`
      );

    const application_node = records[0].get('application');
    const form_data = JSON.parse(application_node.properties.form_data);
    const found_file = form_data.find(
      ({ value }: { value: string }) => value === file_id
    );
    if (!found_file)
      throw createHttpError(
        400,
        `Application ${application_id} does not include the file ${file_id}`
      );

    if (s3Client) await download_file_from_s3(res, file_id);
    else await download_file_from_local_folder(res, file_id);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};
