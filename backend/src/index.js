import express from "express";
import cors from "cors";
import { teamMembersRouter } from "./routes/teamMembers.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ data: { status: "ok" } });
});

app.use("/v1/team-members", teamMembersRouter);

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
