import { Response } from 'express';
import { Record, RecordShape } from 'neo4j-driver';

export const get_current_user_id = (res: Response): string => {
  const user = res.locals?.user;
  if (!user) throw `User is not authenticated`;

  const user_id = res.locals.user!._id ?? res.locals.user!.properties?._id;

  if (!user_id) throw `User does not have an ID`;

  return user_id.toString();
};

export const format_application_from_record = (
  record: Record<RecordShape, PropertyKey, RecordShape<PropertyKey, number>>
): any => {
  if (record.get('forbidden')) {
    const application = record.get('application');
    delete application.form_data;
    application.title = '機密 / Confidential';
  }

  return {
    ...record.get('application'),
    applicant: {
      ...record.get('applicant'),
      authorship: record.get('authorship'),
    },
    visibility: record.get('visibility'),
    recipients: record
      .get('recipients')
      .map((recipient: any) => ({
        ...recipient.properties,
        submission: record
          .get('submissions')
          .find((submission: any) => submission.end === recipient.identity)
          ?.properties,
        approval: record
          .get('approvals')
          .find((approval: any) => approval.start === recipient.identity)
          ?.properties,
        refusal: record
          .get('refusals')
          .find((refusal: any) => refusal.start === recipient.identity)
          ?.properties,
      }))
      .sort(
        (a: any, b: any) => a.submission.flow_index - b.submission.flow_index
      ),
    forbidden: record.get('forbidden'),
  };
};

export const return_application_and_related_nodes = `
  // application and count provided by batching
  WITH application, application_count
  MATCH (user:User {_id: $user_id})

  // Adding a forbidden flag to applications that the user cannot see
  WITH application, application_count,
    application.private
    AND NOT (application)-[:SUBMITTED_BY]->(user)
    AND NOT (application)-[:SUBMITTED_TO]->(user)
    AND NOT (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
  AS forbidden

  // Find applicant
  WITH application, forbidden, application_count
  OPTIONAL MATCH (application)-[authorship:SUBMITTED_BY]->(applicant:User)

  // Find recipients
  WITH application, applicant, authorship, forbidden, application_count
  OPTIONAL MATCH (application)-[submission:SUBMITTED_TO]->(recipient:User)

  // Find approvals
  WITH application, applicant, authorship, recipient, submission, forbidden, application_count
  OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

  // Find rejections
  WITH application, applicant, authorship, recipient, submission, approval, forbidden, application_count
  OPTIONAL MATCH (application)<-[refusal:REJECTED]-(recipient)

  // visibility
  WITH application, applicant, authorship, recipient, submission, approval, refusal, forbidden, application_count
  OPTIONAL MATCH (application)-[:VISIBLE_TO]->(group:Group)
    WHERE application.private = true

  // Return everything
  RETURN PROPERTIES(application) as application,
    PROPERTIES (applicant) as applicant,
    PROPERTIES (authorship) as authorship,
    COLLECT(DISTINCT PROPERTIES(group)) as visibility,
    // NOTE: Properties not used on the four hereunder
    COLLECT(DISTINCT recipient) as recipients,
    COLLECT(DISTINCT submission) as submissions,
    COLLECT(DISTINCT approval) as approvals,
    COLLECT(DISTINCT refusal) as refusals,
    forbidden,
    application_count

  `;

const query_submitted_rejected_applications = `
  WITH application
  WHERE (:User)-[:REJECTED]->(application)
  `;

const query_submitted_pending_applications = `
  // A pending application is an application that is does not yet have an equal amount approvals and submissions
  // Also, a rejected application is automatiocally not pending
  WITH application
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WHERE NOT (:User)-[:REJECTED]->(application)
  WITH application, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, recipient_count, count(approval) as approval_count
  WHERE NOT recipient_count = approval_count
  `;

const query_submitted_approved_applications = `
  // A submitted approved application has equal number of approvals than submissions
  WITH application
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WHERE NOT (recipient:User)-[:REJECTED]->(application)
  WITH application, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, recipient_count, count(approval) as approval_count
  WHERE recipient_count = approval_count
  `;

const query_received_pending_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)-[submission:SUBMITTED_TO]->(user:User {_id: $user_id})
  WHERE NOT (application)<-[:REJECTED]-(:User)

  // Get the approval count
  WITH application, submission
  OPTIONAL MATCH (application)<-[approval:APPROVED]-(:User)
  WITH submission, application, count(approval) as approval_count
  WHERE submission.flow_index = approval_count
  `;

const query_received_rejected_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)<-[:REJECTED]->(user:User {_id: $user_id})
  `;

const query_received_approved_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)<-[:APPROVED]->(user:User {_id: $user_id})
  `;

export const application_batching = `
  // Counting must be done before batching
  WITH application ORDER BY application.creation_date DESC
  WITH collect(application) AS application_collection, count(application) as application_count
  WITH application_count, application_collection[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS application_batch
  UNWIND application_batch AS application
  `;

export const filter_by_type = (type: string | undefined): string => {
  if (!type) return ``;
  return `
    WITH application
    WHERE application.type = $type
    `;
};

export const query_with_hanko_id = (hanko_id: string | undefined): string => {
  if (!hanko_id) return ``;
  return `
    WITH application
    MATCH (application)-[approval:APPROVED]-(:User)
    WHERE approval._id = $hanko_id
      OR id(approval) = toInteger($hanko_id) // temporary
    `;
};

export const query_with_date = (
  start_date: string | undefined,
  end_date: string | undefined
): string => {
  let query = ``;

  if (start_date)
    query += `
    WITH application
    WHERE application.creation_date >= date($start_date)
    `;

  if (end_date)
    query += `
    WITH application
    WHERE application.creation_date <= date($end_date)
    `;

  return query;
};

export const query_with_group = (group_id: string | undefined): string => {
  if (!group_id) return ``;
  return `
    WITH application
    MATCH (application)-[:SUBMITTED_BY]->(:User)-[:BELONGS_TO]->(group:Group {_id: $group_id})
    `;
};

export const query_deleted = (deleted: any): string => {
  if (deleted) return ``;
  return `
    WITH application
    WHERE application.deleted IS NULL
    `;
};

export const query_with_relationship_and_state = (
  relationship: string | undefined,
  state: string | undefined
): string => {
  if (!relationship) return ``;

  let query = `
    WITH application, user
    MATCH (application)-[r]-(user {_id: $user_id})
    WHERE type(r) = $relationship
    `;

  if (relationship === 'SUBMITTED_BY') {
    if (state === 'pending') query += query_submitted_pending_applications;
    else if (state === 'rejected')
      query += query_submitted_rejected_applications;
    else if (state === 'approved')
      query += query_submitted_approved_applications;
  } else if (relationship === 'SUBMITTED_TO') {
    if (state === 'pending') query += query_received_pending_applications;
    else if (state === 'rejected')
      query += query_received_rejected_applications;
    else if (state === 'approved')
      query += query_received_approved_applications;
  }

  return query;
};
