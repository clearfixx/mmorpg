import { ResourceType } from '@veilfall/database';
import { resourceDefinition } from '@veilfall/game-engine';

import {
  ResourceOrigin,
  ResourceRarity,
  type ResourceBalanceModel,
} from './models/resource-balance.model';

export function resourceBalance(
  type: ResourceType,
  amount: number,
): ResourceBalanceModel {
  const definition = resourceDefinition(type);
  return {
    type,
    amount,
    name: definition.name,
    description: definition.description,
    origin: definition.origin as ResourceOrigin,
    rarity: definition.rarity as ResourceRarity,
    tradeable: definition.tradeable,
    clanContributable: definition.clanContributable,
  };
}
