const driver = require('../neo4j_driver.js')


exports.create_application_form_template = (req, res) => {
  // Create application form template

  var session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (creator:User)
    WHERE id(creator) = toInt({user_id})
    CREATE (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator)

    // setting all properties
    SET aft.fields={fields}
    SET aft.label={label}
    SET aft.description={description}

    // visibility (shared with)
    WITH aft
    UNWIND
      CASE
        WHEN {group_ids} = []
          THEN [null]
        ELSE {group_ids}
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInt(group_id)
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | CREATE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN aft`, {
    user_id: res.locals.user.identity.low,
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
    WHERE id(aft) = toInt({template_id})
      AND id(creator) = toInt({user_id})

    // set properties
    SET aft.fields={fields}
    SET aft.label={label}
    SET aft.description={description}

    // update visibility (shared with)
    // first delete everything
    // THIS IS A PROBLEM IF NOT VISIBLE TO ANY GROUP
    WITH aft
    MATCH (aft)-[vis:VISIBLE_TO]->(:Group)
    DETACH DELETE vis

    // recreate
    // Note: can be an empty set so the logic to deal with it looks terrible
    WITH aft
    UNWIND
      CASE
        WHEN {group_ids} = []
          THEN [null]
        ELSE {group_ids}
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInt(group_id)
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | MERGE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN aft
    `, {
    user_id: res.locals.user.identity.low,
    template_id: template_id,
    fields: JSON.stringify(req.body.fields), // cannot have nested props
    label: req.body.label,
    description: req.body.description,
    group_ids: req.body.group_ids
  })
  .then((result) => { res.send(result.records) })
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
    WHERE id(aft) = toInt({template_id})
      AND id(creator) = toInt({user_id})

    // Delete the node
    DETACH DELETE aft

    // RETURN
    RETURN creator`, {
    user_id: res.locals.user.identity.low,
    template_id: template_id,
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Application template ${template_id} got deleted`)
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
    MATCH (aft:ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)
    WHERE id(aft) = toInt({template_id})
    RETURN aft, creator`, {
    user_id: res.locals.user.identity.low,
    template_id: template_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}

exports.get_application_form_template_visibility = (req, res) => {
  // get a single  application form template

  let template_id = req.params.template_id
    || req.query.template_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    // Find the template
    MATCH (aft:ApplicationFormTemplate)
    WHERE id(aft) = toInt({template_id})

    // Find the current user
    WITH aft
    MATCH (user:User)
    WHERE id(user) = toInt({user_id})

    // enforce visibility
    WITH aft, user
    WHERE (aft)-[:CREATED_BY]->(user)
      OR (user)-[:BELONGS_TO]->(:Group)<-[:VISIBLE_TO]-(aft)

    MATCH (group:Group)<-[:VISIBLE_TO]-(aft)

    RETURN group`, {
    user_id: res.locals.user.identity.low,
    template_id: template_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}

exports.get_all_application_form_templates_visible_to_user = (req, res) => {

  // Create application form template
  var session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInt({user_id})

    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)

    RETURN DISTINCT aft, creator`, {
    user_id: res.locals.user.identity.low,
    })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_application_form_templates_shared_with_user = (req, res) => {
  var session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInt({user_id})

    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
      AND NOT id(user)=id(creator)

    RETURN DISTINCT aft, creator`, {
    user_id: res.locals.user.identity.low,
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
    WHERE id(creator) = toInt({user_id})

    // Find the templates of the user
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)

    // RETURN
    RETURN aft`, {
    user_id: res.locals.user.identity.low,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}
