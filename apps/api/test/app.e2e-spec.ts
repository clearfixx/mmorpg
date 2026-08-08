import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@veilfall/database';
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
      await prisma.client.clan.deleteMany({ where: { members: { none: {} } } });
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

    const started = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Start($input: StartEncounterInput!) { startEncounter(input: $input) { id status phase version turn currentIntent { id } hero { health } enemy { health } actions { id } } }',
        variables: { input: { idempotencyKey: `battle-${Date.now()}` } },
      })
      .expect(200);
    expect(started.text).toContain('"status":"ACTIVE"');
    expect(started.text).toContain('"phase":"PLAYER_TURN"');
    expect(started.text).toContain('"version":1');
    expect(started.text).toContain('"id":"STRIKE"');

    const commandKey = `combat-${Date.now()}`;
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Act($input: SubmitCombatCommandInput!) { submitCombatCommand(input: $input) { status phase version turn enemy { health } log { turn kind message amount detail } } }',
        variables: {
          input: {
            actionId: 'STRIKE',
            expectedVersion: 1,
            idempotencyKey: commandKey,
          },
        },
      })
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain('"phase":"ENEMY_RESOLVING"');
        expect(text).toContain('"version":1');
        expect(text).toContain('"turn":1');
        expect(text).toContain('"health":125');
      });

    const blockedCommand = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Act($input: SubmitCombatCommandInput!) { submitCombatCommand(input: $input) { phase version } }',
        variables: {
          input: {
            actionId: 'STRIKE',
            expectedVersion: 1,
            idempotencyKey: `blocked-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(blockedCommand.text).toContain('errors');
    expect(blockedCommand.text).toContain('Enemy response is still resolving');

    const prisma = app.get(PrismaService);
    const combatUser = await prisma.client.user.findUniqueOrThrow({
      where: { email },
      include: { character: true },
    });
    await prisma.client.battle.updateMany({
      where: {
        characterId: combatUser.character?.id,
        status: 'ACTIVE',
      },
      data: { enemyReadyAt: new Date(0) },
    });

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ activeBattle { status phase version turn enemy { health } } }',
      })
      .expect(200)
      .expect({
        data: {
          activeBattle: {
            status: 'ACTIVE',
            phase: 'PLAYER_TURN',
            version: 2,
            turn: 2,
            enemy: { health: 107 },
          },
        },
      });

    const persistedBattle = await prisma.client.battle.findFirstOrThrow({
      where: { characterId: combatUser.character?.id },
      orderBy: { createdAt: 'desc' },
    });
    const battleId = persistedBattle.id;
    const winningState = {
      ...(persistedBattle.state as Record<string, unknown>),
      status: 'WON',
      version: 3,
    };
    await prisma.client.battle.update({
      where: { id: battleId },
      data: {
        state: winningState,
        status: 'WON',
        version: 3,
        pendingState: Prisma.DbNull,
        enemyReadyAt: null,
        activeCharacterId: null,
        completedAt: new Date(),
      },
    });

    const prematureReturn = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: 'mutation { returnToWatchpost }' })
      .expect(200);
    expect(prematureReturn.text).toContain('errors');
    expect(prematureReturn.text).toContain(
      'Claim the battle reward before returning',
    );

    const rewardKey = `reward-${Date.now()}`;
    const claimReward = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Claim($input: ClaimBattleRewardInput!) { claimBattleReward(input: $input) { claimId battleId experience gold item { id definitionId name rarity damage binding setName visualAssetId location } } }',
          variables: {
            input: { battleId, idempotencyKey: rewardKey },
          },
        })
        .expect(200);
    const firstReward = await claimReward();
    const retriedReward = await claimReward();
    expect(firstReward.body).toEqual(retriedReward.body);
    expect(firstReward.text).toContain('veteran-notched-blade-v1');
    expect(firstReward.text).toContain('BOUND_ON_EQUIP');
    expect(firstReward.text).toContain('"location":"CHEST"');
    expect(firstReward.text).toContain('"experience":40');
    expect(firstReward.text).toContain('"gold":18');
    expect(
      await prisma.client.characterResource.findUnique({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'IRON',
          },
        },
      }),
    ).toMatchObject({ balance: 20 });

    expect(await prisma.client.rewardClaim.count({ where: { battleId } })).toBe(
      1,
    );
    expect(
      await prisma.client.itemInstance.count({
        where: { sourceBattleId: battleId },
      }),
    ).toBe(1);
    expect(
      await prisma.client.itemLineageEvent.count({
        where: { item: { sourceBattleId: battleId } },
      }),
    ).toBe(1);
    const rewardedCharacter = await prisma.client.character.findUniqueOrThrow({
      where: { id: combatUser.character?.id },
      include: { worldState: true },
    });
    expect(rewardedCharacter.experience).toBe(40);
    expect(rewardedCharacter.gold).toBe(18);
    expect(rewardedCharacter.worldState?.cinderhavenUnlocked).toBe(true);

    const rewardedItem = await prisma.client.itemInstance.findUniqueOrThrow({
      where: { sourceBattleId: battleId },
    });
    const equipKey = `equip-${Date.now()}`;
    const equip = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Equip($input: EquipItemInput!) { equipItem(input: $input) { characterVersion baseDamage totalDamage chest { id } equipped { slot item { id binding damage visualAssetId } } } }',
          variables: {
            input: {
              itemId: rewardedItem.id,
              slot: 'MAIN_HAND',
              expectedCharacterVersion: rewardedCharacter.version,
              idempotencyKey: equipKey,
            },
          },
        })
        .expect(200);
    const firstEquip = await equip();
    const retriedEquip = await equip();
    expect(firstEquip.body).toEqual(retriedEquip.body);
    expect(firstEquip.text).toContain('"baseDamage":16');
    expect(firstEquip.text).toContain(
      `"totalDamage":${16 + rewardedItem.damage}`,
    );
    expect(firstEquip.text).toContain('"binding":"BOUND"');
    expect(firstEquip.text).toContain('"chest":[]');
    expect(
      await prisma.client.equipmentAssignment.count({
        where: { characterId: rewardedCharacter.id, slot: 'MAIN_HAND' },
      }),
    ).toBe(1);
    expect(
      await prisma.client.itemLineageEvent.count({
        where: { itemId: rewardedItem.id },
      }),
    ).toBe(2);

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ myCharacter { version baseStats { damage } } }' })
      .expect(200)
      .expect({
        data: {
          myCharacter: {
            version: rewardedCharacter.version + 1,
            baseStats: { damage: 16 + rewardedItem.damage },
          },
        },
      });

    const continued = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Continue($input: ContinueAdventureInput!) { continueAdventure(input: $input) { id status encounterTier enemyName enemy { health maxHealth } } }',
        variables: {
          input: {
            battleId,
            idempotencyKey: `continue-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(continued.text).toContain('"encounterTier":2');
    expect(continued.text).toContain('"health":165');
    expect(continued.text).toContain('Загартований Завісою розоритель');

    const secondBattle = await prisma.client.battle.findFirstOrThrow({
      where: { characterId: rewardedCharacter.id, status: 'ACTIVE' },
    });
    const secondState = secondBattle.state as Record<string, unknown>;
    expect(secondState.enemyDamageBonus).toBe(6);
    expect(secondState.weaponDamageBonus).toBe(rewardedItem.damage);
    await prisma.client.battle.update({
      where: { id: secondBattle.id },
      data: {
        status: 'WON',
        version: 2,
        state: { ...secondState, status: 'WON', version: 2 },
        activeCharacterId: null,
        completedAt: new Date(),
      },
    });
    const secondReward = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Claim($input: ClaimBattleRewardInput!) { claimBattleReward(input: $input) { experience gold item { id damage location } } }',
        variables: {
          input: {
            battleId: secondBattle.id,
            idempotencyKey: `second-reward-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(secondReward.text).toContain('"experience":60');
    expect(secondReward.text).toContain('"gold":30');
    expect(secondReward.text).toContain('"location":"BACKPACK"');
    const secondRewardPayload = JSON.parse(secondReward.text) as {
      data: { claimBattleReward: { item: { id: string } } };
    };
    const secondRewardItemId =
      secondRewardPayload.data.claimBattleReward.item.id;
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myCharacter { level experience experienceIntoLevel experienceForNextLevel gold } }',
      })
      .expect(200)
      .expect({
        data: {
          myCharacter: {
            level: 2,
            experience: 100,
            experienceIntoLevel: 0,
            experienceForNextLevel: 300,
            gold: 48,
          },
        },
      });

    await prisma.client.battle.create({
      data: {
        characterId: rewardedCharacter.id,
        encounterId: 'legacy-unclaimed-victory',
        status: 'WON',
        version: 3,
        seed: 42,
        state: winningState,
        completedAt: new Date('2020-01-01T00:00:00.000Z'),
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: 'mutation { returnToWatchpost }' })
      .expect(200)
      .expect({ data: { returnToWatchpost: true } });
    expect(
      await prisma.client.itemInstance.findUniqueOrThrow({
        where: { id: secondRewardItemId },
        select: { location: true },
      }),
    ).toEqual({ location: 'CHEST' });
    expect(
      await prisma.client.itemLineageEvent.count({
        where: {
          itemId: secondRewardItemId,
          type: 'STORED_IN_CHEST',
        },
      }),
    ).toBe(1);
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ latestBattle { id } }' })
      .expect(200)
      .expect({ data: { latestBattle: null } });

    const watchpostState = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ currentLocation { currentLocation version routes { destination locked } } }',
      })
      .expect(200);
    const watchpostPayload = JSON.parse(watchpostState.text) as {
      data: {
        currentLocation: {
          version: number;
          routes: Array<{ destination: string; locked: boolean }>;
        };
      };
    };
    expect(watchpostPayload.data.currentLocation.routes).toContainEqual({
      destination: 'CINDERHAVEN_GATE',
      locked: false,
    });
    const gateVersion = watchpostPayload.data.currentLocation.version;
    const gateTravel = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Travel($input: TravelInput!) { travel(input: $input) { currentLocation version } }',
        variables: {
          input: {
            destination: 'CINDERHAVEN_GATE',
            expectedVersion: gateVersion,
            idempotencyKey: `gate-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const gatePayload = JSON.parse(gateTravel.text) as {
      data: { travel: { currentLocation: string; version: number } };
    };
    expect(gatePayload.data.travel.currentLocation).toBe('CINDERHAVEN_GATE');
    expect(gatePayload.data.travel.version).toBe(gateVersion + 1);

    const talentState = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myTalents { characterVersion availablePoints resources { type amount } talents { type rank unlocked costResource costAmount affordable } } }',
      })
      .expect(200);
    const talentPayload = JSON.parse(talentState.text) as {
      data: {
        myTalents: {
          characterVersion: number;
          availablePoints: number;
          resources: Array<{ type: string; amount: number }>;
          talents: Array<{
            type: string;
            costResource: string;
            costAmount: number;
            affordable: boolean;
          }>;
        };
      };
    };
    expect(talentPayload.data.myTalents.availablePoints).toBe(1);
    expect(talentPayload.data.myTalents.resources).toContainEqual({
      type: 'IRON',
      amount: 50,
    });
    expect(talentPayload.data.myTalents.talents).toContainEqual(
      expect.objectContaining({
        type: 'POWER',
        costResource: 'IRON',
        costAmount: 12,
        affordable: true,
      }),
    );
    const talentKey = `talent-${Date.now()}`;
    const upgradeTalent = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Upgrade($input: UpgradeTalentInput!) { upgradeTalent(input: $input) { characterVersion availablePoints resources { type amount } talents { type rank } } }',
          variables: {
            input: {
              type: 'POWER',
              expectedCharacterVersion:
                talentPayload.data.myTalents.characterVersion,
              idempotencyKey: talentKey,
            },
          },
        })
        .expect(200);
    const firstTalent = await upgradeTalent();
    const retriedTalent = await upgradeTalent();
    expect(firstTalent.body).toEqual(retriedTalent.body);
    expect(firstTalent.text).toContain('"availablePoints":0');
    expect(firstTalent.text).toContain('"type":"POWER","rank":1');
    expect(firstTalent.text).toContain('"type":"IRON","amount":38');
    expect(
      await prisma.client.resourceLedgerEntry.count({
        where: { characterId: rewardedCharacter.id },
      }),
    ).toBe(3);

    const talentResult = JSON.parse(firstTalent.text) as {
      data: { upgradeTalent: { characterVersion: number } };
    };
    const clanKey = `clan-${Date.now()}`;
    const clanName = `Варта ${Date.now()}`;
    const createClan = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation CreateClan($input: CreateClanInput!) { createClan(input: $input) { id name inviteCode level experience experienceIntoLevel experienceForNextLevel version characterVersion viewerRole treasury { type amount } members { name role level contribution } } }',
          variables: {
            input: {
              name: clanName,
              expectedCharacterVersion:
                talentResult.data.upgradeTalent.characterVersion,
              idempotencyKey: clanKey,
            },
          },
        })
        .expect(200);
    const firstClan = await createClan();
    const retriedClan = await createClan();
    expect(firstClan.body).toEqual(retriedClan.body);
    expect(firstClan.text).toContain('"viewerRole":"LEADER"');
    expect(firstClan.text).toContain('"level":1');
    const clanResult = JSON.parse(firstClan.text) as {
      data: {
        createClan: {
          inviteCode: string;
          characterVersion: number;
          version: number;
        };
      };
    };
    expect(clanResult.data.createClan.inviteCode).toMatch(/^[A-F0-9]{8}$/);
    expect(
      await prisma.client.clanMembership.count({
        where: { characterId: rewardedCharacter.id },
      }),
    ).toBe(1);

    const contributionKey = `contribution-${Date.now()}`;
    const contribute = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Contribute($input: ContributeClanResourceInput!) { contributeClanResource(input: $input) { level experience experienceIntoLevel experienceForNextLevel version characterVersion treasury { type amount } members { name contribution } } }',
          variables: {
            input: {
              resourceType: 'IRON',
              amount: 20,
              expectedCharacterVersion:
                clanResult.data.createClan.characterVersion,
              expectedClanVersion: clanResult.data.createClan.version,
              idempotencyKey: contributionKey,
            },
          },
        })
        .expect(200);
    const firstContribution = await contribute();
    const retriedContribution = await contribute();
    expect(firstContribution.body).toEqual(retriedContribution.body);
    expect(firstContribution.text).toContain('"experience":20');
    expect(firstContribution.text).toContain('"type":"IRON","amount":20');
    expect(firstContribution.text).toContain('"contribution":20');
    expect(
      await prisma.client.characterResource.findUniqueOrThrow({
        where: {
          characterId_type: {
            characterId: rewardedCharacter.id,
            type: 'IRON',
          },
        },
        select: { balance: true },
      }),
    ).toEqual({ balance: 18 });

    const recruitEmail = `recruit-${Date.now()}@example.test`;
    createdEmails.push(recruitEmail);
    const recruitRegistration = await request(server)
      .post('/graphql')
      .send({
        query:
          'mutation Register($input: RegisterInput!) { register(input: $input) { authenticated } }',
        variables: {
          input: {
            email: recruitEmail,
            password: 'another correct horse battery staple',
          },
        },
      })
      .expect(200);
    const recruitCookies: unknown = recruitRegistration.headers['set-cookie'];
    if (!Array.isArray(recruitCookies) || typeof recruitCookies[0] !== 'string')
      throw new Error('Recruit registration did not return a session cookie');
    const recruitCookie = recruitCookies[0];
    const recruitName = `Recruit ${Date.now()}`;
    await request(server)
      .post('/graphql')
      .set('Cookie', recruitCookie)
      .send({
        query:
          'mutation CreateCharacter($input: CreateCharacterInput!) { createCharacter(input: $input) { id } }',
        variables: {
          input: {
            name: recruitName,
            archetype: 'VANGUARD',
            origin: 'ROAD_SURVIVOR',
            avatarMode: 'STATIC',
            staticAvatarId: 'standard-02',
          },
        },
      })
      .expect(200);
    const recruit = await prisma.client.user.findUniqueOrThrow({
      where: { email: recruitEmail },
      include: { character: { include: { worldState: true } } },
    });
    await prisma.client.characterWorldState.update({
      where: { characterId: recruit.character!.id },
      data: { currentLocation: 'CINDERHAVEN_GATE' },
    });
    const joinedClan = await request(server)
      .post('/graphql')
      .set('Cookie', recruitCookie)
      .send({
        query:
          'mutation JoinClan($input: JoinClanInput!) { joinClan(input: $input) { name viewerRole members { name role } } }',
        variables: {
          input: {
            inviteCode: clanResult.data.createClan.inviteCode,
            expectedCharacterVersion: recruit.character!.version,
            idempotencyKey: `join-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(joinedClan.text).toContain('"viewerRole":"MEMBER"');
    expect(joinedClan.text).toContain(`"name":"${clanName}"`);
    expect(
      await prisma.client.clanMembership.count({
        where: {
          clan: { inviteCode: clanResult.data.createClan.inviteCode },
        },
      }),
    ).toBe(2);

    const returnToWatchpost = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Travel($input: TravelInput!) { travel(input: $input) { currentLocation version } }',
        variables: {
          input: {
            destination: 'BROKEN_WATCHPOST',
            expectedVersion: gatePayload.data.travel.version,
            idempotencyKey: `return-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(returnToWatchpost.text).toContain(
      '"currentLocation":"BROKEN_WATCHPOST"',
    );

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
