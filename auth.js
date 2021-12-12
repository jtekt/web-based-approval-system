const axios = require('axios')
const Cookies = require('cookies')
const dotenv = require('dotenv')

dotenv.config()

const {
  IDENTIFICATION_URL,
  AUTHENTICATION_API_URL,
} = process.env

const authentication_url = IDENTIFICATION_URL
  || `${process.env.AUTHENTICATION_API_URL}/v2/whoami`

const retrieve_jwt = (req, res) => {

  return req.headers.authorization?.split(" ")[1]
    || req.headers.authorization
    || (new Cookies(req, res)).get('jwt')
    || (new Cookies(req, res)).get('token')
    || req.query.jwt
    || req.query.token

}

exports.middleware = (req, res, next) => {

  let jwt = retrieve_jwt(req,res)

  // if no JWT available, reject requst
  if(!jwt) {
    return res.status(403).send(`Missing JWT`)
  }

  const headers = { Authorization: `Bearer ${jwt}`}

  // Send JWT to authentication manager for decoding
  axios.get(authentication_url, {headers})
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

exports.url = authentication_url

exports.get_current_user_id = (req) => {
  // Currently not used
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}
