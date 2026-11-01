import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('when the browser cannot help', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says so, instead of failing silently, when crypto.subtle is missing', async () => {
    vi.stubGlobal('crypto', {});

    await expect(isApplicationPassphrase('MENAUOCC')).rejects.toThrow(/not secure/);
  });

  it('reads as locked, and writing does not throw, when session storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readApplicationUnlocked()).toBe(false);
    expect(() => writeApplicationUnlocked()).not.toThrow();
    vi.restoreAllMocks();
  });
});
