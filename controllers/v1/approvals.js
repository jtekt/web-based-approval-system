const {driver} = require('../../db.js')

const {
  get_current_user_id,
  error_handling,
  filter_by_user_id,
} = require('../../utils.js')



exports.update_attachment_hankos = (req, res) => {

  // Used to save the location of stamps on an attachment

  const {approval_id} = req.params
  const user_id =get_current_user_id(res)

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)-[approval:APPROVED]->(application:ApplicationForm)
    ${filter_by_user_id}
      AND approval._id = $approval_id

    // Set the attached hankos
    SET approval.attachment_hankos = $attachment_hankos

    // Return
    RETURN approval

    `, {
    user_id,
    approval_id,
    attachment_hankos: JSON.stringify(req.body.attachment_hankos), // Neo4J does not support nested props so convert to string
  })
  .then( ({records}) => {
    if(!records.length) throw {code: 404, message: `Approval ${approval_id} not found`}
    const approval = records[0].get('approval')
    console.log(`Attached hankos of approval ${approval_id} updated`)
    res.send(approval)

  })
  .catch(error => {
    error_handling(error, res)
  })
  .finally(() => { session.close() })

}
