const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")
const axios = require('axios')
const dotenv = require('dotenv')

dotenv.config()

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

describe("/applications", () => {

  let user, jwt, application_id

  before( async () => {
    //console.log = () => {} // silence the console
    jwt = await login()
    user = await whoami(jwt)
  })


  describe("POST /applications", () => {
    it("Should allow the creation of an application", async () => {

      const application = {
        title: 'tdd',
        type: 'tdd',
        form_data: {test: 'test'},
        recipients_ids: [user.properties._id] // self as recipient
      }

      const {body, status, text} = await request(app)
        .post("/applications")
        .send(application)
        .set('Authorization', `Bearer ${jwt}`)

      application_id = body.properties._id

      expect(status).to.equal(200)
    })

    it("Should prevent the creation of an application to unauthenticated users", async () => {

      const application = {
        title: 'tdd',
        type: 'tdd',
        form_data: {test: 'test'},
        recipients_ids: [(user.identity.low || user.identity)] // self as recipient
      }

      const {body, status, text} = await request(app)
        .post("/applications")
        .send(application)


      expect(status).to.equal(403)
    })

  })

  describe("GET /v3/applications", () => {
    it("Should allow query applications", async () => {

      const {body,status} = await request(app)
        .get(`/v3/applications`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })


  describe("GET /v2/applications/:id", () => {
    it("Should allow the query of an application", async () => {

      const {status} = await request(app)
        .get(`/v2/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("POST /applications/:id/approve", () => {
    it("Should allow to approve an application", async () => {

      const {body,status} = await request(app)
        .post(`/applications/${application_id}/approve`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /v2/applications/:id", () => {
    it("Should allow the deletion of an application", async () => {

      const {status} = await request(app)
        .delete(`/v2/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

})
