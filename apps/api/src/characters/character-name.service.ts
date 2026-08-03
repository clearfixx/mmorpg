import { BadRequestException, Injectable } from '@nestjs/common';

const RESERVED_NAMES = new Set([
  'admin',
  'administrator',
  'administration',
  'moderator',
  'support',
  'system',
  'адмін',
  'адміністратор',
  'адміністрація',
  'модератор',
  'підтримка',
  'система',
]);

@Injectable()
export class CharacterNameService {
  normalize(input: string): { name: string; nameKey: string } {
    const name = input.normalize('NFC').trim().replace(/\s+/g, ' ');
    const nameKey = name.toLocaleLowerCase('uk-UA');

    if (name.length < 3 || name.length > 24 || RESERVED_NAMES.has(nameKey)) {
      throw new BadRequestException('Character name is unavailable');
    }

    return { name, nameKey };
  }
}
