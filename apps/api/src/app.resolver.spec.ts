import { AppResolver } from './app.resolver';

describe('AppResolver', () => {
  it('reports API readiness', () => {
    expect(new AppResolver().status()).toBe('veilfall-api-ready');
  });
});
