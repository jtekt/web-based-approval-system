const { driver } = require('../../db.js')
const createHttpError = require('http-errors')
const {
    get_current_user_id,
} = require('../../utils.js')

exports.create_application = async (req, res, next) => {

    
}

exports.read_applications = async (req, res, next) => {

    const session = driver.session()

    try {

        const user_id = get_current_user_id(req)

        const cypher_query = `
            MATCH (user:User {_id: $user_id})
            WITH user
            `
        
            const params = {
                user_id
            }
    } 
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }
    



}

exports.read_application = async (req, res, next) => {


}