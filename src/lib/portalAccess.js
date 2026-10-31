// The portal's password screen. This is a client-side gate: it keeps casual
// visitors out, but the hashes below ship in the JavaScript bundle, so it is
// not real security. Real protection needs a server-side login.
//
// The passphrase is compared in a normalised form (lower case, no spaces) as a
// SHA-256 hash, so the phrase itself is not in the source. Both spellings the
// owner gave ("Meena UOCC" and "MENA UOCC") are accepted.
const ACCESS_HASHES = [
  '703b6e248758e6f15b02ce145f950fa5d88bfcf427471338ab270fc3fa674265',
  '027156a8199d7f537d7c43569b0d06e2e24f592424b5c8379d4c466644eeb7bb',
];
const STORAGE_KEY = 'portal-unlocked';

function normalise(text) {
  return text.toLowerCase().replace(/\s+/g, '');
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isPortalPassphrase(text) {
  return ACCESS_HASHES.includes(await sha256Hex(normalise(text)));
}

// Unlocked for this browser tab only: closing the tab locks the portal again.
export function readPortalUnlocked() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function writePortalUnlocked() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, 'yes');
  } catch {
    // Storage can be blocked. The portal still opens for this page view.
  }
}
