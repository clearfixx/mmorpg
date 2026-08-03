import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const DUMMY_SALT = Buffer.from('veilfall-login-dummy-salt');
const DUMMY_HASH = [
  'scrypt',
  COST,
  BLOCK_SIZE,
  PARALLELIZATION,
  DUMMY_SALT.toString('base64url'),
  scryptSync('not-a-real-password', DUMMY_SALT, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  }).toString('base64url'),
].join('$');

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  cost: number,
  blockSize: number,
  parallelization: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelization },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await derive(
      password,
      salt,
      KEY_LENGTH,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
    );

    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encoded: string | null): Promise<boolean> {
    encoded ??= DUMMY_HASH;
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] =
      encoded.split('$');
    if (
      !algorithm ||
      !cost ||
      !blockSize ||
      !parallelization ||
      !saltValue ||
      !hashValue ||
      algorithm !== 'scrypt'
    )
      return false;

    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await derive(
      password,
      Buffer.from(saltValue, 'base64url'),
      expected.length,
      Number(cost),
      Number(blockSize),
      Number(parallelization),
    );

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
