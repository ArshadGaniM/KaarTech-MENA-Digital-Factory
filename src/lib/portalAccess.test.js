import { afterEach, describe, expect, it } from 'vitest';
import { isPortalPassphrase, readPortalUnlocked, writePortalUnlocked } from './portalAccess';

afterEach(() => window.sessionStorage.clear());

describe('isPortalPassphrase', () => {
  it.each(['Meena UOCC', 'MENA UOCC', '  meena   uocc ', 'menauocc'])('accepts %j', async (text) => {
    expect(await isPortalPassphrase(text)).toBe(true);
  });

  it.each(['', 'Meena', 'meena uocc!', 'password'])('rejects %j', async (text) => {
    expect(await isPortalPassphrase(text)).toBe(false);
  });
});

describe('portal unlocked flag', () => {
  it('is locked until written, then stays unlocked for the tab', () => {
    expect(readPortalUnlocked()).toBe(false);
    writePortalUnlocked();
    expect(readPortalUnlocked()).toBe(true);
  });
});
