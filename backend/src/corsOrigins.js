// FRONTEND_URL supports a comma-separated list since Vercel serves the same
// deployment behind multiple origins (the project's primary domain and its
// team-scoped alias) that the frontend can legitimately be loaded from.
export function parseAllowedOrigins(frontendUrl) {
  const origins = frontendUrl?.split(",").map((url) => url.trim()).filter(Boolean);
  return origins?.length ? origins : "*";
}
