const {driver} = require('../../db.js')

const {
  error_handling,
  get_current_user_id
} = require('../../utils.js')



exports.create_application_form_template = (req, res) => {
  // Create application form template

  const {
    label,
    description = '',
    fields = [],
    group_ids = [],
  } = req.body

  if(!label) return res.status(400).send(`missing label`)

  const session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (creator:User)
    WHERE creator._id = $user_id
    CREATE (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator)

    // setting all properties
    SET aft.fields=$fields
    SET aft.label=$label
    SET aft.description=$description
    SET aft._id = randomUUID()


    // visibility (shared with)
    WITH aft
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE group._id = group_id
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | CREATE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN aft`, {
    user_id: get_current_user_id(res),
    fields: JSON.stringify(fields),
    label,
    description,
    group_ids,
  })
  .then(({records}) => {
    const aft = records[0].get('aft')
    res.send(aft)
    console.log(`Application template ${aft.identity} created`)
  })
  .catch(error => { error_handling(error,res) })
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
    WHERE aft._id = $template_id
      AND creator._id = $user_id

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
    WHERE group._id = group_id
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
    WHERE aft._id = $template_id
      AND creator._id = $user_id

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

  const template_id = req.params.template_id
  const user_id = get_current_user_id(res)


  var session = driver.session()
  session
  .run(`
    MATCH (aft:ApplicationFormTemplate)
    WHERE aft._id = $template_id

    WITH aft
    MATCH (aft)-[:CREATED_BY]->(creator:User)

    WITH aft, creator
    OPTIONAL MATCH (aft)-[:VISIBLE_TO]->(group:Group)

    RETURN aft, creator, collect(distinct group) as groups`,
    {
    user_id,
    template_id,
  })
  .then( ({records}) => {
    console.log(`Template ${template_id} queried`)

    if(records.length < 1) {
      console.log(`Template ${template_id} not found`)
      return res.status(404).send(`Template ${template_id} not found`)
    }

    const record = records[0]

    const template = record.get('aft')
    template.properties.fields = JSON.parse(template.properties.fields)

    res.send({
      ...template,
      author: record.get('creator'),
      groups: record.get('groups'),
    })

  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}

exports.get_all_application_form_templates_visible_to_user = (req, res) => {

  // Used when creating an application form

  const user_id = get_current_user_id(res)

  // Get all templates (and their creator) visible to a user
  const session = driver.session()
  session
  .run(`
    // Find author
    MATCH (current_user:User)
    WHERE current_user._id = $user_id

    // Find the template and its creator
    WITH current_user
    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(current_user)
      OR id(creator) = id(current_user)

    RETURN DISTINCT aft, creator`,
    { user_id, })
  .then( ({records}) => {
    console.log(`Templates visible to user ${user_id}`)

    const templates = records.map(record => {
      const template = record.get('aft')
      template.properties.fields = JSON.parse(template.properties.fields)
      return {
        ...template,
        author: record.get('creator'),
      }
    })

    res.send(templates)
   })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}
