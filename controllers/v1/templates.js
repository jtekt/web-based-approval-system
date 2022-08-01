const createError = require('http-errors')
const {driver} = require('../../db.js')

const {
  get_current_user_id
} = require('../../utils.js')



exports.create_application_form_template = (req, res, next) => {
  // Create application form template

  const {
    label = `Unnnamed template`,
    description = '',
    fields = [],
    group_ids = [],
  } = req.body

  const session = driver.session()

  const query = `
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
    RETURN aft`

  const params = {
    user_id: get_current_user_id(res),
    fields: JSON.stringify(fields),
    label,
    description,
    group_ids,
  }

  session
    .run(query, params)
    .then(({records}) => {
      const aft = records[0].get('aft')
      res.send(aft)
      console.log(`Application template ${aft.identity} created`)
    })
    .catch(next)
    .finally(() => { session.close() })

}


exports.edit_application_form_template = (req, res, next) => {

  const template_id = req.params.template_id
    || req.query.template_id
    || req.query.id
    || req.body.template_id
    || req.body.id

  const {
    label,
    description,
    group_ids,
    fields,
  } = req.body

  const session = driver.session()

  const query = `
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
    `

  const params = {
    template_id,
    user_id: get_current_user_id(res),
    fields: JSON.stringify(fields), // cannot have nested props
    label,
    description,
    group_ids
  }

  session
    .run(query, params)
    .then(({records}) => {
      console.log(`Template ${template_id} updated`)
      res.send(records)
    })
    .catch(next)
    .finally(() => { session.close() })

}


exports.delete_application_form_template = (req, res, next) => {
  // Delete application form template

  let template_id = req.params.template_id
    || req.query.template_id
    || req.query.id

  const session = driver.session()

  const query = `
    // Find application
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)
    WHERE aft._id = $template_id
      AND creator._id = $user_id

    // Delete the node
    DETACH DELETE aft

    // RETURN
    RETURN creator`

  const params = {
    user_id: get_current_user_id(res),
    template_id,
  }

  session
    .run(query, params)
    .then(({records}) => {
      res.send(records)
      console.log(`Template ${template_id} deleted`)
    })
    .catch(next)
    .finally(() => { session.close() })
}


exports.get_application_form_template = (req, res, next) => {
  // get a single  application form template

  const {template_id} = req.params
  const user_id = get_current_user_id(res)


  const session = driver.session()

  const query = `
    MATCH (aft:ApplicationFormTemplate)
    WHERE aft._id = $template_id

    WITH aft
    MATCH (aft)-[:CREATED_BY]->(creator:User)

    WITH aft, creator
    OPTIONAL MATCH (aft)-[:VISIBLE_TO]->(group:Group)

    RETURN aft, creator, collect(distinct group) as groups
    `

  const params = { user_id, template_id }

  session
    .run(query,params)
    .then( ({records}) => {
      console.log(`Template ${template_id} queried`)

      if(!records.length) throw createError(404, `Template ${template_id} not found`)
      const record = records[0]

      const template = record.get('aft')
      template.properties.fields = JSON.parse(template.properties.fields)

      res.send({
        ...template,
        author: record.get('creator'),
        groups: record.get('groups'),
      })

    })
    .catch(next)
    .finally(() => { session.close() })
}

exports.get_all_application_form_templates_visible_to_user = (req, res, next) => {

  // Note: This should be achieved with GET /templates

  // Used when creating an application form

  const user_id = get_current_user_id(res)

  // Get all templates (and their creator) visible to a user
  const session = driver.session()

  const query = `
    // Find author
    MATCH (current_user:User)
    WHERE current_user._id = $user_id

    // Find the template and its creator
    WITH current_user
    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(current_user)
      OR id(creator) = id(current_user) // This is not a problem

    RETURN DISTINCT aft, creator`


  session
    .run(query, { user_id, })
    .then( ({records}) => {
      console.log(`Queried templates visible to user ${user_id}`)

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
    .catch(next)
    .finally(() => { session.close() })
}
