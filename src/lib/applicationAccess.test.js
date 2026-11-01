import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApplicationPassphrase } from './applicationAccess';

describe('isApplicationPassphrase', () => {
  it.each(['MENAUOCC', 'menauocc', 'MENA UOCC'])('accepts %j', async (text) => {
    expect(await isApplicationPassphrase(text)).toBe(true);
  });

  it.each(['', 'MENA', 'Meena UOCC', 'MENAUOCC!', 'password'])('rejects %j', async (text) => {
    expect(await isApplicationPassphrase(text)).toBe(false);
  });
});

describe('when the browser cannot help', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says so, instead of failing silently, when crypto.subtle is missing', async () => {
    vi.stubGlobal('crypto', {});

    await expect(isApplicationPassphrase('MENAUOCC')).rejects.toThrow(/not secure/);
  });
});
