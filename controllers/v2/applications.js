const { driver } = require('../../db.js')
const createHttpError = require('http-errors')
const { v4: uuidv4 } = require('uuid')
const {
    get_current_user_id,
    get_application_id,
    filter_by_user_id,
    filter_by_applcation_id,
    application_batching,
    return_application_and_related_nodes_v2,
    format_application_from_record_v2,
    filter_by_type,
    query_with_hanko_id,
    query_with_application_id,
    query_with_date,
    query_with_group,
    query_deleted,
    query_with_relationship_and_state,
} = require('../../utils.js')


exports.create_application = async (req, res, next) => {
    res.status(501).send('Not implemented')
}

exports.read_applications = async (req, res, next) => {

    // query a list of applications

    const session = driver.session()

    try {

        const current_user_id = get_current_user_id(res)

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

        const user_id = get_current_user_id(res)
        const { application_id } = req.params

        if (!user_id) throw createError(400, 'User ID not defined')
        if (!application_id) throw createError(400, 'Application ID not defined')

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

        if (!record) throw createError(404, `Application ${application_id} not found`)

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