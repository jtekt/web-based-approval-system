const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")
const axios = require('axios')
const {AUTHENTICATION_API_URL} = process.env

const login = async () => {
  // const url = `${AUTHENTICATION_API_URL}/auth/login`
  // const body = {username: 'admin', password: 'admin'}
  const url = `${AUTHENTICATION_API_URL}/login`
  const body = {email_address: 'test_user@jtekt.co.jp', password: 'poketenashi'}
  const {data: {jwt}} = await axios.post(url,body)
  return jwt
}

const whoami = async (jwt) => {
  // const url = `${AUTHENTICATION_API_URL}/users/self`
  const url = `${AUTHENTICATION_API_URL}/v2/whoami`
  const headers = {authorization: `bearer ${jwt}`}
  const {data: user} = await axios.get(url,{headers})
  return user
}

describe("/applications", () => {

  let user, jwt, application_id

  beforeEach( async () => {
    //console.log = () => {} // silence the console
    jwt = await login()
    user = await whoami(jwt)
  })

  describe("GET /", () => {
    it("Should allow to get the application root route", async () => {
      const {status} = await request(app).get("/")
      expect(status).to.equal(200)
    })
  })

  describe("POST /applications", () => {
    it("Should allow the creation of an application", async () => {

      const application = {
        title: 'tdd',
        type: 'tdd',
        form_data: {test: 'test'},
        recipients_ids: [(user.identity.low || user.identity)] // self as recipient
      }

      const {body, status, text} = await request(app)
        .post("/applications")
        .send(application)
        .set('Authorization', `Bearer ${jwt}`)

      console.log(text)

      application_id = body.identity

      expect(status).to.equal(200)
    })
  })

  describe("GET /v2/applications/submitted/pending", () => {
    it("Should allow query submitted pending applications", async () => {

      const {body,status} = await request(app)
        .get(`/v2/applications/submitted/pending`)
        .set('Authorization', `Bearer ${jwt}`)

      //expect(body.length).to.equal(1)
      expect(status).to.equal(200)
    })
  })

  describe("GET /v2/applications/received/pending", () => {
    it("Should allow query received pending applications", async () => {

      const {body,status} = await request(app)
        .get(`/v2/applications/received/pending`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(body.length).to.equal(1)
      expect(status).to.equal(200)
    })
  })

  describe("GET /v2/applications/:id", () => {
    it("Should allow the query of an application", async () => {

      const {status} = await request(app)
        .get(`/applications/${application_id}`)
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

  describe("GET /v2/applications/submitted/approved", () => {
    it("Should allow query submitted approved applications", async () => {

      const {body,status} = await request(app)
        .get(`/v2/applications/submitted/approved`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(body.length).to.equal(1)
      expect(status).to.equal(200)
    })
  })

  describe("GET /v2/applications/received/approved", () => {
    it("Should allow query received approved applications", async () => {

      const {body,status} = await request(app)
        .get(`/v2/applications/received/approved`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(body.length).to.equal(1)
      expect(status).to.equal(200)
    })
  })

  describe("DELETE /v2/applications/:id", () => {
    it("Should allow the deletion of an application", async () => {

      const {status} = await request(app)
        .delete(`/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

})
