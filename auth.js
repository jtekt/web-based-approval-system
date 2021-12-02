const axios = require('axios')
const Cookies = require('cookies')
const dotenv = require('dotenv')

dotenv.config()

exports.check_auth = (req, res, next) => {

  let jwt = undefined

  // See if jwt available from authorization header
  if(!jwt && ('authorization' in req.headers)){
    jwt = req.headers.authorization.split(" ")[1]
  }

  // Try to get JWT from cookies
  if(!jwt) {
    const cookies = (new Cookies(req, res)).get('jwt')
  }

  // if no JWT available, reject requst
  if(!jwt) {
    return res.status(403).send(`JWT not found in either cookies or authorization header`)
  }

  const url = `${process.env.AUTHENTICATION_API_URL}/v2/whoami`
  const headers = { Authorization: `Bearer ${jwt}`}

  // Send JWT to authentication manager for decoding
  axios.get(url, {headers})
  .then( ({data}) => {

    // make the response available to the rest of the route
    res.locals.user = data

    // Go to the route
    next()
  })
  .catch(error => {
    if(error.response){
      res.status(error.response.status)
        .send(error.response.data)
    }
    else {
      res.status(500).send(error)
    }

  })
}

exports.get_current_user_id = (req) => {
  // Currently not used
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}
