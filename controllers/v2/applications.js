const { driver } = require('../../db.js')
const createHttpError = require('http-errors')
const {
    application_batching,
    return_application_and_related_nodes_v2,
    format_application_from_record_v2,
    filter_by_type,
    query_with_hanko_id,
    query_with_date,
    query_with_group,
    query_deleted,
    query_with_relationship_and_state,
} = require('../../utils.js')


exports.create_application = async (req, res, next) => {
    // Create an application form

    const session = driver.session()

    try {
        const {
            type,
            title,
            form_data,
            recipients_ids = [],
            private = false,
            group_ids = [],
        } = req.body

        const user_id = res.locals.user?._id

        if (!recipients_ids.length) throw createHttpError(400, `Application requires one or more recipient`)

        const cypher = `
        // Create the application node
        MATCH (user:User {_id: $user_id})
        CREATE (application:ApplicationForm)-[:SUBMITTED_BY {date: date()} ]->(user)

        // Set the application properties using data passed in the request body
        SET application = $application_properties
        SET application._id = randomUUID()
        SET application.creation_date = date()

        // Relationship with recipients
        // This also creates flow indices
        // Note: flow cannot be empty
        WITH application, $recipients_ids as recipients_ids
        UNWIND range(0, size(recipients_ids)-1) as i
        MATCH (recipient:User {_id: recipients_ids[i]})
        CREATE (recipient)<-[:SUBMITTED_TO {date: date(), flow_index: i} ]-(application)

        // Groups to which the aplication is visible
        // Note: can be an empty set so the logic to deal with it looks terrible
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

        // Finally, Return the created application
        RETURN properties(application) as application
        `  

        const params = {
            user_id,
            application_properties: {
                form_data: JSON.stringify(form_data), // Neo4J does not support nested props so convert to string
                type,
                title,
                private,
            },
            group_ids,
            recipients_ids,
        }

        const { records } = await session.run(cypher, params)

        if (!records.length) throw createHttpError(500, `Failed to create the application`)
        const application = records[0].get('application')
        console.log(`Application ${application._id} created`)
        res.send(application)

    } 
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}


exports.read_applications = async (req, res, next) => {

    // query a list of applications

    const session = driver.session()

    try {

        const current_user_id = res.locals.user?._id

        const {
            user_id = current_user_id, // by default, focuses on current user
            group_id,
            relationship,
            state,
            type,
            start_date,
            end_date,
            hanko_id,
            start_index = 0,
            batch_size = 10,
            deleted = false,
        } = req.query

        const cypher = `
            MATCH (user:User {_id: $user_id})
            WITH user
            MATCH (application:ApplicationForm)
            ${query_with_relationship_and_state(relationship, state)}

            // from here on, no need for user anymore
            // gets requeried later on
            ${query_deleted(deleted)}
            ${filter_by_type(type)}
            ${query_with_date(start_date, end_date)}
            ${query_with_group(group_id)}
            ${query_with_hanko_id(hanko_id)}

            // batching
            ${application_batching}
            ${return_application_and_related_nodes_v2}

            `
        
        const params = {
            user_id,
            relationship,
            type,
            start_date,
            end_date,
            start_index,
            batch_size,
            hanko_id,
            group_id,
        }

        const { records } = await session.run(cypher, params)

        const count = records.length ? records[0].get('application_count') : 0

        const applications = records.map(record => format_application_from_record_v2(record))


        res.send({
            count,
            applications,
            start_index,
            batch_size
        })

    } 
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
    
}

exports.read_application = async (req, res, next) => {

    // query a single of applications

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params

        if (!user_id) throw createHttpError(400, 'User ID not defined')
        if (!application_id) throw createHttpError(400, 'Application ID not defined')

        const cypher = `
            // Find application
            MATCH (application:ApplicationForm {_id: $application_id})
            WHERE NOT EXISTS(application.deleted)

            // Dummy application_count because following query uses it
            WITH application, 1 as application_count
            ${return_application_and_related_nodes_v2}
            `

        const params = { user_id, application_id }

        const { records } = await session.run(cypher, params)

        const record = records[0]

        if (!record) throw createHttpError(404, `Application ${application_id} not found`)


        const application = format_application_from_record_v2(record)

        console.log(`Application ${application_id} queried by user ${user_id}`)
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }



}

exports.get_application_types = async (req, res, next) => {

    // Used for search
    const session = driver.session()

    try {
        const cypher = `
        MATCH (application:ApplicationForm)
        RETURN DISTINCT(application.type) as application_type
        `

        const { records } = await session.run(cypher, {})
        const types = records.map(record => record.get('application_type'))
        res.send(types)
    } 
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
}

exports.delete_application = async (req, res, next) => {

    // Delete a single of applications
    // Note: only marks applications as deleted and not actually delete nodes

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params

        if (!user_id) throw createHttpError(400, 'User ID not defined')
        if (!application_id) throw createHttpError(400, 'Application ID not defined')

        const cypher = `
            // Find application
            MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm )
            WHERE applicant._id = $user_id
                AND application._id = $application_id

            // flag as deleted
            SET application.deleted = True

            RETURN properties(application) as application
            `

        const params = { user_id, application_id }

        const { records } = await session.run(cypher, params)
        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        const application = records[0].get('application')

        console.log(`Application ${application_id} deleted`)
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}


exports.approve_application = async (req, res, next) => {

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params

        const {
            attachment_hankos,
            comment = '',
        } = req.body

        if (!user_id) throw createHttpError(400, 'User ID not defined')
        if (!application_id) throw createHttpError(400, 'Application ID not defined')

        const attachment_hankos_query = attachment_hankos ? 
            `SET approval.attachment_hankos = $attachment_hankos` : ''
            
        const cypher = `
            // Find the application and get oneself at the same time
            MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
            WHERE application._id = $application_id
            AND recipient._id = $user_id

            // TODO: Add check if flow is respected

            // Mark as approved
            WITH application, recipient
            MERGE (application)<-[approval:APPROVED]-(recipient)
            ON CREATE SET approval.date = date()
            ON CREATE SET approval._id = randomUUID()
            SET approval.comment = $comment
            ${attachment_hankos_query}

            RETURN PROPERTIES(approval) as approval,
                PROPERTIES(recipient) as recipient, 
                PROPERTIES(application) as application
            `

        const params = {
            user_id,
            application_id,
            comment,
            attachment_hankos: JSON.stringify(attachment_hankos), // Neo4J does not support nested props so convert to string
        }
        
        const { records } = await session.run(cypher, params)
        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        const application = records[0].get('application')
        const {_id: recipient_id} = records[0].get('recipient')

        console.log(`Application ${application_id} approved by user ${recipient_id}`)
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}

exports.reject_application = async (req, res, next) => {

    const session = driver.session()

    try {

        const user_id = res.locals.user?._id
        const { application_id } = req.params

        const {
            comment = '',
        } = req.body

        if (!user_id) throw createHttpError(400, 'User ID not defined')
        if (!application_id) throw createHttpError(400, 'Application ID not defined')


        const cypher = `
            MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
            WHERE application._id = $application_id
            AND recipient._id = $user_id

            // TODO: Add check if flow is respected

            // Mark as REJECTED
            WITH application, recipient
            MERGE (application)<-[rejection:REJECTED]-(recipient)
            ON CREATE SET rejection._id = randomUUID()
            ON CREATE SET rejection.date = date()
            SET rejection.comment = $comment

            RETURN PROPERTIES(approval) as approval,
                PROPERTIES(recipient) as recipient, 
                PROPERTIES(application) as application
            `


        const params = {
            user_id,
            application_id,
            comment,
        }

        const { records } = await session.run(cypher, params)
        if (!records.length) throw createHttpError(404, `Application ${application_id} not found`)

        const application = records[0].get('application')
        const { _id: recipient_id } = records[0].get('recipient')

        console.log(`Application ${application_id} rejected by user ${recipient_id}`)
        res.send(application)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}
