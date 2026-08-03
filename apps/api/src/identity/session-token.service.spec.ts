import { SessionTokenService } from './session-token.service';

describe('SessionTokenService', () => {
  const service = new SessionTokenService();

  it('creates unpredictable tokens and deterministic hashes', () => {
    const first = service.create();
    const second = service.create();
    expect(first).not.toBe(second);
    expect(service.hash(first)).toHaveLength(64);
    expect(service.hash(first)).toBe(service.hash(first));
  });
});
