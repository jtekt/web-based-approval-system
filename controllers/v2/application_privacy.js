const { driver } = require('../../db.js')
const createHttpError = require('http-errors')

exports.update_application_privacy = async (req, res, next) => {

    // Make an application private or public

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params
        const { group_ids } = req.body

        const cypher = `
        // Find the application
        // Only the applicant can make the update
        MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user:User)
        WHERE application._id = $application_id
        AND applicant._id = $user_id

        // delete all visibility relationships
        WITH application
        MATCH (application)-[rel:VISIBLE_TO]->(:Group)
        DELETE rel

        // Now recreate all relationships
        WITH application
        UNWIND
        CASE
            WHEN $group_ids = []
            THEN [null]
            ELSE $group_ids
        END AS group_id

        OPTIONAL MATCH (group:Group {_id: group_id})
        WITH collect(group) as groups, application
        FOREACH(group IN groups | MERGE (application)-[:VISIBLE_TO]->(group))

        // Return the application
        RETURN PROPERTIES(application) as application, 
            PROPERTIES(group) as group
        `

        const params = {
            user_id,
            group_ids,
            application_id,
        }

        const { records } = await session.run(cypher, params)

        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        console.log(`Application ${application_id} privacy updated`)

        const application = records[0].get('application')
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
}




exports.make_application_visible_to_group = async (req, res, next) => {

    // Make a private application visible to a certain group

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params
        const { group_id } = req.body

        if (!group_id) throw createHttpError(400, 'Group ID not defined')


        const cypher = `
        // Find the application
        // Only the applicant can make the update
        MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
        WHERE application._id = $application_id
        AND applicant._id = $user_id

        // Find the group
        WITH application
        MATCH (group:Group {_id: $group_id})

        // Create the application
        MERGE (application)-[:VISIBLE_TO]->(group)

        // Return the application
        RETURN PROPERTIES(application) as application, 
            PROPERTIES(group) as group
        `

        const params = {
            user_id,
            group_id,
            application_id,
        }

        const { records } = await session.run(cypher, params)

        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        console.log(`Application ${application_id} made visible to group ${group_id}`)

        const application = records[0].get('application')
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
}


exports.remove_application_visibility_to_group = async (req, res, next) => {

    // Remove visibility of a private application to a certain group

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id, group_ids } = req.params

        const cypher = `
        // Find the application
        // Only the applicant can make the update
        MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
        WHERE application._id = $application_id
        AND applicant._id = $user_id

        // Find the group
        WITH application
        MATCH (application)-[rel:VISIBLE_TO]->(group)
        WHERE group._id = $group_id

        // delete the relationship
        DELETE rel

        // Return the application
        RETURN PROPERTIES(application) as application
        `

        const params = {
            user_id,
            group_ids,
            application_id,
        }

        const { records } = await session.run(cypher, params)

        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        console.log(`Removed visibility of application ${application_id} to group ${group_id}`)

        const application = records[0].get('application')
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
}