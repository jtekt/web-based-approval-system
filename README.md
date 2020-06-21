# Shinsei manager
A web-based application approval system

## API
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| application | GET | application_id | gets an application using its ID |
| application | POST | type, title, private, form_data, recipients_ids, group_ids | Creates an application |
| application | DELETE | application_id | Deletes an application |
