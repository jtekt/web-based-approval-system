var driver = require('./neo4j_driver.js')
const express = require('express')
const auth = require('./auth.js')

const router = express.Router()



let get_all_application_form_templates_visible_to_user = (req, res) => {

  // Create application form template
  var session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInt({user_id})

    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)

    RETURN DISTINCT aft, creator`, {
    user_id: res.locals.user.identity.low,
    })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

let get_application_form_templates_shared_with_user = (req, res) => {

  // Create application form template
  var session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInt({user_id})

    MATCH (creator:User)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)
    WHERE (aft)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
      AND NOT id(user)=id(creator)

    RETURN DISTINCT aft, creator`, {
    user_id: res.locals.user.identity.low,
    })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}


let get_application_form_templates_from_user = (req, res) => {
  // Get application form template of a the current user
  // This is not secure
  var session = driver.session()
  session
  .run(`
    // Find user
    MATCH (creator:User)
    WHERE id(creator) = toInt({user_id})

    // Find the templates of the user
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:User)

    // RETURN
    RETURN aft`, {
    user_id: res.locals.user.identity.low,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}



router.use(auth.check_auth)
router.route('/')
  .get(get_application_form_template)
  .post(create_application_form_template)
  .put(edit_application_form_template)
  .delete(delete_application_form_template)

router.route('/visibility')
  .get(get_application_form_template)
  .post(create_application_form_template)
  .put(edit_application_form_template)
  .delete(delete_application_form_template)

module.exports = router
