# Shinsei manager
A web-based application approval system

## API
### Application forms
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /applications | POST | type, title, private, form_data, recipients_ids, group_ids | Creates an application form |
| /applications | GET | filter | Find application forms |
| /applications/submitted | GET | - | Gets all submitted application forms |
| /applications/submitted/pending | GET | - | Gets all pending submitted application forms |
| /applications/submitted/rejected | GET | - | Gets all rejected submitted application forms |
| /applications/submitted/approved | GET | - | Gets all approved submitted application forms |
| /applications/received | GET | - | Gets all submitted application forms |
| /applications/received/pending | GET | - | Gets all pending received application forms |
| /applications/received/rejected | GET | - | Gets all rejected received application forms |
| /applications/received/approved | GET | - | Gets all approved received application forms |
| /applications/{application_id} | GET | - | gets an application forms using its ID |
| /applications/{application_id} | DELETE | - | Deletes an application forms |
| /applications/{application_id}/approve | POST | - | Approves an application forms |
| /applications/{application_id}/reject | POST | - | Rejects an application forms |
| /applications/{application_id}/files/{file_id} | GET | - | Gets an attachment of an application |

### Application form templates
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /application_form_templates/{template_id} | GET | - | gets an application form template using its ID |
| /application_form_templates/{template_id} | POST | fields, label, description, group_ids | Creates an application form template |
| /application_form_templates/{template_id} | PUT | fields, label, description, group_ids | Updates an application form template |
| /application_form_templates/{template_id} | DELETE | - | Deletes an application form template |

### Attachments
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /files | POST | multipart/form-data with file as 'file_to_upload' | Creates an attachment |

## Environment variables

| variable | Description
| --- | --- |
| NEO4J_URL | URL of the Neo4J instance |
| NEO4J_USERNAME | Username for the Neo4J instance |
| NEO4J_PASSWORD | Password for the Neo4J instance |
