import createHttpError from 'http-errors';
import { Request, Response, NextFunction } from 'express';
import { get_current_user_id } from '../utils';
import { driver } from '../db';
import { validate } from '../utils/validate';
import {
  recipientCommentParamsSchema,
  updateCommentSchema,
} from '../validators/recipient_comment.validators';

export const update_comment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const { application_id } = validate(
      recipientCommentParamsSchema,
      req.params
    );
    const { comment } = validate(updateCommentSchema, req.body);
    const user_id = get_current_user_id(res);

    const cypher = `
      // Find current user to check for authorization
      // WARNING: decision could be SUBMITTED_BY or SUBMITTED_TO couldn't it?
      MATCH (user:User)-[decision]->(application:ApplicationForm)
      WHERE user._id = $user_id
      AND application._id = $application_id

      // Set the attached hankos
      SET decision.comment = $comment

      // Return
      RETURN decision.comment as comment
      `;

    const params = {
      user_id,
      application_id,
      comment,
    };

    const { records } = await session.run(cypher, params);
    if (!records.length)
      throw createHttpError(
        404,
        `Application ${application_id} has no comment candidate for user ${user_id}`
      );
    console.log(
      `Comment on application ${application_id} by user ${user_id} updated`
    );
    res.send({ comment: records[0].get('comment') });
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};
