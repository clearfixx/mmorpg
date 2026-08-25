import { invocationSealRewardAmount } from './rewards.service';

describe('invocation seal test rewards', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAmount = process.env.VEILFALL_TEST_INVOCATION_SEALS;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAmount === undefined)
      delete process.env.VEILFALL_TEST_INVOCATION_SEALS;
    else process.env.VEILFALL_TEST_INVOCATION_SEALS = originalAmount;
  });

  it('allows a bounded local testing grant', () => {
    process.env.NODE_ENV = 'development';
    process.env.VEILFALL_TEST_INVOCATION_SEALS = '100';
    expect(invocationSealRewardAmount()).toBe(100);
  });

  it('never increases production rewards', () => {
    process.env.NODE_ENV = 'production';
    process.env.VEILFALL_TEST_INVOCATION_SEALS = '100';
    expect(invocationSealRewardAmount()).toBe(1);
  });
});
