import createHttpError from 'http-errors';
import { Request, Response, NextFunction } from 'express';
import { driver } from '../db';
import {
  get_current_user_id,
  application_batching,
  return_application_and_related_nodes,
  format_application_from_record,
  filter_by_type,
  query_with_hanko_id,
  query_with_date,
  query_with_group,
  query_deleted,
  query_with_relationship_and_state,
} from '../utils';
import {
  applicationIdParamsSchema,
  approveApplicationSchema,
  createApplicationSchema,
  readApplicationsQuerySchema,
  rejectApplicationSchema,
} from '../validators/application.validators';
import { validate } from '../utils/validate';

export const create_application = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const {
      type,
      title,
      form_data,
      recipients_ids,
      private: isPrivate,
      group_ids,
    } = validate(createApplicationSchema, req.body);

    const user_id = get_current_user_id(res);

    const cypher = `
        // Create the application node
        MATCH (user:User {_id: $user_id})
        CREATE (application:ApplicationForm)-[:SUBMITTED_BY {date: date()} ]->(user)

        // Set the application properties using data passed in the request body
        SET application = $application_properties
        SET application._id = randomUUID()
        SET application.creation_date = date()

        // Relationship with recipients
        // This also creates flow indices
        // Note: flow cannot be empty
        // WARNING: submission does not have an ID. probably not an issue because submissions never accessed directly
        WITH application, $recipients_ids as recipients_ids
        UNWIND range(0, size(recipients_ids)-1) as i
        MATCH (recipient:User {_id: recipients_ids[i]})
        CREATE (recipient)<-[submission:SUBMITTED_TO {date: date(), flow_index: i} ]-(application)

        // Groups to which the application is visible
        // Note: can be an empty set so the logic to deal with it looks terrible
        WITH application
        UNWIND
        CASE
            WHEN $group_ids = []
            THEN [null]
            ELSE $group_ids
        END AS group_id

        OPTIONAL MATCH (group:Group {_id: group_id})
        WITH collect(group) as groups, application
        FOREACH(group IN groups | MERGE (application)-[:VISIBLE_TO]->(group))

        // Finally, Return the created application
        RETURN properties(application) as application
        `;

    const params = {
      user_id,
      application_properties: {
        form_data: JSON.stringify(form_data),
        type,
        title,
        private: isPrivate,
      },
      group_ids,
      recipients_ids,
    };

    const { records } = await session.run(cypher, params);

    if (!records.length)
      throw createHttpError(500, `Failed to create the application`);
    const application = records[0].get('application');

    res.send(application);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const read_applications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const current_user_id = get_current_user_id(res);

    const {
      user_id = current_user_id,
      group_id,
      relationship,
      state,
      type,
      start_date,
      end_date,
      hanko_id,
      start_index,
      batch_size,
      deleted,
    } = validate(readApplicationsQuerySchema, req.query);

    const cypher = `
      MATCH (user:User {_id: $user_id})
      WITH user
      MATCH (application:ApplicationForm)
      ${query_with_relationship_and_state(relationship, state)}

      // from here on, no need for user anymore
      // gets required later on
      ${query_deleted(deleted)}
      ${filter_by_type(type)}
      ${query_with_date(start_date, end_date)}
      ${query_with_group(group_id)}
      ${query_with_hanko_id(hanko_id)}

      // batching
      ${application_batching}
      ${return_application_and_related_nodes}
      `;

    const params = {
      user_id,
      relationship,
      type,
      start_date,
      end_date,
      start_index,
      batch_size,
      hanko_id,
      group_id,
    };

    const { records } = await session.run(cypher, params);

    const count = records.length ? records[0].get('application_count') : 0;

    const applications = records.map((record) =>
      format_application_from_record(record)
    );

    res.json({
      count,
      applications,
      start_index,
      batch_size,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const read_application = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const user_id = get_current_user_id(res);
    const { application_id } = validate(applicationIdParamsSchema, req.params);

    const cypher = `
      // Find application
      MATCH (application:ApplicationForm {_id: $application_id})
      WHERE application.deleted IS NULL OR NOT application.deleted

      // Dummy application_count because following query uses it
      WITH application, 1 as application_count
      ${return_application_and_related_nodes}
      `;

    const params = { user_id, application_id };

    const { records } = await session.run(cypher, params);

    const record = records[0];

    if (!record)
      throw createHttpError(404, `Application ${application_id} not found`);

    const application = format_application_from_record(record);

    res.json(application);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const get_application_types = async (
  _: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const cypher = `
      MATCH (application:ApplicationForm)
      RETURN DISTINCT(application.type) as application_type
      `;

    const { records } = await session.run(cypher, {});
    const types = records.map((record) => record.get('application_type'));
    res.send(types);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const delete_application = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const user_id = get_current_user_id(res);
    const { application_id } = validate(applicationIdParamsSchema, req.params);

    const cypher = `
      MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm )
      WHERE applicant._id = $user_id
          AND application._id = $application_id

      WITH application, properties(application) as applicationProperties
      DETACH DELETE application

      RETURN applicationProperties
      `;

    const params = { user_id, application_id };

    const { records } = await session.run(cypher, params);
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`);

    const application = records[0].get('applicationProperties');

    res.send(application);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const approve_application = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const user_id = get_current_user_id(res);

    const { application_id } = validate(applicationIdParamsSchema, req.params);

    const { attachment_hankos, comment } = validate(
      approveApplicationSchema,
      req.body
    );

    const attachment_hankos_query = attachment_hankos
      ? `SET approval.attachment_hankos = $attachment_hankos`
      : '';

    const cypher = `
      // Find the application and get oneself at the same time
      MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
      WHERE application._id = $application_id
      AND recipient._id = $user_id

      // Mark as approved
      WITH application, recipient
      MERGE (application)<-[approval:APPROVED]-(recipient)
      ON CREATE SET approval.date = date()
      ON CREATE SET approval._id = randomUUID()
      SET approval.comment = $comment
      ${attachment_hankos_query}

      RETURN PROPERTIES(approval) as approval,
          PROPERTIES(recipient) as recipient,
          PROPERTIES(application) as application
      `;

    const params = {
      user_id,
      application_id,
      comment,
      attachment_hankos: JSON.stringify(attachment_hankos),
    };

    const { records } = await session.run(cypher, params);
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`);

    const application = records[0].get('application');

    res.send(application);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};

export const reject_application = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = driver.session();

  try {
    const user_id = get_current_user_id(res);

    const { application_id } = validate(applicationIdParamsSchema, req.params);

    const { comment } = validate(rejectApplicationSchema, req.body);

    const cypher = `
      MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
      WHERE application._id = $application_id
      AND recipient._id = $user_id

      // Mark as REJECTED
      WITH application, recipient
      MERGE (application)<-[rejection:REJECTED]-(recipient)
      ON CREATE SET rejection._id = randomUUID()
      ON CREATE SET rejection.date = date()
      SET rejection.comment = $comment

      RETURN PROPERTIES(rejection) as rejection,
          PROPERTIES(recipient) as recipient,
          PROPERTIES(application) as application
      `;

    const params = {
      user_id,
      application_id,
      comment,
    };

    const { records } = await session.run(cypher, params);
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`);

    const application = records[0].get('application');

    res.send(application);
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
};
