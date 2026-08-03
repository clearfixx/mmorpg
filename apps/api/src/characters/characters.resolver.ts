import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SessionService } from '../identity/session.service';
import type { GraphqlContext } from '../identity/identity.types';
import { CharactersService } from './characters.service';
import { CreateCharacterInput } from './dto/create-character.input';
import { CharacterModel } from './models/character.model';

@Resolver(() => CharacterModel)
export class CharactersResolver {
  constructor(
    private readonly characters: CharactersService,
    private readonly sessions: SessionService,
  ) {}

  @Query(() => CharacterModel, { nullable: true })
  async myCharacter(
    @Context() context: GraphqlContext,
  ): Promise<CharacterModel | null> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.characters.findForUser(viewer.id);
  }

  @Mutation(() => CharacterModel)
  async createCharacter(
    @Args('input') input: CreateCharacterInput,
    @Context() context: GraphqlContext,
  ): Promise<CharacterModel> {
    const viewer = await this.sessions.requireViewer(context.req);
    return this.characters.create(viewer.id, input);
  }
}
