// The password screen in front of the application. The portal itself is public. This is a client-side gate: it keeps casual
// visitors out, but the hashes below ship in the JavaScript bundle, so it is
// not real security. Real protection needs a server-side login.
//
// The password is compared in a normalised form (lower case, no spaces) as a
// SHA-256 hash, so the password itself is not in the source.
const ACCESS_HASHES = [
  '703b6e248758e6f15b02ce145f950fa5d88bfcf427471338ab270fc3fa674265',
];

function normalise(text) {
  return text.toLowerCase().replace(/\s+/g, '');
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot check passwords on a connection that is not secure. Open the site over https.');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isApplicationPassphrase(text) {
  return ACCESS_HASHES.includes(await sha256Hex(normalise(text)));
}
