import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@veilfall/database';
import { itemDamageRange } from '@veilfall/game-engine';
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
      const emails = createdEmails.splice(0);
      await prisma.client.adminAuditLog.deleteMany({
        where: { actor: { email: { in: emails } } },
      });
      await prisma.client.user.deleteMany({
        where: { email: { in: emails } },
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
            'mutation Claim($input: ClaimBattleRewardInput!) { claimBattleReward(input: $input) { claimId battleId experience gold resources { type amount } item { id definitionId name itemLevel rarity rollQuality damage damageMin damageMax binding setName visualAssetId location } } }',
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
    const claimedMaterials = await prisma.client.rewardClaimResource.findMany({
      where: { rewardClaim: { battleId } },
    });
    expect(claimedMaterials.length).toBeLessThanOrEqual(4);
    expect(claimedMaterials.every((material) => material.amount === 1)).toBe(
      true,
    );

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
    expect(rewardedCharacter.worldState?.cinderhavenUnlocked).toBe(false);

    const rewardedItem = await prisma.client.itemInstance.findUniqueOrThrow({
      where: { sourceBattleId: battleId },
    });
    const rewardedRange = itemDamageRange(
      rewardedItem.itemLevel,
      rewardedItem.rarity,
    );
    expect(rewardedItem.itemLevel).toBe(1);
    expect(rewardedItem.rollQuality).toBeGreaterThanOrEqual(0);
    expect(rewardedItem.rollQuality).toBeLessThanOrEqual(9_999);
    expect(rewardedItem.damage).toBeGreaterThanOrEqual(rewardedRange.min);
    expect(rewardedItem.damage).toBeLessThanOrEqual(rewardedRange.max);
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
        state: {
          ...secondState,
          status: 'WON',
          version: 2,
          personalBest: false,
        },
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

    await prisma.client.character.update({
      where: { id: rewardedCharacter.id },
      data: { gold: { increment: 100 } },
    });
    await prisma.client.characterWorldState.update({
      where: { characterId: rewardedCharacter.id },
      data: { highestClearedTier: 2 },
    });
    await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ expeditionProgress { highestClearedTier checkpointTier saveableTier saveCost canAffordSave } }',
      })
      .expect(200)
      .expect({
        data: {
          expeditionProgress: {
            highestClearedTier: 2,
            checkpointTier: 1,
            saveableTier: 2,
            saveCost: 100,
            canAffordSave: true,
          },
        },
      });
    const replayedRoute = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Hire($input: HireExpeditionGuideInput!) { hireExpeditionGuide(input: $input) { checkpointTier } }',
        variables: {
          input: {
            checkpointTier: 2,
            idempotencyKey: `replayed-guide-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(replayedRoute.text).toContain('errors');
    expect(replayedRoute.text).toContain(
      'A new personal-best victory is required to secure the route',
    );
    const futureRoute = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Hire($input: HireExpeditionGuideInput!) { hireExpeditionGuide(input: $input) { checkpointTier } }',
        variables: {
          input: {
            checkpointTier: 3,
            idempotencyKey: `future-guide-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(futureRoute.text).toContain('errors');
    expect(futureRoute.text).toContain(
      'Only the highest cleared tier can be secured',
    );
    await prisma.client.battle.update({
      where: { id: secondBattle.id },
      data: {
        state: {
          ...secondState,
          status: 'WON',
          version: 2,
          personalBest: true,
        },
      },
    });
    const securedRoute = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Hire($input: HireExpeditionGuideInput!) { hireExpeditionGuide(input: $input) { checkpointTier saveableTier gold } }',
        variables: {
          input: {
            checkpointTier: 2,
            idempotencyKey: `guide-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(securedRoute.body).toEqual({
      data: {
        hireExpeditionGuide: {
          checkpointTier: 2,
          saveableTier: null,
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

    await prisma.client.characterWorldState.update({
      where: { characterId: combatUser.character!.id },
      data: { highestClearedTier: 50, cinderhavenUnlocked: true },
    });

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

    await prisma.client.characterResource.upsert({
      where: {
        characterId_type: {
          characterId: combatUser.character!.id,
          type: 'IRON',
        },
      },
      create: {
        characterId: combatUser.character!.id,
        type: 'IRON',
        balance: 50,
      },
      update: { balance: 50 },
    });

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
    const resourceCatalog = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myResources { type amount name origin rarity tradeable clanContributable } }',
      })
      .expect(200);
    const resourceCatalogPayload = JSON.parse(resourceCatalog.text) as {
      data: { myResources: Array<Record<string, unknown>> };
    };
    expect(resourceCatalogPayload.data.myResources).toContainEqual({
      type: 'IRON',
      amount: 50,
      name: 'Залізо',
      origin: 'DROPPED',
      rarity: 'COMMON',
      tradeable: true,
      clanContributable: true,
    });
    expect(resourceCatalogPayload.data.myResources).toContainEqual(
      expect.objectContaining({
        type: 'CURSED_HEART',
        amount: 0,
        origin: 'BOSS_EXCLUSIVE',
        rarity: 'MYTHIC',
        clanContributable: false,
      }),
    );
    for (const [type, balance] of [
      ['COAL', 10],
      ['COPPER', 20],
      ['BRONZE', 10],
      ['HERBS', 10],
    ] as const) {
      await prisma.client.characterResource.upsert({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type,
          },
        },
        create: { characterId: combatUser.character!.id, type, balance },
        update: { balance },
      });
    }
    const craftState = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myCrafting { recipes { id station affordable stationAvailable ingredients { resourceType amount available } outputType outputAmount durationSeconds } jobs { id } } }',
      })
      .expect(200);
    expect(craftState.text).toContain('"id":"veil-steel-v1"');
    expect(craftState.text).toContain('"station":"FORGE"');
    expect(craftState.text).toContain('"affordable":true');
    expect(craftState.text).not.toContain('tempered-veil-steel-v1');

    const unknownRecipe = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Start($input: StartCraftInput!) { startCraft(input: $input) { jobs { id } } }',
        variables: {
          input: {
            recipeId: 'tempered-veil-steel-v1',
            quantity: 1,
            idempotencyKey: `unknown-recipe-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const unknownRecipePayload = JSON.parse(unknownRecipe.text) as {
      errors?: unknown[];
    };
    expect(unknownRecipePayload.errors).toBeDefined();

    const forgeKey = `craft-forge-${Date.now()}`;
    const startForge = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Start($input: StartCraftInput!) { startCraft(input: $input) { jobs { id recipeId station status outputType outputAmount ready } } }',
          variables: {
            input: {
              recipeId: 'veil-steel-v1',
              quantity: 1,
              idempotencyKey: forgeKey,
            },
          },
        })
        .expect(200);
    const firstForge = await startForge();
    const retriedForge = await startForge();
    expect(firstForge.body).toEqual(retriedForge.body);
    expect(firstForge.text).toContain('"station":"FORGE"');
    expect(firstForge.text).toContain('"outputType":"VEIL_STEEL"');

    const startAlchemy = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Start($input: StartCraftInput!) { startCraft(input: $input) { jobs { id recipeId station status outputType outputAmount } } }',
        variables: {
          input: {
            recipeId: 'stabilized-catalyst-v1',
            quantity: 1,
            idempotencyKey: `craft-alchemy-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(startAlchemy.text).toContain('"station":"ALCHEMY_TABLE"');
    expect(
      await prisma.client.craftJob.count({
        where: {
          characterId: combatUser.character!.id,
          status: 'ACTIVE',
        },
      }),
    ).toBe(2);
    await prisma.client.craftJob.updateMany({
      where: { characterId: combatUser.character!.id, status: 'ACTIVE' },
      data: { completesAt: new Date(Date.now() - 1_000) },
    });
    const forgeJob = await prisma.client.craftJob.findFirstOrThrow({
      where: {
        characterId: combatUser.character!.id,
        recipeId: 'veil-steel-v1',
      },
    });
    const claimKey = `claim-craft-${Date.now()}`;
    const claimForge = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Claim($input: ClaimCraftInput!) { claimCraft(input: $input) { jobs { id status ready } } }',
          variables: {
            input: {
              craftJobId: forgeJob.id,
              idempotencyKey: claimKey,
            },
          },
        })
        .expect(200);
    const firstClaim = await claimForge();
    const retriedClaim = await claimForge();
    expect(firstClaim.body).toEqual(retriedClaim.body);
    expect(
      await prisma.client.characterResource.findUnique({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'VEIL_STEEL',
          },
        },
      }),
    ).toMatchObject({ balance: 1 });
    expect(
      await prisma.client.resourceLedgerEntry.count({
        where: {
          characterId: combatUser.character!.id,
          reason: { in: ['CRAFT_START', 'CRAFT_OUTPUT'] },
        },
      }),
    ).toBe(7);

    const alchemyJob = await prisma.client.craftJob.findFirstOrThrow({
      where: {
        characterId: combatUser.character!.id,
        recipeId: 'stabilized-catalyst-v1',
      },
    });
    const claimAlchemy = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Claim($input: ClaimCraftInput!) { claimCraft(input: $input) { recipes { id discovered } } }',
        variables: {
          input: {
            craftJobId: alchemyJob.id,
            idempotencyKey: `claim-alchemy-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const claimAlchemyPayload = JSON.parse(claimAlchemy.text) as {
      data: {
        claimCraft: { recipes: Array<{ id: string; discovered: boolean }> };
      };
    };
    expect(claimAlchemyPayload.data.claimCraft.recipes).toContainEqual({
      id: 'tempered-veil-steel-v1',
      discovered: true,
    });
    expect(
      await prisma.client.characterRecipeKnowledge.findUnique({
        where: {
          characterId_recipeId: {
            characterId: combatUser.character!.id,
            recipeId: 'tempered-veil-steel-v1',
          },
        },
      }),
    ).toMatchObject({ source: 'CATALYST_MASTERY' });
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
    expect(firstTalent.text).toContain('"type":"IRON","amount":28');
    expect(
      await prisma.client.resourceLedgerEntry.count({
        where: {
          characterId: rewardedCharacter.id,
          reason: 'TALENT_UPGRADE',
        },
      }),
    ).toBe(1);

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
          id: string;
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
    ).toEqual({ balance: 8 });

    const contributionResult = JSON.parse(firstContribution.text) as {
      data: { contributeClanResource: { version: number } };
    };
    const developmentKey = `development-${Date.now()}`;
    const developMilitary = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Develop($input: UpgradeClanDevelopmentInput!) { upgradeClanDevelopment(input: $input) { version treasury { type amount } developments { branch rank costResource costAmount } } }',
          variables: {
            input: {
              branch: 'MILITARY',
              expectedClanVersion:
                contributionResult.data.contributeClanResource.version,
              idempotencyKey: developmentKey,
            },
          },
        })
        .expect(200);
    const firstDevelopment = await developMilitary();
    const retriedDevelopment = await developMilitary();
    expect(firstDevelopment.body).toEqual(retriedDevelopment.body);
    expect(firstDevelopment.text).toContain('"branch":"MILITARY","rank":1');
    expect(firstDevelopment.text).toContain('"type":"IRON","amount":0');
    expect(
      await prisma.client.clanDevelopment.count({
        where: { branch: 'MILITARY', rank: 1 },
      }),
    ).toBe(1);

    const developmentResult = JSON.parse(firstDevelopment.text) as {
      data: { upgradeClanDevelopment: { version: number } };
    };
    const summonedBoss = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Summon($input: SummonClanBossInput!) { summonClanBoss(input: $input) { id status maxHealth currentHealth version } }',
        variables: {
          input: {
            expectedClanVersion:
              developmentResult.data.upgradeClanDevelopment.version,
            idempotencyKey: `summon-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const bossPayload = JSON.parse(summonedBoss.text) as {
      data: {
        summonClanBoss: { id: string; version: number; maxHealth: number };
      };
    };
    expect(bossPayload.data.summonClanBoss.maxHealth).toBe(500);
    const attackKey = `boss-attack-${Date.now()}`;
    const attackBoss = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Attack($input: AttackClanBossInput!) { attackClanBoss(input: $input) { currentHealth version participants { name damage actions } } }',
          variables: {
            input: {
              encounterId: bossPayload.data.summonClanBoss.id,
              expectedVersion: bossPayload.data.summonClanBoss.version,
              idempotencyKey: attackKey,
            },
          },
        })
        .expect(200);
    const firstBossAttack = await attackBoss();
    const retriedBossAttack = await attackBoss();
    expect(firstBossAttack.body).toEqual(retriedBossAttack.body);
    expect(firstBossAttack.text).toContain('"actions":1');
    expect(
      await prisma.client.clanBossParticipant.count({
        where: { encounterId: bossPayload.data.summonClanBoss.id },
      }),
    ).toBe(1);
    const firstAttackPayload = JSON.parse(firstBossAttack.text) as {
      data: { attackClanBoss: { version: number } };
    };
    await prisma.client.clanBossEncounter.update({
      where: { id: bossPayload.data.summonClanBoss.id },
      data: { currentHealth: 1 },
    });
    const defeatedBoss = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Attack($input: AttackClanBossInput!) { attackClanBoss(input: $input) { status currentHealth viewerEligibleForReward viewerRewardClaimed rewardType rewardAmount } }',
        variables: {
          input: {
            encounterId: bossPayload.data.summonClanBoss.id,
            expectedVersion: firstAttackPayload.data.attackClanBoss.version,
            idempotencyKey: `boss-finisher-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(defeatedBoss.text).toContain(
      '"status":"WON","currentHealth":0,"viewerEligibleForReward":true,"viewerRewardClaimed":false,"rewardType":"VEIL_ECHO","rewardAmount":5',
    );
    const bossRewardKey = `boss-reward-${Date.now()}`;
    const claimBossReward = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Claim($input: ClaimClanBossRewardInput!) { claimClanBossReward(input: $input) { viewerRewardClaimed rewardType rewardAmount } }',
          variables: {
            input: {
              encounterId: bossPayload.data.summonClanBoss.id,
              idempotencyKey: bossRewardKey,
            },
          },
        })
        .expect(200);
    const firstBossReward = await claimBossReward();
    const retriedBossReward = await claimBossReward();
    expect(firstBossReward.body).toEqual(retriedBossReward.body);
    expect(firstBossReward.text).toContain(
      '"viewerRewardClaimed":true,"rewardType":"VEIL_ECHO","rewardAmount":5',
    );
    expect(
      await prisma.client.clanBossRewardClaim.count({
        where: { encounterId: bossPayload.data.summonClanBoss.id },
      }),
    ).toBe(1);
    expect(
      await prisma.client.characterResource.findUnique({
        where: {
          characterId_type: {
            characterId: rewardedCharacter.id,
            type: 'VEIL_ECHO',
          },
        },
      }),
    ).toMatchObject({ balance: 5 });

    await prisma.client.character.update({
      where: { id: rewardedCharacter.id },
      data: { level: 30 },
    });
    const awakenedState = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myInventory { baseDamage } myTalents { characterVersion availablePoints resources { type amount } talents { type rank maxRank advanced unlocked costResource costAmount affordable } } }',
      })
      .expect(200);
    const awakenedPayload = JSON.parse(awakenedState.text) as {
      data: {
        myInventory: { baseDamage: number };
        myTalents: {
          characterVersion: number;
          availablePoints: number;
          talents: Array<{
            type: string;
            rank: number;
            advanced: boolean;
            unlocked: boolean;
            costResource: string;
            costAmount: number;
            affordable: boolean;
          }>;
        };
      };
    };
    expect(awakenedPayload.data.myTalents.talents).toContainEqual(
      expect.objectContaining({
        type: 'AWAKENED_POWER',
        rank: 0,
        advanced: true,
        unlocked: true,
        costResource: 'VEIL_ECHO',
        costAmount: 5,
        affordable: true,
      }),
    );
    const pointsBeforeAscension =
      awakenedPayload.data.myTalents.availablePoints;
    const awakenedUpgrade = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Upgrade($input: UpgradeTalentInput!) { upgradeTalent(input: $input) { availablePoints resources { type amount } talents { type rank } } }',
        variables: {
          input: {
            type: 'AWAKENED_POWER',
            expectedCharacterVersion:
              awakenedPayload.data.myTalents.characterVersion,
            idempotencyKey: `awakened-power-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(awakenedUpgrade.text).toContain(
      `"availablePoints":${pointsBeforeAscension}`,
    );
    expect(awakenedUpgrade.text).toContain('"type":"VEIL_ECHO","amount":0');
    expect(awakenedUpgrade.text).toContain('"type":"AWAKENED_POWER","rank":1');
    const awakenedCharacter = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ myInventory { baseDamage } }' })
      .expect(200);
    const awakenedCharacterPayload = JSON.parse(awakenedCharacter.text) as {
      data: { myInventory: { baseDamage: number } };
    };
    expect(awakenedCharacterPayload.data.myInventory.baseDamage).toBe(
      awakenedPayload.data.myInventory.baseDamage + 8,
    );

    const clanVersionAfterFirstSummon =
      developmentResult.data.upgradeClanDevelopment.version + 1;
    const lockedSecondTier = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Summon($input: SummonClanBossInput!) { summonClanBoss(input: $input) { id } }',
        variables: {
          input: {
            expectedClanVersion: clanVersionAfterFirstSummon,
            idempotencyKey: `summon-tier-2-locked-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const lockedSecondTierPayload = JSON.parse(lockedSecondTier.text) as {
      errors?: unknown[];
    };
    expect(lockedSecondTierPayload.errors).toBeDefined();

    await prisma.client.clanDevelopment.update({
      where: {
        clanId_branch: {
          clanId: clanResult.data.createClan.id,
          branch: 'MILITARY',
        },
      },
      data: { rank: 2 },
    });
    const secondTier = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Summon($input: SummonClanBossInput!) { summonClanBoss(input: $input) { id tier maxHealth currentHealth version rewardAmount nextTier } }',
        variables: {
          input: {
            expectedClanVersion: clanVersionAfterFirstSummon,
            idempotencyKey: `summon-tier-2-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const secondTierPayload = JSON.parse(secondTier.text) as {
      data: {
        summonClanBoss: {
          id: string;
          tier: number;
          maxHealth: number;
          currentHealth: number;
          version: number;
          rewardAmount: number;
          nextTier: number;
        };
      };
    };
    expect(secondTierPayload.data.summonClanBoss).toMatchObject({
      tier: 2,
      maxHealth: 1500,
      currentHealth: 1500,
      rewardAmount: 10,
      nextTier: 2,
    });
    const secondTierBoss = secondTierPayload.data.summonClanBoss;
    const secondTierAttack = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Attack($input: AttackClanBossInput!) { attackClanBoss(input: $input) { version viewerCanAttack viewerCurrentHealth viewerMaxHealth participants { characterId currentHealth maxHealth defeated } } }',
        variables: {
          input: {
            encounterId: secondTierBoss.id,
            expectedVersion: secondTierBoss.version,
            idempotencyKey: `boss-tier-2-attack-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const secondTierAttackPayload = JSON.parse(secondTierAttack.text) as {
      data: {
        attackClanBoss: {
          version: number;
          viewerCanAttack: boolean;
          viewerCurrentHealth: number;
          viewerMaxHealth: number;
        };
      };
    };
    expect(secondTierAttackPayload.data.attackClanBoss.viewerCanAttack).toBe(
      true,
    );
    expect(
      secondTierAttackPayload.data.attackClanBoss.viewerCurrentHealth,
    ).toBeLessThan(secondTierAttackPayload.data.attackClanBoss.viewerMaxHealth);
    await prisma.client.clanBossParticipant.update({
      where: {
        encounterId_characterId: {
          encounterId: secondTierBoss.id,
          characterId: rewardedCharacter.id,
        },
      },
      data: { currentHealth: 1 },
    });
    const knockout = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation Attack($input: AttackClanBossInput!) { attackClanBoss(input: $input) { version viewerCanAttack viewerCurrentHealth participants { defeated } } }',
        variables: {
          input: {
            encounterId: secondTierBoss.id,
            expectedVersion:
              secondTierAttackPayload.data.attackClanBoss.version,
            idempotencyKey: `boss-tier-2-knockout-${Date.now()}`,
          },
        },
      })
      .expect(200);
    expect(knockout.text).toContain(
      '"viewerCanAttack":false,"viewerCurrentHealth":0',
    );

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

    const factionState = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ myFaction { faction characterVersion canChangeFaction dawnStrength ashenStrength frontLevelMin frontLevelMax } }',
      })
      .expect(200);
    const factionPayload = JSON.parse(factionState.text) as {
      data: {
        myFaction: {
          faction: string | null;
          characterVersion: number;
          canChangeFaction: boolean;
          dawnStrength: number;
          ashenStrength: number;
          frontLevelMin: number;
          frontLevelMax: number;
        };
      };
    };
    expect(factionPayload.data.myFaction).toMatchObject({
      faction: null,
      canChangeFaction: true,
      frontLevelMin: 21,
      frontLevelMax: 30,
    });
    expect(
      factionPayload.data.myFaction.dawnStrength +
        factionPayload.data.myFaction.ashenStrength,
    ).toBe(200);

    const chooseFaction = async (
      faction: 'DAWN_COVENANT' | 'ASHEN_HOST',
      expectedCharacterVersion: number,
    ) =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Choose($input: ChooseFactionInput!) { chooseFaction(input: $input) { faction characterVersion canChangeFaction } }',
          variables: {
            input: {
              faction,
              expectedCharacterVersion,
              idempotencyKey: `faction-${faction}-${Date.now()}`,
            },
          },
        })
        .expect(200);
    const firstFaction = await chooseFaction(
      'DAWN_COVENANT',
      factionPayload.data.myFaction.characterVersion,
    );
    const firstFactionPayload = JSON.parse(firstFaction.text) as {
      data: {
        chooseFaction: { characterVersion: number; canChangeFaction: boolean };
      };
    };
    expect(firstFaction.text).toContain('"faction":"DAWN_COVENANT"');
    expect(firstFactionPayload.data.chooseFaction.canChangeFaction).toBe(true);
    const changedFaction = await chooseFaction(
      'ASHEN_HOST',
      firstFactionPayload.data.chooseFaction.characterVersion,
    );
    expect(changedFaction.text).toContain(
      '"faction":"ASHEN_HOST","characterVersion":',
    );
    expect(changedFaction.text).toContain('"canChangeFaction":false');
    const changedFactionPayload = JSON.parse(changedFaction.text) as {
      data: { chooseFaction: { characterVersion: number } };
    };
    const forbiddenReturn = await chooseFaction(
      'DAWN_COVENANT',
      changedFactionPayload.data.chooseFaction.characterVersion,
    );
    expect(forbiddenReturn.text).toContain('errors');

    await prisma.client.$transaction([
      prisma.client.character.update({
        where: { id: combatUser.character!.id },
        data: { level: 30, experience: 84_100 },
      }),
      prisma.client.characterWorldState.update({
        where: { characterId: combatUser.character!.id },
        data: { currentLocation: 'CINDERHAVEN_GATE' },
      }),
      prisma.client.characterResource.upsert({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'BOSS_INVOCATION_SEAL',
          },
        },
        create: {
          characterId: combatUser.character!.id,
          type: 'BOSS_INVOCATION_SEAL',
          balance: 2,
        },
        update: { balance: 2 },
      }),
    ]);

    type InvocationResult = {
      id: string;
      summonedBoss: boolean;
      summonedBossId: string;
      enemyName: string;
      enemy: { maxHealth: number };
    };
    const invokeBoss = async (
      field: 'invokeCursedKnight' | 'invokeFallenElf',
      idempotencyKey: string,
    ) => {
      const response = await request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query: `mutation Invoke($input: InvokeBossInput!) { ${field}(input: $input) { id summonedBoss summonedBossId enemyName enemy { maxHealth } } }`,
          variables: { input: { idempotencyKey } },
        })
        .expect(200);
      const payload = JSON.parse(response.text) as {
        data: Record<typeof field, InvocationResult>;
      };
      return payload.data[field];
    };
    const forceBossVictory = async (battleId: string) => {
      const battle = await prisma.client.battle.findUniqueOrThrow({
        where: { id: battleId },
      });
      await prisma.client.battle.update({
        where: { id: battle.id },
        data: {
          state: {
            ...(battle.state as Record<string, unknown>),
            status: 'WON',
            version: battle.version + 1,
            enemy: {
              ...((battle.state as Record<string, unknown>).enemy as Record<
                string,
                unknown
              >),
              health: 0,
            },
          },
          status: 'WON',
          version: { increment: 1 },
          activeCharacterId: null,
          completedAt: new Date(),
        },
      });
    };
    const claimInvocationReward = async (
      battleId: string,
      expectedType: string,
    ) => {
      const response = await request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Claim($input: ClaimBattleRewardInput!) { claimBattleReward(input: $input) { resources { type amount } } }',
          variables: {
            input: {
              battleId,
              idempotencyKey: `boss-reward-${battleId}`,
            },
          },
        })
        .expect(200);
      const payload = JSON.parse(response.text) as {
        data: {
          claimBattleReward: {
            resources: Array<{ type: string; amount: number }>;
          };
        };
      };
      expect(payload.data.claimBattleReward.resources).toContainEqual({
        type: expectedType,
        amount: 1,
      });
    };
    const acknowledgeBoss = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({ query: 'mutation { returnToWatchpost }' })
        .expect(200);

    const cursedKey = `invoke-cursed-${Date.now()}`;
    const cursedInvocation = await invokeBoss('invokeCursedKnight', cursedKey);
    expect(cursedInvocation).toMatchObject({
      summonedBoss: true,
      summonedBossId: 'CURSED_KNIGHT',
      enemyName: 'Проклятий лицар Морґрейв',
    });
    const cursedBattleId = cursedInvocation.id;
    const repeatedInvocation = await invokeBoss(
      'invokeCursedKnight',
      cursedKey,
    );
    expect(repeatedInvocation.id).toBe(cursedBattleId);
    expect(
      await prisma.client.characterResource.findUniqueOrThrow({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'BOSS_INVOCATION_SEAL',
          },
        },
      }),
    ).toMatchObject({ balance: 1 });
    expect(
      await prisma.client.resourceLedgerEntry.count({
        where: {
          characterId: combatUser.character!.id,
          type: 'BOSS_INVOCATION_SEAL',
          amount: -1,
          reason: 'BOSS_INVOCATION',
        },
      }),
    ).toBe(1);
    await forceBossVictory(cursedBattleId);
    await claimInvocationReward(cursedBattleId, 'CURSED_HEART');
    await acknowledgeBoss();

    await prisma.client.characterResource.update({
      where: {
        characterId_type: {
          characterId: combatUser.character!.id,
          type: 'CURSED_HEART',
        },
      },
      data: { balance: 3 },
    });
    const fallenInvocation = await invokeBoss(
      'invokeFallenElf',
      `invoke-fallen-${Date.now()}`,
    );
    expect(fallenInvocation).toMatchObject({
      summonedBoss: true,
      summonedBossId: 'FALLEN_ELF',
      enemyName: 'Павший ельф Саелір',
    });
    const fallenBattleId = fallenInvocation.id;
    expect(
      await prisma.client.characterResource.findUniqueOrThrow({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'CURSED_HEART',
          },
        },
      }),
    ).toMatchObject({ balance: 0 });
    await forceBossVictory(fallenBattleId);
    await claimInvocationReward(fallenBattleId, 'FALLEN_ELF_EYE');
    await acknowledgeBoss();
    expect(
      await prisma.client.characterWorldState.findUniqueOrThrow({
        where: { characterId: combatUser.character!.id },
      }),
    ).toMatchObject({ currentLocation: 'CINDERHAVEN_GATE' });

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

    const forbiddenAdminQuery = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: '{ adminCharacters { id } }' })
      .expect(200);
    expect(forbiddenAdminQuery.text).toContain('errors');
    expect(forbiddenAdminQuery.text).toContain(
      'Administrative access required',
    );

    await prisma.client.user.update({
      where: { id: combatUser.id },
      data: { role: 'ADMIN' },
    });
    const adminCharacters = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          '{ adminCharacters(search: "Hero", take: 10) { id name email userRole level resources { type amount } } }',
      })
      .expect(200);
    expect(adminCharacters.text).toContain(`"email":"${email}"`);
    expect(adminCharacters.text).toContain('"userRole":"ADMIN"');

    const ironBefore =
      (
        await prisma.client.characterResource.findUnique({
          where: {
            characterId_type: {
              characterId: combatUser.character!.id,
              type: 'IRON',
            },
          },
        })
      )?.balance ?? 0;
    const resourceAdminKey = `admin-resource-${Date.now()}`;
    const adjustResource = () =>
      request(server)
        .post('/graphql')
        .set('Cookie', cookie)
        .send({
          query:
            'mutation Adjust($input: AdjustCharacterResourceInput!) { adminAdjustCharacterResource(input: $input) { auditId character { id version resources { type amount } } } }',
          variables: {
            input: {
              characterId: combatUser.character!.id,
              resourceType: 'IRON',
              delta: 7,
              reason: 'E2E verification of audited resource adjustment',
              idempotencyKey: resourceAdminKey,
            },
          },
        })
        .expect(200);
    const adjusted = await adjustResource();
    const adjustedRetry = await adjustResource();
    const adjustedPayload = JSON.parse(adjusted.text) as {
      data: { adminAdjustCharacterResource: { auditId: string } };
    };
    const adjustedRetryPayload = JSON.parse(adjustedRetry.text) as {
      data: { adminAdjustCharacterResource: { auditId: string } };
    };
    expect(adjustedRetryPayload.data.adminAdjustCharacterResource.auditId).toBe(
      adjustedPayload.data.adminAdjustCharacterResource.auditId,
    );
    expect(
      await prisma.client.characterResource.findUniqueOrThrow({
        where: {
          characterId_type: {
            characterId: combatUser.character!.id,
            type: 'IRON',
          },
        },
      }),
    ).toMatchObject({ balance: ironBefore + 7 });
    expect(
      await prisma.client.resourceLedgerEntry.count({
        where: {
          characterId: combatUser.character!.id,
          type: 'IRON',
          amount: 7,
          reason: 'ADMIN_ADJUSTMENT',
        },
      }),
    ).toBe(1);

    const setAdminLevel = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query:
          'mutation SetLevel($input: SetCharacterLevelInput!) { adminSetCharacterLevel(input: $input) { auditId character { level experience } } }',
        variables: {
          input: {
            characterId: combatUser.character!.id,
            level: 31,
            reason: 'E2E verification of audited level adjustment',
            idempotencyKey: `admin-level-${Date.now()}`,
          },
        },
      })
      .expect(200);
    const setAdminLevelPayload = JSON.parse(setAdminLevel.text) as {
      data: {
        adminSetCharacterLevel: {
          auditId: string;
          character: { level: number; experience: number };
        };
      };
    };
    expect(setAdminLevelPayload).toMatchObject({
      data: {
        adminSetCharacterLevel: {
          character: { level: 31, experience: 90_000 },
        },
      },
    });
    const auditLogs = await request(server)
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query: `{ adminAuditLogs(targetId: "${combatUser.character!.id}") { action actorEmail reason } }`,
      })
      .expect(200);
    expect(auditLogs.text).toContain('ADJUST_CHARACTER_RESOURCE');
    expect(auditLogs.text).toContain('SET_CHARACTER_LEVEL');

    await prisma.client.user.update({
      where: { id: combatUser.id },
      data: { role: 'PLAYER' },
    });

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
