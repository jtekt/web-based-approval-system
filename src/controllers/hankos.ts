import { Request, Response, NextFunction } from 'express';
import { driver } from '../db';
import { get_current_user_id } from '../utils';
import createHttpError from 'http-errors';
import { validate } from '../utils/validate';
import {
  hankoParamsSchema,
  updateHankosSchema,
} from '../validators/hankos.validators';

export const update_hankos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const user_id = get_current_user_id(res);
    const { application_id } = validate(hankoParamsSchema, req.params);
    const { attachment_hankos } = validate(updateHankosSchema, req.body);

    const cypher = `
      MATCH (user:User)-[approval:APPROVED]->(application:ApplicationForm)
      WHERE user._id = $user_id AND application._id = $application_id

      SET approval.attachment_hankos = $attachment_hankos

      RETURN PROPERTIES(approval) as approval
      `;

    const params = {
      user_id,
      application_id,
      attachment_hankos: JSON.stringify(attachment_hankos),
    };

    const { records } = await session.run(cypher, params);
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`);

    const approval = records[0].get('approval');
    console.log(
      `Hankos of approval ${approval._id} updated by user ${user_id}`
    );
    res.send(approval);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};
