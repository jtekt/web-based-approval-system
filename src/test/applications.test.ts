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

describe('/applications', () => {
  let user: any, jwt: string;
  let application_id: string;
  let reject_application_id: string;
  let privacy_application_id: string;
  let file_id: string;

  before(async () => {
    jwt = await login();
    user = await whoami(jwt);
  });

  // ── File upload ────────────────────────────────────────────────────────────

  describe('POST /files', () => {
    it('Should allow the upload of a file', async () => {
      const { body, status } = await request(app)
        .post('/files')
        .attach('file_to_upload', 'src/test/sample_pdf.pdf')
        .set('Authorization', `Bearer ${jwt}`);

      file_id = body.file_id;

      expect(status).to.equal(200);
      expect(file_id).to.be.a('string');
    });

    it('Should reject upload without a file', async () => {
      const { status } = await request(app)
        .post('/files')
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });

    it('Should reject unauthenticated file uploads', async () => {
      const { status } = await request(app)
        .post('/files')
        .attach('file_to_upload', 'src/test/sample_pdf.pdf');

      expect([401, 403]).to.include(status);
    });
  });

  // ── Create application ─────────────────────────────────────────────────────

  describe('POST /applications', () => {
    it('Should allow the creation of an application', async () => {
      const form_data = [{ label: 'test', value: file_id }];
      const application = {
        title: 'tdd',
        type: 'tdd',
        form_data,
        recipients_ids: [user._id],
      };

      const { body, status } = await request(app)
        .post('/applications')
        .send(application)
        .set('Authorization', `Bearer ${jwt}`);

      application_id = body._id;

      expect(status).to.equal(200);
      expect(application_id).to.be.a('string');
    });

    it('Should create a second application for rejection testing', async () => {
      const application = {
        title: 'tdd-reject',
        type: 'tdd',
        form_data: [],
        recipients_ids: [user._id],
      };

      const { body, status } = await request(app)
        .post('/applications')
        .send(application)
        .set('Authorization', `Bearer ${jwt}`);

      reject_application_id = body._id;

      expect(status).to.equal(200);
    });

    it('Should create a third application for privacy testing', async () => {
      const application = {
        title: 'tdd-privacy',
        type: 'tdd',
        form_data: [],
        recipients_ids: [user._id],
      };

      const { body, status } = await request(app)
        .post('/applications')
        .send(application)
        .set('Authorization', `Bearer ${jwt}`);

      privacy_application_id = body._id;

      expect(status).to.equal(200);
    });

    it('Should prevent creation without required fields', async () => {
      const { status } = await request(app)
        .post('/applications')
        .send({ title: 'missing type and recipients' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });

    it('Should prevent creation without recipients', async () => {
      const { status } = await request(app)
        .post('/applications')
        .send({ title: 'tdd', type: 'tdd', form_data: [], recipients_ids: [] })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });

    it('Should prevent creation for unauthenticated users', async () => {
      const { status } = await request(app)
        .post('/applications')
        .send({ title: 'tdd', type: 'tdd', form_data: [], recipients_ids: [user._id] });

      expect([401, 403]).to.include(status);
    });
  });

  // ── List applications ──────────────────────────────────────────────────────

  describe('GET /applications', () => {
    it('Should allow listing applications', async () => {
      const { body, status } = await request(app)
        .get(`/applications`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.have.property('applications').that.is.an('array');
      expect(body).to.have.property('count').that.is.a('number');
    });

    it('Should support pagination via start_index and batch_size', async () => {
      const { body, status } = await request(app)
        .get(`/applications?start_index=0&batch_size=2`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.applications.length).to.be.at.most(2);
    });

    it('Should filter by relationship=SUBMITTED_BY', async () => {
      const { body, status } = await request(app)
        .get(`/applications?relationship=SUBMITTED_BY`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.have.property('applications');
    });

    it('Should filter by relationship=SUBMITTED_TO', async () => {
      const { body, status } = await request(app)
        .get(`/applications?relationship=SUBMITTED_TO`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.have.property('applications');
    });

    it('Should filter submitted applications by state=pending', async () => {
      const { status } = await request(app)
        .get(`/applications?relationship=SUBMITTED_BY&state=pending`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should filter received applications by state=pending', async () => {
      const { status } = await request(app)
        .get(`/applications?relationship=SUBMITTED_TO&state=pending`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should filter by type', async () => {
      const { body, status } = await request(app)
        .get(`/applications?type=tdd`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.applications.every((a: any) => a.type === 'tdd')).to.be.true;
    });

    it('Should reject unauthenticated listing', async () => {
      const { status } = await request(app).get(`/applications`);
      expect([401, 403]).to.include(status);
    });
  });

  // ── GET application types ──────────────────────────────────────────────────

  describe('GET /applications/types', () => {
    it('Should return distinct application types', async () => {
      const { body, status } = await request(app)
        .get(`/applications/types`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body).to.be.an('array');
    });
  });

  // ── Read single application ────────────────────────────────────────────────

  describe('GET /applications/:id', () => {
    it('Should allow reading an application', async () => {
      const { body, status } = await request(app)
        .get(`/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body._id).to.equal(application_id);
    });

    it('Should return 404 for a non-existent application', async () => {
      const { status } = await request(app)
        .get(`/applications/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(404);
    });
  });

  // ── File download ──────────────────────────────────────────────────────────

  describe('GET /applications/:id/files/:file_id', () => {
    it('Should allow fetching an application attachment', async () => {
      const { status } = await request(app)
        .get(`/applications/${application_id}/files/${file_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should reject fetching a file not linked to the application', async () => {
      const { status } = await request(app)
        .get(`/applications/${application_id}/files/nonexistent-file-id`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.not.equal(200);
    });
  });

  // ── Privacy ────────────────────────────────────────────────────────────────

  describe('PUT /applications/:id/privacy', () => {
    it('Should allow setting an application to private', async () => {
      const { body, status } = await request(app)
        .put(`/applications/${privacy_application_id}/privacy`)
        .send({ private: true })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.private).to.be.true;
    });

    it('Should allow setting an application back to public', async () => {
      const { body, status } = await request(app)
        .put(`/applications/${privacy_application_id}/privacy`)
        .send({ private: false })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.private).to.be.false;
    });

    it('Should reject missing private field', async () => {
      const { status } = await request(app)
        .put(`/applications/${privacy_application_id}/privacy`)
        .send({})
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });
  });

  // ── Approve ────────────────────────────────────────────────────────────────

  describe('POST /applications/:id/approve', () => {
    it('Should allow approving an application', async () => {
      const { status } = await request(app)
        .post(`/applications/${application_id}/approve`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should allow approving with a comment', async () => {
      const { status } = await request(app)
        .post(`/applications/${application_id}/approve`)
        .send({ comment: 'looks good' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  // ── Comment ────────────────────────────────────────────────────────────────

  describe('PUT /applications/:id/comment', () => {
    it('Should allow updating a recipient comment', async () => {
      const { body, status } = await request(app)
        .put(`/applications/${application_id}/comment`)
        .send({ comment: 'my comment' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
      expect(body.comment).to.equal('my comment');
    });

    it('Should reject empty comment', async () => {
      const { status } = await request(app)
        .put(`/applications/${application_id}/comment`)
        .send({ comment: '' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });
  });

  // ── Hankos ─────────────────────────────────────────────────────────────────

  describe('PUT /applications/:id/hankos', () => {
    it('Should allow updating attachment hankos', async () => {
      const { status } = await request(app)
        .put(`/applications/${application_id}/hankos`)
        .send({ attachment_hankos: [{ page: 1, x: 100, y: 200 }] })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should reject missing attachment_hankos field', async () => {
      const { status } = await request(app)
        .put(`/applications/${application_id}/hankos`)
        .send({})
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(400);
    });
  });

  // ── Notifications ──────────────────────────────────────────────────────────

  describe('POST /applications/:id/recipients/:recipient_id/notifications', () => {
    it('Should allow marking a recipient as notified', async () => {
      const { status } = await request(app)
        .post(`/applications/${application_id}/recipients/${user._id}/notifications`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  // ── Reject ─────────────────────────────────────────────────────────────────

  describe('POST /applications/:id/reject', () => {
    it('Should allow rejecting an application', async () => {
      const { status } = await request(app)
        .post(`/applications/${reject_application_id}/reject`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should allow rejecting with a comment', async () => {
      // create a fresh one to reject
      const { body: created } = await request(app)
        .post('/applications')
        .send({ title: 'tdd-reject2', type: 'tdd', form_data: [], recipients_ids: [user._id] })
        .set('Authorization', `Bearer ${jwt}`);

      const { status } = await request(app)
        .post(`/applications/${created._id}/reject`)
        .send({ comment: 'not approved' })
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);

      // cleanup
      await request(app)
        .delete(`/applications/${created._id}`)
        .set('Authorization', `Bearer ${jwt}`);
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe('DELETE /applications/:id', () => {
    it('Should allow deleting an application', async () => {
      const { status } = await request(app)
        .delete(`/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should allow deleting the reject-test application', async () => {
      const { status } = await request(app)
        .delete(`/applications/${reject_application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should allow deleting the privacy-test application', async () => {
      const { status } = await request(app)
        .delete(`/applications/${privacy_application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should return 404 when deleting a non-existent application', async () => {
      const { status } = await request(app)
        .delete(`/applications/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(404);
    });
  });

  // ── v1/v2 alias backward compatibility ────────────────────────────────────

  describe('Backward-compatible route aliases', () => {
    it('/v1/applications should respond the same as /applications', async () => {
      const { status } = await request(app)
        .get('/v1/applications')
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('/v2/applications should respond the same as /applications', async () => {
      const { status } = await request(app)
        .get('/v2/applications')
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });
});
