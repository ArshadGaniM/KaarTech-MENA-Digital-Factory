// TLS settings for every database connection. Setting DATABASE_SSL_CA to
// the provider's CA certificate (PEM text) turns certificate verification
// on. Without it the long-standing behaviour stays: encrypted, but the
// server's certificate is not checked.
export function dbSsl(env = process.env) {
  const ca = env.DATABASE_SSL_CA?.trim();
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
