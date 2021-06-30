const mv = require('mv')
const fs = require('fs')
const path = require('path')
const uuidv1 = require('uuid/v1')
const formidable = require('formidable')
const driver = require('../../neo4j_driver.js')
const { readdirSync } = require('fs')

const uploads_directory_path = "/usr/share/pv" // For production in k8s



exports.get_unused_files = (req, res) => {


  const session = driver.session()

  session
  .run(`
    MATCH (application:ApplicationForm)
    WHERE application.form_data CONTAINS 'file'
    RETURN application.form_data as form_data
    `, {})
  .then(({records}) => {


    const attachments = records.reduce((acc, record) => {
      const fields = JSON.parse(record.get('form_data'))

      // File fileds of this record (can be empty)
      const file_fields = fields.filter(field => field.type === 'file' && !!field.value)
      if(file_fields.length > 0) {
        file_fields.forEach(field => {acc.push(field.value)} )
      }

      return acc

    }, [])

    const directories = readdirSync(uploads_directory_path)

    const unused_uploads = directories.filter((directory) => {
      return !attachments.find(attachment => directory === attachment)
    })

    res.send(unused_uploads)

  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}
