import express from "express";
import cors from "cors";
import { teamMembersRouter } from "./routes/teamMembers.js";
import { createMasterDataRouter } from "./masterDataRouter.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { buildEntityRelationships } from "./entityRelationships.js";
import { parseAllowedOrigins } from "./corsOrigins.js";

const app = express();

app.use(cors({ origin: parseAllowedOrigins(process.env.FRONTEND_URL) }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ data: { status: "ok" } });
});

app.use("/v1/team-members", teamMembersRouter);

// FEAT-12: read-only, self-updating from MASTER_DATA_TABLES — see
// entityRelationships.js's header comment. No auth required, same as
// every other GET route (read access is unauthenticated throughout this
// API; only writes require the internal API key).
app.get("/v1/schema/entity-relationships", (req, res) => {
  res.json({ data: buildEntityRelationships(MASTER_DATA_TABLES) });
});

for (const table of MASTER_DATA_TABLES) {
  app.use(`/v1/${table.route}`, createMasterDataRouter(table));
}

app.use((req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "No route matches this path." } });
});

// Never expose stack traces, internal paths, or SQL errors to the client (api.md).
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const code = err.code || "internal_error";
  const message = status === 500 ? "An unexpected error occurred." : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: { code, message, details: err.details || {} } });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
