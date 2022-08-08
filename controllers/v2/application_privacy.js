const createHttpError = require('http-errors')
const { driver } = require('../../db.js')
const { get_current_user_id } = require('../../utils.js')

exports.update_application_privacy = async (req, res, next) => {

    // Make an application private or public

    const session = driver.session()

    try {

        if ( ! ('private' in req.body) ) throw createHttpError(400, 'Private not defined')

        const user_id = get_current_user_id(res)
        const { application_id } = req.params        
        const { private } = req.body

        const cypher = `
            // Find the application
            MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
            WHERE application._id = $application_id
            AND applicant._id = $user_id

            // Set the privacy property
            SET application.private = $private

            // Return the application
            RETURN PROPERTIES(application) as application
            `

        const params = { user_id, private, application_id }

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

        const user_id = get_current_user_id(res)
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

        const user_id = get_current_user_id(res)
        const { application_id, group_id } = req.params

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
            group_id,
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