const driver = require('../../neo4j_driver.js')

function get_current_user_id(res) {
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

exports.create_application_form_template = (req, res) => {
  // Create application form template

  var session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (creator:User)
    WHERE id(creator) = toInteger($user_id)
    CREATE (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator)

    // setting all properties
    SET aft.fields=$fields
    SET aft.label=$label
    SET aft.description=$description

    // visibility (shared with)
    WITH aft
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInteger(group_id)
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | CREATE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN aft`, {
    user_id: get_current_user_id(res),
    fields: JSON.stringify(req.body.fields),
    label: req.body.label,
    description: req.body.description,
    group_ids: req.body.group_ids,
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Application template ${result.records[0].get('aft').identity.low} created`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}


exports.edit_application_form_template = (req, res) => {

  let template_id = req.params.template_id
    || req.query.template_id
    || req.query.id
    || req.body.template_id
    || req.body.id

  var session = driver.session()
  session
  .run(`
    // Find template
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)
    WHERE id(aft) = toInteger($template_id)
      AND id(creator) = toInteger($user_id)

    // set properties
    SET aft.fields=$fields
    SET aft.label=$label
    SET aft.description=$description

    // update visibility (shared with)
    // first delete everything
    // THIS IS A PROBLEM IF NOT VISIBLE TO ANY GROUP
    WITH aft
    OPTIONAL MATCH (aft)-[vis:VISIBLE_TO]->(:Group)
    DETACH DELETE vis

    // recreate visibility
    // Note: can be an empty set so the logic to deal with it looks terrible
    WITH aft
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInteger(group_id)
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | MERGE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN aft
    `, {
    user_id: get_current_user_id(res),
    template_id: template_id,
    fields: JSON.stringify(req.body.fields), // cannot have nested props
    label: req.body.label,
    description: req.body.description,
    group_ids: req.body.group_ids
  })
  .then((result) => {
    console.log(`Template ${template_id} updated`)
    res.send(result.records)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`DB error: ${error}`)
  })
  .finally(() => { session.close() })

}


exports.delete_application_form_template = (req, res) => {
  // Delete application form template

  let template_id = req.params.template_id
    || req.query.template_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    // Find application
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)
    WHERE id(aft) = toInteger($template_id)
      AND id(creator) = toInteger($user_id)

    // Delete the node
    DETACH DELETE aft

    // RETURN
    RETURN creator`, {
    user_id: get_current_user_id(res),
    template_id: template_id,
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Template ${template_id} deleted`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}


exports.get_application_form_template = (req, res) => {
  // get a single  application form template

  let template_id = req.params.template_id
    || req.query.template_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    MATCH (aft:ApplicationFormTemplate)
    WHERE id(aft) = toInteger($template_id)

    WITH aft
    MATCH (aft)-[:CREATED_BY]->(creator:User)

    WITH aft, creator
    OPTIONAL MATCH (aft)-[:VISIBLE_TO]->(group:Group)

    RETURN aft, creator, collect(distinct group) as groups`, {
    user_id: get_current_user_id(res),
    template_id: template_id,
  })
  .then((result) => {
    console.log(`Getting template ${template_id}`)
    let record = result.records[0]
    res.send(record)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}

exports.get_all_application_form_templates_visible_to_user = (req, res) => {

  // Get all templates (and their creator) visible to a user
  var session = driver.session()
  session
  .run(`
    // Find author
    MATCH (current_user:User)
    WHERE id(current_user) = toInteger($user_id)

    // Find the template and its creator
    WITH current_user
    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(current_user)
      OR id(creator) = id(current_user)

    RETURN DISTINCT aft, creator`, {
      user_id: get_current_user_id(res),
    })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_application_form_templates_shared_with_user = (req, res) => {
  // Gets the templates visible to a user but not the ones created by the user
  var session = driver.session()
  session
  .run(`
    //
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)

    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
      AND NOT id(user)=id(creator)

    RETURN DISTINCT aft, creator`, {
    user_id: get_current_user_id(res),
    })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}


exports.get_application_form_templates_from_user = (req, res) => {
  // Get application form template of a the current user
  var session = driver.session()
  session
  .run(`
    // Find user
    MATCH (creator:User)
    WHERE id(creator) = toInteger($user_id)

    // Find the templates of the user
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)

    // RETURN
    RETURN aft`, {
    user_id: get_current_user_id(res),
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}
