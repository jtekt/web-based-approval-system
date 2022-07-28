const createHttpError = require('http-errors')
const { driver } = require('../../db.js')


exports.update_comment = async (req, res, next) => {

    const session = driver.session()

    try {
        const { decision_id } = req.params
        const { comment } = req.body
        const user_id = res.locals.user?._id

        if (!decision_id) throw createHttpError(400, `Missing decision_id`)
        if (!comment) throw createHttpError(400, `Missing comment`)

        const cypher = `
            // Find current user to check for authorization
            MATCH (user:User)-[decision]->(application:ApplicationForm)
            WHERE user._id = $user_id
            AND decision._id = $decision_id

            // Set the attached hankos
            SET decision.comment = $comment

            // Return
            RETURN decision.comment as comment
            `

        const params = {
            user_id,
            decision_id,
            comment,
        }

        const { records } = await session.run(cypher, params)
        if (!records.length) throw createHttpError(404, `Decision ${decision_id} of user ${user_id} not found`)
        console.log(`Comment of decision ${decision_id} updated`)
        res.send({ comment: records[0].get('comment') })
    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}
