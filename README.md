# 申請マネージャ

[![AWS ECR](https://img.shields.io/badge/AWS%20ECR-shinsei--manager-blue)](https://gallery.ecr.aws/jtekt-corporation/shinsei-manager)

In Japan, the approval of application forms and other documents is generally achieved by printing those out and stamping them with one's personal seal, called ハンコ (Hanko). This practice has been a a significant obstacle to the adoption of remote work, as many employees still need to commute to work in order to get paper documents stamped by their superiors. This repository contains the source-code of 申請マネージャ (Shinsei-manager), a web-based approval system that aims at solving this problem.

申請マネージャ is a Node.js application that allows the approval of virtually any kind of application forms or documents. It manages those, alongside their approval or rejections, as nodes and relationships in a Neo4J database.

The current repository contains the source-code of the back-end application of 申請マネージャ. For its GUI, please see the dedicated repository.

## API

All routes except `/` and `/health` require authentication (see `IDENTIFICATION_URL` and `JWT_DECODE_SECRET`). The routes below are also served under `/v1` and `/v2`.

### Application forms

| Endpoint                                                              | Method | Body / query                                               | Description                                          |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------- | ---------------------------------------------------- |
| /applications                                                         | POST   | type, title, form_data, recipients_ids, private, group_ids | Creates an application form                          |
| /applications                                                         | GET    | see below                                                  | Queries application forms                            |
| /applications/types                                                   | GET    | -                                                          | Gets the application types in use                    |
| /applications/{application_id}                                        | GET    | -                                                          | Gets an application form                             |
| /applications/{application_id}                                        | DELETE | -                                                          | Deletes an application form                          |
| /applications/{application_id}/approve                                | POST   | comment, attachment_hankos                                 | Approves an application form                         |
| /applications/{application_id}/reject                                 | POST   | comment                                                    | Rejects an application form                          |
| /applications/{application_id}/comment                                | PUT    | comment                                                    | Updates one's comment on an application form         |
| /applications/{application_id}/privacy                                | PUT    | private                                                    | Makes an application form private or public          |
| /applications/{application_id}/privacy/groups                         | POST   | group_id                                                   | Makes a private application form visible to a group  |
| /applications/{application_id}/privacy/groups/{group_id}              | DELETE | -                                                          | Removes the visibility of an application form to a group |
| /applications/{application_id}/hankos                                 | PUT    | attachment_hankos                                          | Updates the hankos placed on the attachments         |
| /applications/{application_id}/recipients/{recipient_id}/notifications | POST  | -                                                          | Marks a recipient as notified                        |
| /applications/{application_id}/files/{file_id}                        | GET    | -                                                          | Gets an attachment of an application form            |

#### GET /applications query parameters

| Parameter    | Description                                                                         | Default |
| ------------ | ----------------------------------------------------------------------------------- | ------- |
| relationship | `SUBMITTED_BY` (sent by the user) or `SUBMITTED_TO` (received by the user)          | -       |
| state        | `pending`, `approved` or `rejected`, combined with `relationship`                   | -       |
| user_id      | User whose applications are queried                                                 | self    |
| group_id     | Only applications submitted by members of this group                                | -       |
| type         | Application type                                                                    | -       |
| start_date   | Only applications created after this date                                           | -       |
| end_date     | Only applications created before this date                                          | -       |
| hanko_id     | Only the application of this approval (hanko)                                       | -       |
| deleted      | Include deleted applications                                                        | false   |
| start_index  | Index of the first result                                                           | 0       |
| batch_size   | Number of results per page                                                          | 10      |

### Application form templates

`/application_form_templates` is an alias of `/templates`.

| Endpoint                          | Method    | Body / query                          | Description                                    |
| --------------------------------- | --------- | ------------------------------------- | ---------------------------------------------- |
| /templates                        | POST      | label, description, fields, group_ids | Creates a form template                        |
| /templates                        | GET       | -                                     | Gets the templates visible to the current user |
| /templates/{template_id}          | GET       | -                                     | Gets a form template                           |
| /templates/{template_id}          | PUT/PATCH | label, description, fields, group_ids | Updates a form template                        |
| /templates/{template_id}          | DELETE    | -                                     | Deletes a form template                        |
| /templates/{template_id}/managers | POST      | user_id                               | Adds a manager to a form template              |

### Attachments

| Endpoint         | Method | Body / query                                      | Description           |
| ---------------- | ------ | ------------------------------------------------- | --------------------- |
| /files           | POST   | multipart/form-data with file as 'file_to_upload' | Creates an attachment |
| /files/{file_id} | GET    | -                                                 | Gets an attachment    |

Attachments are stored in S3 when `S3_BUCKET` is set, otherwise under `UPLOADS_PATH`.

### Service

| Endpoint      | Method | Description                                                |
| ------------- | ------ | ---------------------------------------------------------- |
| /             | GET    | Application info: version, configuration, DB status        |
| /health/live  | GET    | Liveness probe: the process responds                       |
| /health/ready | GET    | Readiness probe: 503 until the DB is set up and reachable  |

## Environment variables

At least one of `IDENTIFICATION_URL` and `JWT_DECODE_SECRET` is required.

| Variable             | Description                                                                                  | Default           |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| APP_PORT             | Port on which the application listens for HTTP requests                                      | 80                |
| TZ                   | Time zone                                                                                    | Asia/Tokyo        |
| NEO4J_URL            | URL of the Neo4J instance                                                                    | bolt://neo4j:7687 |
| NEO4J_USERNAME       | Username for the Neo4J instance                                                              | neo4j             |
| NEO4J_PASSWORD       | Password for the Neo4J instance                                                              | password          |
| IDENTIFICATION_URL   | URL of the endpoint identifying the current user, e.g. `http://employee-manager/v3/users/self` |                 |
| JWT_DECODE_SECRET    | Secret used to verify JWTs locally, as an alternative to `IDENTIFICATION_URL`                |                   |
| UPLOADS_PATH         | Directory for attachments when S3 is not used                                                | /usr/share/pv     |
| S3_BUCKET            | S3 bucket for attachments; if set, attachments are stored in S3, otherwise locally           |                   |
| S3_ACCESS_KEY_ID     | S3 access key ID                                                                             |                   |
| S3_SECRET_ACCESS_KEY | S3 secret access key                                                                         |                   |
| S3_REGION            | S3 region                                                                                    |                   |
| S3_ENDPOINT          | S3 endpoint                                                                                  |                   |
| HTTPS_PROXY          | Proxy used for S3 requests                                                                   |                   |
| LOKI_URL             | URL of a Loki instance to send logs to                                                       |                   |

The version shown at `/` comes from `APP_VERSION`, set at build time from the git tag (`--build-arg APP_VERSION`).
