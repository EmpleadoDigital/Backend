import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes passwords with Argon2id (m=65536) and verifies matches', async () => {
    const hash = await service.hash('MiClaveSegura123');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=65536');
    await expect(service.verify(hash, 'MiClaveSegura123')).resolves.toBe(true);
    await expect(service.verify(hash, 'ClaveIncorrecta')).resolves.toBe(false);
  });

  it('returns false on malformed hash instead of throwing', async () => {
    await expect(service.verify('not-a-valid-hash', 'anything')).resolves.toBe(
      false,
    );
  });
});
