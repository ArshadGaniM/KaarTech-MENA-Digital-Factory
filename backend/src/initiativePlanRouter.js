import { Router } from "express";
import { pool } from "./db.js";
import { notFound, validationError } from "./errors.js";
import { requireInternalApiKey } from "./auth.js";
import { INITIATIVE_PLAN_KEYS, INITIATIVE_PLAN_WEEKS } from "./initiativePlanKeys.js";

// Actual progress against the locked initiative plan (FEAT-28). The plan is not
// stored or served here: it lives, read-only, in the frontend. This route only
// records what actually happened, one row per plan activity, so the Project
// Plan section can draw the actual bar under the planned one. Reads are open
// like the other read routes; writes need the internal API key.

const DEFAULT_ACTOR = "Arshad Gani";
const MAX_ACTOR_LENGTH = 255;

const isWeek = (value) => Number.isInteger(value) && value >= 1 && value <= INITIATIVE_PLAN_WEEKS;

function toResponse(row) {
  return {
    activityKey: row.activity_key,
    actualStartWeek: row.actual_start_week,
    actualEndWeek: row.actual_end_week,
    actualPoc: row.actual_poc,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function parseBody(body) {
  const source = body && typeof body === "object" ? body : {};
  const problems = [];
  const start = source.actualStartWeek ?? null;
  const end = source.actualEndWeek ?? null;

  if (start !== null && !isWeek(start)) problems.push(["actualStartWeek", `actualStartWeek must be a whole week from 1 to ${INITIATIVE_PLAN_WEEKS}, or null.`]);
  if (end !== null && !isWeek(end)) problems.push(["actualEndWeek", `actualEndWeek must be a whole week from 1 to ${INITIATIVE_PLAN_WEEKS}, or null.`]);
  if (isWeek(end) && start === null) problems.push(["actualStartWeek", "actualStartWeek is required when actualEndWeek is given."]);
  else if (isWeek(start) && isWeek(end) && end < start) problems.push(["actualEndWeek", "actualEndWeek cannot be before actualStartWeek."]);
  if (!Number.isInteger(source.actualPoc) || source.actualPoc < 0 || source.actualPoc > 100) {
    problems.push(["actualPoc", "actualPoc must be a whole number from 0 to 100."]);
  }

  const rawActor = source.updatedBy;
  if (rawActor !== undefined && rawActor !== null && typeof rawActor !== "string") {
    problems.push(["updatedBy", "updatedBy must be a string."]);
  } else if (typeof rawActor === "string" && rawActor.trim().length > MAX_ACTOR_LENGTH) {
    problems.push(["updatedBy", `updatedBy must be ${MAX_ACTOR_LENGTH} characters or fewer.`]);
  }

  if (problems.length > 0) throw validationError(Object.fromEntries(problems));
  return { start, end, poc: source.actualPoc, actor: (typeof rawActor === "string" && rawActor.trim()) || DEFAULT_ACTOR };
}

function assertKnownKey(key) {
  if (!INITIATIVE_PLAN_KEYS.includes(key)) throw notFound("initiative_plan_activity", key);
}

export function createInitiativePlanRouter({ query = (sql, params) => pool.query(sql, params) } = {}) {
  const router = Router();

  router.get("/actuals", async (req, res, next) => {
    try {
      const result = await query(
        `select activity_key, actual_start_week, actual_end_week, actual_poc, updated_by, updated_at
         from initiative_plan_actuals order by activity_key`,
        []
      );
      res.json({ data: result.rows.map(toResponse) });
    } catch (err) {
      next(err);
    }
  });

  router.put("/actuals/:key", requireInternalApiKey, async (req, res, next) => {
    try {
      assertKnownKey(req.params.key);
      const { start, end, poc, actor } = parseBody(req.body);
      const result = await query(
        `insert into initiative_plan_actuals (activity_key, actual_start_week, actual_end_week, actual_poc, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $5)
         on conflict (activity_key) do update
           set actual_start_week = $2, actual_end_week = $3, actual_poc = $4, updated_by = $5, updated_at = now()
         returning activity_key, actual_start_week, actual_end_week, actual_poc, updated_by, updated_at`,
        [req.params.key, start, end, poc, actor]
      );
      res.json({ data: toResponse(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/actuals/:key", requireInternalApiKey, async (req, res, next) => {
    try {
      assertKnownKey(req.params.key);
      const result = await query("delete from initiative_plan_actuals where activity_key = $1 returning activity_key", [req.params.key]);
      if (result.rows.length === 0) throw notFound("initiative_plan_actual", req.params.key);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
