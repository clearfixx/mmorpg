import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication;
  const createdEmails: string[] = [];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (createdEmails.length > 0) {
      const prisma = app.get(PrismaService);
      await prisma.client.user.deleteMany({
        where: { email: { in: createdEmails.splice(0) } },
      });
    }
    await app.close();
  });

  it('/health (GET)', () => {
    const server = app.getHttpServer() as Server;
    return request(server).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('registers, resolves viewer from the cookie, and revokes the session', async () => {
    const server = app.getHttpServer() as Server;
    const email = `identity-${Date.now()}@example.test`;
    createdEmails.push(email);
    const registration = await request(server)
      .post('/graphql')
      .send({
        query:
          'mutation Register($input: RegisterInput!) { register(input: $input) { authenticated viewer { email role } } }',
        variables: {
          input: { email, password: 'correct horse battery staple' },
        },
      })
      .expect(200);

    const setCookie: unknown = registration.headers['set-cookie'];
    if (!Array.isArray(setCookie) || typeof setCookie[0] !== 'string') {
      throw new Error('Registration did not return a session cookie');
    }
    const cookie = setCookie[0];
    expect(cookie).toContain('veilfall_session=');
    expect(cookie).toContain('HttpOnly');

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ viewer { email role } }' })
      .expect(200)
      .expect({ data: { viewer: { email, role: 'PLAYER' } } });

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: 'mutation { logout }' })
      .expect(200);

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ viewer { email } }' })
      .expect(200)
      .expect({ data: { viewer: null } });
  });
});
