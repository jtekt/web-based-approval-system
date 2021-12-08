const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")
const axios = require('axios')

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env

const login = async () => {
  const body = {username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD}
  const {data: {jwt}} = await axios.post(LOGIN_URL,body)
  return jwt
}

const whoami = async (jwt) => {
  const headers = {authorization: `bearer ${jwt}`}
  const {data: user} = await axios.get(IDENTIFICATION_URL,{headers})
  return user
}

describe("/files", () => {

  let user, jwt

  beforeEach( async () => {
    //console.log = () => {} // silence the console
    jwt = await login()
    user = await whoami(jwt)
  })


  describe("POST /files", () => {
    it("Should allow the upload of a file", async () => {

      const {body, status, text} = await request(app)
        .post("/files")
        .attach('image', 'test/sample_pdf.pdf')
        .set('Authorization', `Bearer ${jwt}`)


      expect(status).to.equal(200)
    })

  })

})
