# Shinsei manager
A web-based application approval system

## API
### Application forms
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /v2/applications | POST | type, title, private, form_data, recipients_ids, group_ids | Creates an application form |
| /v3/applications/submitted | GET | Coming soon... | Find application forms |
| /v2/applications/{application_id} | GET | - | gets an application forms using its ID (Please note the v2 in the URL)|
| /v2/applications/{application_id} | DELETE | - | Deletes an application forms |
| /applications/{application_id}/approve | POST | - | Approves an application forms |
| /applications/{application_id}/reject | POST | - | Rejects an application forms |
| /applications/{application_id}/files/{file_id} | GET | - | Gets an attachment of an application |

### Application form templates
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /application_form_templates/ | POST | template_properties | Create a form template |
| /application_form_templates/ | GET | - | Get templates visible to the current user |
| /application_form_templates/{template_id} | GET | - | gets an application form template using its ID |
| /application_form_templates/{template_id} | POST | fields, label, description, group_ids | Creates an application form template |
| /application_form_templates/{template_id} | PUT | fields, label, description, group_ids | Updates an application form template |
| /application_form_templates/{template_id} | DELETE | - | Deletes an application form template |

### Attachments
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| /files | POST | multipart/form-data with file as 'file_to_upload' | Creates an attachment |

## Schemas
### GET
This is how an application form is formatted when querying it using a GET request:

```javascript
{
  identity: Number,
  properties: {
    title: String,
    type: String,
    form_data: Object,
    creation_date: Object,
    private: Boolean,
  },
  recipients: [
    {
      identity: Number,
      properties: Object,
      approval: {
        identity: String,
        properties: {
          date: Object,
          comment: String,
          attachment_hankos: Stringified JSON,
        }
      },
      refusal: {
        identity: String,
        properties: {
          comment: String,
          date: Object,
        }
      }
    },
    // Other recipients
  ],
  visibility: [
    {
      identity: Number,
      properties: Object,
    },
    // Other groups
  ]
}

```

## Environment variables

| variable | Description
| --- | --- |
| NEO4J_URL | URL of the Neo4J instance |
| NEO4J_USERNAME | Username for the Neo4J instance |
| NEO4J_PASSWORD | Password for the Neo4J instance |
