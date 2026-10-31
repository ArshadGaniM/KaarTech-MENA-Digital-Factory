// FRONTEND_URL supports a comma-separated list since Vercel serves the same
// deployment behind multiple origins (the project's primary domain and its
// team-scoped alias) that the frontend can legitimately be loaded from.
//
// When it is unset, development allows any origin so a local setup works
// without configuration. In production an unset value allows no other site
// at all: the API returns employee names and allocation, so it must not be
// readable from any origin by default.
export function parseAllowedOrigins(frontendUrl, nodeEnv = process.env.NODE_ENV) {
  const origins = frontendUrl?.split(",").map((url) => url.trim()).filter(Boolean);
  if (origins?.length) return origins;
  return nodeEnv === "production" ? [] : "*";
}
