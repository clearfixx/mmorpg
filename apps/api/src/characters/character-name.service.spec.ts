import { BadRequestException } from '@nestjs/common';

import { CharacterNameService } from './character-name.service';

describe('CharacterNameService', () => {
  const service = new CharacterNameService();

  it('normalizes spacing and creates a case-insensitive key', () => {
    expect(service.normalize('  Вартовий   Краю  ')).toEqual({
      name: 'Вартовий Краю',
      nameKey: 'вартовий краю',
    });
  });

  it('rejects reserved staff identities', () => {
    expect(() => service.normalize('Адміністрація')).toThrow(
      BadRequestException,
    );
  });
});
