const {driver} = require('../../db.js')
const {
  format_application_from_record,
  return_application_and_related_nodes,
  query_applications_submitted_by_user,
  query_applications_submitted_to_user,
  query_submitted_rejected_applications,
  query_submitted_pending_applications,
  query_submitted_approved_applications,
  query_received_pending_applications,
  query_received_rejected_applications,
  query_received_approved_applications,
  application_batching,
  filter_by_type,
  get_current_user_id,
  get_application_id,
} = require('../../utils.js')


exports.get_application = (req, res) => {
  // Get a single application using its ID

  const user_id = get_current_user_id(res)
  const {application_id} = req.params
  if(!application_id) return res.status(400).send('Application ID not defined')

  const query = `
    // Find application
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInteger($application_id)
      AND NOT EXISTS(application.deleted)
    ${return_application_and_related_nodes}
    `

  const params = { user_id, application_id }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {

    const record = records[0]

    if(!record) {
      console.log(`Application ${application_id} not found`)
      return res.status(404).send(`Application ${application_id} not found`)
    }

    const application = format_application_from_record(record)

    res.send(application)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.delete_application = (req, res) => {
  // Deleting an application
  // Only the creator can delete the application
  // Applications are not actually deleted, just flagged as so

  const user_id = get_current_user_id(res)
  if(!user_id) return res.status(400).send('User ID not defined')

  const application_id = get_application_id(req)
  if(!application_id) return res.status(400).send('Application ID not defined')

  const query = `
    // Find the application to be deleted using provided id
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
    WHERE id(application) = toInteger($application_id)
      AND id(applicant) = toInteger($user_id)

    // flag as deleted
    SET application.deleted = True

    RETURN application
    `

  const params = {user_id, application_id}

  var session = driver.session()
  session.run(query,params)
  .then(({records}) => {

    if(!records.length) {
      console.log(`Application ${application_id} not found`)
      return res.status(404).send(`Application ${application_id} not found`)
    }

    const application = records[0].get('application')

    res.send(application)
    console.log(`Application ${application_id} marked as deleted`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}


// The following has been replaced with API V3
exports.get_submitted_pending_applications = (req, res) => {

  const user_id = get_current_user_id(res)
  const {
    type,
    start_index = 0,
    batch_size = 10,
  } = req.query

  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_pending_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id,
    start_index,
    batch_size,
    type,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_rejected_applications = (req, res) => {

  const user_id = get_current_user_id(res)
  const {
    type,
    start_index = 0,
    batch_size = 10,
  } = req.query


  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_rejected_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id,
    start_index,
    batch_size,
    type,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_approved_applications = (req, res) => {

  const user_id = get_current_user_id(res)
  const {
    type,
    start_index = 0,
    batch_size = 10,
   } = req.query

  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_approved_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `

  const params = {
    user_id,
    start_index,
    batch_size,
    type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_pending_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_pending_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_rejected_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_rejected_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_approved_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_by_user}
  ${filter_by_type(req.query.type)}
  ${query_submitted_approved_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}


// RECEIVED
exports.get_received_pending_applications = (req, res) => {

  const {
    type,
    start_index = 0,
    batch_size = 10,
  } = req.query

  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_pending_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id,
    start_index,
    batch_size,
    type,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_rejected_applications = (req, res) => {

  const user_id = get_current_user_id(res)
  const {
    type,
    start_index = 0,
    batch_size = 10,
   } = req.query


  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_rejected_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id,
    start_index,
    batch_size,
    type,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_approved_applications = (req, res) => {

  const {
    type,
    start_index = 0,
    batch_size = 10,
  } = req.query

  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_approved_applications}
  ${application_batching}
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id,
    start_index,
    batch_size,
    type,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_pending_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_pending_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_rejected_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)

  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_rejected_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_approved_applications_count = (req, res) => {

  const { type } = req.query
  const user_id = get_current_user_id(res)


  const query = `
  ${query_applications_submitted_to_user}
  ${filter_by_type(req.query.type)}
  ${query_received_approved_applications}
  RETURN count(application) as application_count
  `
  const params = { user_id, type }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}
