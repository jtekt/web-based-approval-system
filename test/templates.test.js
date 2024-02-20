const dotenv = require("dotenv")
dotenv.config()

const request = require("supertest")
const { expect } = require("chai")
const { app } = require("../index.js")
const axios = require("axios")

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD }
  const {
    data: { jwt },
  } = await axios.post(LOGIN_URL, body)
  return jwt
}

const whoami = async (jwt) => {
  const headers = { authorization: `bearer ${jwt}` }
  const { data: user } = await axios.get(IDENTIFICATION_URL, { headers })
  return user
}

describe("/templates", () => {
  let user, jwt, template_id
  const label = "tdd"

  before(async () => {
    //console.log = () => {} // silence the console
    jwt = await login()
    user = await whoami(jwt)
  })

  describe("POST /templates", () => {
    it("Should allow the creation of a template", async () => {
      const template = { label }

      const { body, status } = await request(app)
        .post("/templates")
        .send(template)
        .set("Authorization", `Bearer ${jwt}`)

      template_id = body._id

      expect(status).to.equal(200)
    })
  })

  describe("GET /templates", () => {
    it("Should allow the query of templates", async () => {
      const { status, body } = await request(app)
        .get("/templates")
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.length).to.above(0)
    })
  })

  describe("GET /templates/:template_id", () => {
    it("Should allow the query of a single template", async () => {
      const { status, body } = await request(app)
        .get(`/templates/${template_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.label).to.equal(label)
    })
  })

  describe("PATCH /templates/:template_id", () => {
    it("Should allow the update of template", async () => {
      const description = "a test template"
      const { status, body } = await request(app)
        .patch(`/templates/${template_id}`)
        .send({ description })
        .set("Authorization", `Bearer ${jwt}`)

      console.log(body)

      expect(status).to.equal(200)
      expect(body.label).to.equal(label)
      expect(body.description).to.equal(description)
    })
  })

  describe("DELETE /templates/:template_id", () => {
    it("Should allow the deletion of a template", async () => {
      const { status } = await request(app)
        .delete(`/templates/${template_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })
})
