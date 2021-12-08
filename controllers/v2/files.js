const mv = require('mv')
const fs = require('fs')
const path = require('path')
const uuidv1 = require('uuid/v1')
const formidable = require('formidable')
const {driver} = require('../../db.js')
const { readdirSync } = require('fs')

const uploads_directory_path = "/usr/share/pv" // For production in k8s

function get_unused_files(){

  return new Promise((resolve, reject) => {
    const session = driver.session()

    session.run(`
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

      // ignore trash
      const unused_uploads = directories.filter( directory => {
        return !attachments.find(attachment => (directory === attachment || directory === 'trash') )
      })

      resolve(unused_uploads)
    })
    .catch(reject)
    .finally(() => { session.close() })

  })

}

exports.get_unused_files = (req, res) => {
  get_unused_files()
  .then(unused_uploads => {
    res.send(unused_uploads)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}

exports.move_unused_files = (req, res) => {

  const user = res.locals.user
  if(!user.properties.isAdmin) return res.status(403).send('User must be admin')

  get_unused_files()
  .then(unused_uploads => {

    const promises = []
    unused_uploads.forEach(upload => {

      const promise = new Promise((resolve, reject) => {
        const old_path = path.join(uploads_directory_path,upload)
        const new_path = path.join(uploads_directory_path,'trash',upload)

        mv(old_path, new_path, {mkdirp: true}, (err) => {
          if (err) return reject(err)
          resolve(upload)
        })
      })

      promises.push(promise)

    })

    return Promise.all(promises)

  })
  .then( (items) => {
    res.send({deleted_count: items.length})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}
