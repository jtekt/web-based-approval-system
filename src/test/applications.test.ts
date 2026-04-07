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
  const { data: user } = await axios.get(IDENTIFICATION_URL, { headers });
  return user;
};

describe('/applications', () => {
  let user: any, jwt: string, application_id: string, file_id: string;

  before(async () => {
    jwt = await login();
    user = await whoami(jwt);
  });

  describe('POST /files', () => {
    it('Should allow the upload of a file', async () => {
      const { body, status } = await request(app)
        .post('/files')
        .attach('file_to_upload', 'src/test/sample_pdf.pdf')
        .set('Authorization', `Bearer ${jwt}`);

      file_id = body.file_id;

      expect(status).to.equal(200);
    });
  });

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
    });

    it('Should prevent the creation of an application to unauthenticated users', async () => {
      const form_data = [{ label: 'test', value: file_id }];
      const application = {
        title: 'tdd',
        type: 'tdd',
        form_data,
        recipients_ids: [user._id],
      };

      const { status } = await request(app)
        .post('/applications')
        .send(application);

      expect(status).to.equal(403);
    });
  });

  describe('GET /applications', () => {
    it('Should allow query applications', async () => {
      const { status } = await request(app)
        .get(`/applications`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe('GET /applications/:id', () => {
    it('Should allow the query of an application', async () => {
      const { status } = await request(app)
        .get(`/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe('GET /applications/:id/files/:file_id', () => {
    it('Should allow the query of an application attachment', async () => {
      const { status } = await request(app)
        .get(`/applications/${application_id}/files/${file_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it('Should not allow the query of an application attachment with invalid ID', async () => {
      const { status } = await request(app)
        .get(`/applications/${application_id}/files/banana`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.not.equal(200);
    });
  });

  describe('POST /applications/:id/approve', () => {
    it('Should allow to approve an application', async () => {
      const { status } = await request(app)
        .post(`/applications/${application_id}/approve`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe('DELETE /applications/:id', () => {
    it('Should allow the deletion of an application', async () => {
      const { status } = await request(app)
        .delete(`/applications/${application_id}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });
});
