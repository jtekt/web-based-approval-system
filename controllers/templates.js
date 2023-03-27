const createHttpError = require("http-errors")
const { driver } = require("../db.js")
const { get_current_user_id } = require("../utils.js")

exports.create_template = async (req, res) => {
  // Create application form template
  const session = driver.session()

  try {
    const {
      label = `Unnnamed template`,
      description = "",
      fields = [],
      group_ids = [],
    } = req.body

    const user_id = get_current_user_id(res)

    const cypher = `
    // Find creator
    MATCH (creator:User {_id: $user_id})
    CREATE (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator)

    // setting all properties
    SET aft = $template_properties
    SET aft._id = randomUUID()


    // visibility (shared with)
    WITH aft
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group {_id: group_id})
    WITH collect(group) as groups, aft
    FOREACH(group IN groups | CREATE (aft)-[:VISIBLE_TO]->(group))

    // RETURN
    RETURN properties(aft) as template`

    const params = {
      user_id,
      template_properties: {
        fields: JSON.stringify(fields), // Neo4J cannot store nested properties
        label,
        description,
      },
      group_ids,
    }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(500, `Failed to create the template`)
    const template = records[0].get("template")
    console.log(`Application template ${template._id} created`)
    res.send(template)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.read_templates = async (req, res) => {
  // Read application form templates
  const session = driver.session()

  try {
    const user_id = get_current_user_id(res)

    const cypher = `
      // Find author
      MATCH (current_user:User {_id: $user_id})

      // Find the template and its creator
      WITH current_user
      MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
      WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(current_user)
        OR creator._id = current_user._id

      WITH aft, creator
      OPTIONAL MATCH (aft)-[:VISIBLE_TO]->(group:Group)

      RETURN DISTINCT PROPERTIES(aft) as template,
        PROPERTIES(creator) as creator,
        COLLECT(DISTINCT PROPERTIES(group)) as groups`

    const { records } = await session.run(cypher, { user_id })

    const templates = records.map((record) => {
      const template = record.get("template")
      template.fields = JSON.parse(template.fields)
      return {
        ...template,
        author: record.get("creator"),
        groups: record.get("groups"),
      }
    })

    res.send(templates)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.read_template = async (req, res) => {
  // Read single application form template
  const session = driver.session()

  try {
    const { template_id } = req.params
    const user_id = get_current_user_id(res)

    const cypher = `
      MATCH (aft:ApplicationFormTemplate {_id: $template_id})

      WITH aft
      MATCH (aft)-[:CREATED_BY]->(creator:User)

      WITH aft, creator
      OPTIONAL MATCH (aft)-[:VISIBLE_TO]->(group:Group)

      RETURN 
        PROPERTIES(aft) as template, 
        PROPERTIES(creator) as creator, 
        COLLECT(DISTINCT PROPERTIES(group)) as groups
      `

    const params = { user_id, template_id }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(400, `Template ${template_id} not found`)

    const record = records[0]

    const template = record.get("template")
    template.fields = JSON.parse(template.fields)

    const response = {
      ...template,
      author: record.get("creator"),
      groups: record.get("groups"),
    }

    res.send(response)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.update_template = async (req, res) => {
  // Update single application form template
  const session = driver.session()

  try {
    const { template_id } = req.params
    const { label, description, group_ids, fields } = req.body

    const user_id = get_current_user_id(res)

    const cypher = `
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
      RETURN PROPERTIES(aft) AS template
      `

    const params = {
      template_id,
      user_id,
      fields: JSON.stringify(fields), // cannot have nested props
      label,
      description,
      group_ids,
    }

    const { records } = await session.run(cypher, params)

    if (!records.length)
      throw createHttpError(500, `Failed to update template ${template_id}`)

    const template = records[0].get("template")
    console.log(`Template ${template_id} updated`)
    res.send(template)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.delete_template = async (req, res) => {
  // Delete single application form template
  const session = driver.session()

  try {
    const { template_id } = req.params
    const user_id = get_current_user_id(res)

    const cypher = `
      // Find application
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)
    WHERE aft._id = $template_id
      AND creator._id = $user_id

    // Delete the node
    DETACH DELETE aft

    RETURN $template_id AS template_id
    `

    const params = { template_id, user_id }

    const { records } = await session.run(cypher, params)

    if (!records.length)
      throw createHttpError(500, `Failed to delete template ${template_id}`)

    const deleted_template_id = records[0].get("template_id")
    console.log(`Template ${template_id} updated`)
    res.send({ deleted_template_id })
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}