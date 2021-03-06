const { driver } = require('../../db.js')
const createHttpError = require('http-errors')
const { v4: uuidv4 } = require('uuid')
const {
    get_current_user_id,
    get_application_id,
    filter_by_user_id,
    filter_by_applcation_id,
    application_batching,
    return_application_and_related_nodes,
    format_application_from_record,
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

    const session = driver.session()

    try {

        const current_user_id = get_current_user_id(req)

        const {
            user_id = current_user_id, /// by default, focuses on current user
            group_id,
            relationship,
            state, // approved,
            type,
            start_date,
            end_date,
            application_id, // redudant with GET /applications/:application_id
            hanko_id,
            start_index = 0,
            batch_size = 10,
            deleted = false,
        } = req.query

        const cypher_query = `
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
            ${query_with_application_id(application_id)}

            `
        
        const params = {
            user_id
        }

        res.status(501).send('Not implemented')


    } 
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
    



}

exports.read_application = async (req, res, next) => {
    res.status(501).send('Not implemented')


}