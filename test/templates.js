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

  before(async () => {
    //console.log = () => {} // silence the console
    jwt = await login()
    user = await whoami(jwt)
  })

  describe("POST /templates", () => {
    it("Should allow the creation of a template", async () => {
      const template = {
        label: "tdd",
      }

      const { body, status } = await request(app)
        .post("/templates")
        .send(template)
        .set("Authorization", `Bearer ${jwt}`)

      template_id = body._id

      expect(status).to.equal(200)
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
