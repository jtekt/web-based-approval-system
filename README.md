# Shinsei manager
A web-based application approval system

## API
### Application forms
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| application | GET | application_id | gets an application forms using its ID |
| application | POST | type, title, private, form_data, recipients_ids, group_ids | Creates an application forms |
| application | DELETE | application_id | Deletes an application forms |
| application/approve | POST/PUT | application_id | Approves an application forms |
| application/reject | POST/PUT | application_id | Rejects an application forms |
| applications/submitted | GET | - | Gets all submitted application forms |
| applications/submitted/pending | GET | - | Gets all pending submitted application forms |
| applications/submitted/rejected | GET | - | Gets all rejected submitted application forms |
| applications/submitted/approved | GET | - | Gets all approved submitted application forms |
| applications/received | GET | - | Gets all submitted application forms |
| applications/received/pending | GET | - | Gets all pending received application forms |
| applications/received/rejected | GET | - | Gets all rejected received application forms |
| applications/received/approved | GET | - | Gets all approved received application forms |

### Application form templates
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| application_form_template | GET | id | gets an application form template using its ID |
| application_form_template | POST | fields, label, description, group_ids | Creates an application form template |
| application_form_template | PUT | id, fields, label, description, group_ids | Updates an application form template |
| application_form_template | DELETE | id | Deletes an application form template |

## Environment configuration

| variable | Description
| --- | --- |
| NEO4J_URL | URL of the Neo4J instance |
| NEO4J_USERNAME | Username for the Neo4J instance |
| NEO4J_PASSWORD | Password for the Neo4J instance |
