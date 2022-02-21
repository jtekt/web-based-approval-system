# Shinsei manager
A web application to manage approval workflows.

## API
### Application forms
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /applications | POST | type, title, private, form_data, recipients_ids, group_ids | Creates an application form |
| /applications | GET | filters, query parameters, etc. | Query application forms |
| /applications/{application_id} | GET | - | gets an application forms using its ID (Please note the v2 in the URL)|
| /applications/{application_id} | DELETE | - | Deletes an application forms |
| /applications/{application_id}/approve | POST | - | Approves an application forms |
| /applications/{application_id}/reject | POST | - | Rejects an application forms |
| /applications/{application_id}/files/{file_id} | GET | - | Gets an attachment of an application |

### Application form templates
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /templates/ | POST | template_properties | Create a form template |
| /templates/ | GET | - | Get templates visible to the current user |
| /templates/{template_id} | GET | - | gets an application form template using its ID |
| /templates/{template_id} | POST | fields, label, description, group_ids | Creates an application form template |
| /templates/{template_id} | PUT | fields, label, description, group_ids | Updates an application form template |
| /templates/{template_id} | DELETE | - | Deletes an application form template |

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
| IDENTIFICATION_URL | URL of the authentication endpoint |