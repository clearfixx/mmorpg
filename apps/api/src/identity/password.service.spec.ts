import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes without storing the password and verifies it', async () => {
    const encoded = await service.hash('a secure example password');
    expect(encoded).not.toContain('a secure example password');
    await expect(
      service.verify('a secure example password', encoded),
    ).resolves.toBe(true);
    await expect(service.verify('wrong password', encoded)).resolves.toBe(
      false,
    );
  });

  it('uses a unique salt for each hash', async () => {
    const first = await service.hash('same password');
    const second = await service.hash('same password');
    expect(first).not.toBe(second);
  });
});
