# 申請マネージャ

In Japan, the approval of application forms and other documents is generally achieved by printing those out and stamping them with one's personal seal, called ハンコ (Hanko). This practice has been a a significant obstacle to the adoption of remote work, as many employees still need to commute to work in order to get paper documents stamped by their superiors. This repository contains the source-code of 申請マネージャ (Shinsei-manager), a web-based approval system that aims at solving this problem.

申請マネージャ is a Node.js application that allows the approval of virtually any kind of application forms or documents. It manages those, alongside their approval or rejections, as nodes and relationships in a Neo4J database.

The current repository contains the source-code of the back-end application of 申請マネージャ. For its GUI, please see the dedicated repository.

## API

### Application forms

| Endpoint                                       | Method | body/query                                                 | Description                                   |
| ---------------------------------------------- | ------ | ---------------------------------------------------------- | --------------------------------------------- |
| /applications                                  | POST   | type, title, private, form_data, recipients_ids, group_ids | Create an application form                    |
| /applications                                  | GET    | filters, query parameters, etc.                            | Query application forms                       |
| /applications/{application_id}                 | GET    | -                                                          | Query a single application forms using its ID |
| /applications/{application_id}                 | DELETE | -                                                          | Delete an application forms                   |
| /applications/{application_id}/approve         | POST   | -                                                          | Approve an application form                   |
| /applications/{application_id}/reject          | POST   | -                                                          | Reject an application form                    |
| /applications/{application_id}/files/{file_id} | GET    | -                                                          | Query an attachment of an application         |

### Application form templates

| Endpoint                 | Method | body/query                            | Description                                    |
| ------------------------ | ------ | ------------------------------------- | ---------------------------------------------- |
| /templates/              | POST   | template_properties                   | Create a form template                         |
| /templates/              | GET    | -                                     | Get templates visible to the current user      |
| /templates/{template_id} | GET    | -                                     | gets an application form template using its ID |
| /templates/{template_id} | POST   | fields, label, description, group_ids | Creates an application form template           |
| /templates/{template_id} | PUT    | fields, label, description, group_ids | Updates an application form template           |
| /templates/{template_id} | DELETE | -                                     | Deletes an application form template           |

### Attachments

| Endpoint | Method | body/query                                        | Description           |
| -------- | ------ | ------------------------------------------------- | --------------------- |
| /files   | POST   | multipart/form-data with file as 'file_to_upload' | Creates an attachment |

## Environment variables

| variable             | Description                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| APP_PORT             | App on which the application listens for HTTP requests                                           |
| NEO4J_URL            | URL of the Neo4J instance                                                                        |
| NEO4J_USERNAME       | Username for the Neo4J instance                                                                  |
| NEO4J_PASSWORD       | Password for the Neo4J instance                                                                  |
| IDENTIFICATION_URL   | URL of the authentication endpoint                                                               |
| S3_BUCKET            | S3 Bucket to upload images. If set, images are uploaded to S3, otherwise they are stored locally |
| S3_ACCESS_KEY_ID     | S3 access key ID                                                                                 |
| S3_SECRET_ACCESS_KEY | S3 secret access key                                                                             |
| S3_REGION            | S3 region                                                                                        |
| S3_ENDPOINT          | S3 Endpoint                                                                                      |
