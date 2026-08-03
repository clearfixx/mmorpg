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

    const characterName = `Hero ${Date.now()}`;
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation CreateCharacter($input: CreateCharacterInput!) { createCharacter(input: $input) { name archetype origin avatarMode level baseStats { health damage armor speed reaction } } }',
        variables: {
          input: {
            name: characterName,
            archetype: 'VANGUARD',
            origin: 'FORMER_SENTINEL',
            avatarMode: 'STATIC',
            staticAvatarId: 'standard-01',
          },
        },
      })
      .expect(200)
      .expect({
        data: {
          createCharacter: {
            name: characterName,
            archetype: 'VANGUARD',
            origin: 'FORMER_SENTINEL',
            avatarMode: 'STATIC',
            level: 1,
            baseStats: {
              health: 140,
              damage: 16,
              armor: 14,
              speed: 8,
              reaction: 8,
            },
          },
        },
      });

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ myCharacter { name level } }' })
      .expect(200)
      .expect({ data: { myCharacter: { name: characterName, level: 1 } } });

    const world = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ currentLocation { currentLocation preparationChoice version routes { destination locked } } }',
      })
      .expect(200);
    expect(world.text).toContain('"currentLocation":"BROKEN_WATCHPOST"');
    expect(world.text).toContain('"preparationChoice":null');
    expect(world.text).toContain('"version":1');

    const preparationKey = `prepare-${Date.now()}`;
    const prepareInput = {
      choice: 'INSPECT_TRACKS',
      expectedVersion: 1,
      idempotencyKey: preparationKey,
    };
    const sendPreparation = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Prepare($input: PrepareLocationInput!) { performLocationAction(input: $input) { currentLocation preparationChoice version } }',
          variables: { input: prepareInput },
        })
        .expect(200);
    const [prepared, concurrentRetry] = await Promise.all([
      sendPreparation(),
      sendPreparation(),
    ]);
    const expectedPreparation = {
      data: {
        performLocationAction: {
          currentLocation: 'BROKEN_WATCHPOST',
          preparationChoice: 'INSPECT_TRACKS',
          version: 2,
        },
      },
    };
    expect(prepared.body).toEqual(expectedPreparation);
    expect(concurrentRetry.body).toEqual(expectedPreparation);

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Prepare($input: PrepareLocationInput!) { performLocationAction(input: $input) { version preparationChoice } }',
        variables: { input: prepareInput },
      })
      .expect(200)
      .expect({
        data: {
          performLocationAction: {
            version: 2,
            preparationChoice: 'INSPECT_TRACKS',
          },
        },
      });

    const travelKey = `travel-${Date.now()}`;
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Travel($input: TravelInput!) { travel(input: $input) { currentLocation preparationChoice version } }',
        variables: {
          input: {
            destination: 'HOLLOW_ROAD',
            expectedVersion: 2,
            idempotencyKey: travelKey,
          },
        },
      })
      .expect(200)
      .expect({
        data: {
          travel: {
            currentLocation: 'HOLLOW_ROAD',
            preparationChoice: 'INSPECT_TRACKS',
            version: 3,
          },
        },
      });

    const duplicate = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation CreateCharacter($input: CreateCharacterInput!) { createCharacter(input: $input) { id } }',
        variables: {
          input: {
            name: `${characterName} Two`,
            archetype: 'RANGER',
            avatarMode: 'DYNAMIC',
          },
        },
      })
      .expect(200);
    expect(duplicate.text).toContain('errors');

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

  it('rejects character access without a valid session', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .post('/graphql')
      .send({ query: '{ myCharacter { id } }' })
      .expect(200);
    expect(response.text).toContain('errors');

    const worldResponse = await request(server)
      .post('/graphql')
      .send({ query: '{ currentLocation { currentLocation } }' })
      .expect(200);
    expect(worldResponse.text).toContain('errors');
  });
});
