const axios = require('axios')
const Cookies = require('cookies')
const dotenv = require('dotenv');
dotenv.config();

exports.check_auth = (req, res, next) => {

  let jwt = undefined

  // See if jwt available from authorization header
  if(!jwt){
    if(('authorization' in req.headers)) {
      jwt = req.headers.authorization.split(" ")[1]
    }
  }

  // Try to get JWT from cookies
  if(!jwt) {
    var cookies = new Cookies(req, res)
    jwt = cookies.get('jwt')
  }

  // if no JWT available, reject requst
  if(!jwt) {
    return res.status(403).send('JWT not found in either cookies or authorization header')
  }

  // Send JWT to authentication manager for decoding
  axios.post(`${process.env.AUTHENTICATION_API_URL}/decode_jwt`, { jwt: jwt })
  .then(response => {

    // make the response available to the rest of the route
    res.locals.user = response.data

    // Go to the route
    next()
  })
  .catch(error => {
    res.status(400).send(error)
  })
}
