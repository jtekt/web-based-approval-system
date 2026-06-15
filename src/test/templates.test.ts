import "mocha";
import request from 'supertest';
import { expect } from 'chai';
import { app } from '../index';
import axios from 'axios';

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env;

if (!LOGIN_URL || !IDENTIFICATION_URL || !TEST_USER_USERNAME || !TEST_USER_PASSWORD) {
  throw new Error("Missing required environment variables for tests");
}

const login = async (): Promise<string> => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD };
  const {
    data: { jwt },
  } = await axios.post(LOGIN_URL, body);
  return jwt;
};

const whoami = async (jwt: string): Promise<any> => {
  const headers = { authorization: `bearer ${jwt}` };
  const { data: user } = await axios.get(IDENTIFICATION_URL!, { headers });
  return user;
};

describe('/templates', () => {
  let user: any, jwt: string, template_id: string;
  const label = 'tdd';

  before(async () => {
    jwt = await login();
    user = await whoami(jwt);
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  describe('POST /templates', () => {
    it('Should allow the creation of a template', async () => {
      const { body, status } = await request(app)
        .post('/templates')
        .send({ label })
        .set('Authorization', `Bearer ${jwt}`);

      template_id = body._id;

      expect(status).to.equal(200);
      expect(template_id).to.be.a('string');
    });

    it('Should create a template with default values when only label provided', async () => {
      const { body, status } = await request(app)
        .post('/templates')
        .send({ label: 'defaults-test' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.have.property('_id');

      // cleanup
      await request(app)
        .delete(`/templates/${body._id}`)
        .set('Authorization', `Bearer ${jwt}`);
    });

    it('Should allow creation with fields', async () => {
      const { body, status } = await request(app)
        .post('/templates')
        .send({
          label: 'with-fields',
          description: 'has fields',
          fields: [{ label: 'Field 1', type: 'text' }],
        })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);

      // cleanup
      await request(app)
        .delete(`/templates/${body._id}`)
        .set('Authorization', `Bearer ${jwt}`);
    });

    it('Should reject unauthenticated creation', async () => {
      const { status } = await request(app)
        .post('/templates')
        .send({ label: 'should-fail' });

      expect([401, 403]).to.include(status);
    });
  });

  // ── List ───────────────────────────────────────────────────────────────────

  describe('GET /templates', () => {
    it('Should allow listing templates', async () => {
      const { body, status } = await request(app)
        .get('/templates')
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.be.an('array');
      expect(body.length).to.be.above(0);
    });

    it('Should also be accessible via /application_form_templates alias', async () => {
      const { status } = await request(app)
        .get('/application_form_templates')
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should reject unauthenticated listing', async () => {
      const { status } = await request(app).get('/templates');
      expect([401, 403]).to.include(status);
    });
  });

  // ── Read single ────────────────────────────────────────────────────────────

  describe('GET /templates/:template_id', () => {
    it('Should allow reading a single template', async () => {
      const { body, status } = await request(app)
        .get(`/templates/${template_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.label).to.equal(label);
      expect(body).to.have.property('fields').that.is.an('array');
      expect(body).to.have.property('managers').that.is.an('array');
      expect(body).to.have.property('groups').that.is.an('array');
    });

    it('Should return 404 for a non-existent template', async () => {
      const { status } = await request(app)
        .get(`/templates/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(404);
    });
  });

  // ── Update (PATCH) ─────────────────────────────────────────────────────────

  describe('PATCH /templates/:template_id', () => {
    it('Should allow updating the description', async () => {
      const description = 'a test template';

      const { body, status } = await request(app)
        .patch(`/templates/${template_id}`)
        .send({ description })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.label).to.equal(label);
      expect(body.description).to.equal(description);
    });

    it('Should allow updating fields', async () => {
      const { status } = await request(app)
        .patch(`/templates/${template_id}`)
        .send({ fields: [{ label: 'Updated field', type: 'text' }] })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  // ── Update (PUT) ───────────────────────────────────────────────────────────

  describe('PUT /templates/:template_id', () => {
    it('Should also accept PUT for updates', async () => {
      const { status } = await request(app)
        .put(`/templates/${template_id}`)
        .send({ label: 'tdd-updated' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  // ── Add manager ────────────────────────────────────────────────────────────

  describe('POST /templates/:template_id/managers', () => {
    it('Should allow adding a manager to a template', async () => {
      const { status } = await request(app)
        .post(`/templates/${template_id}/managers`)
        .send({ user_id: user._id })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should reject adding a manager without user_id', async () => {
      const { status } = await request(app)
        .post(`/templates/${template_id}/managers`)
        .send({})
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe('DELETE /templates/:template_id', () => {
    it('Should allow deleting a template', async () => {
      const { status } = await request(app)
        .delete(`/templates/${template_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should return 500 when deleting a non-existent template', async () => {
      const { status } = await request(app)
        .delete(`/templates/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(500);
    });

    it('Should reject unauthenticated deletion', async () => {
      const { status } = await request(app).delete(`/templates/some-id`);
      expect([401, 403]).to.include(status);
    });
  });
});
