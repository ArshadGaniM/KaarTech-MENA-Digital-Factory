import { afterEach, describe, expect, it } from 'vitest';
import { isApplicationPassphrase, readApplicationUnlocked, writeApplicationUnlocked } from './applicationAccess';

afterEach(() => window.sessionStorage.clear());

describe('isApplicationPassphrase', () => {
  it.each(['MENAUOCC', 'menauocc', 'MENA UOCC'])('accepts %j', async (text) => {
    expect(await isApplicationPassphrase(text)).toBe(true);
  });

  it.each(['', 'MENA', 'Meena UOCC', 'MENAUOCC!', 'password'])('rejects %j', async (text) => {
    expect(await isApplicationPassphrase(text)).toBe(false);
  });
});

describe('application unlocked flag', () => {
  it('is locked until written, then stays unlocked for the tab', () => {
    expect(readApplicationUnlocked()).toBe(false);
    writeApplicationUnlocked();
    expect(readApplicationUnlocked()).toBe(true);
  });
});
