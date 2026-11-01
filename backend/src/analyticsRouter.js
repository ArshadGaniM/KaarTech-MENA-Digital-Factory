import { Router } from "express";
import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { ASSIGNMENTS_SQL, buildPeople, buildSeats, buildStructure, CATALOG_SQL, COMPETENCY_PRACTICE_SQL, DEPLOYMENTS_SQL, HEALTH_SQL, PEOPLE_SQL, SNAPSHOTS_SQL, STRUCTURE_SQL, validateRange } from "./analytics.js";
import { requireInternalApiKey } from "./auth.js";
import { loadControlCenterRows } from "./controlCenter.js";
import { takeSnapshot } from "./snapshots.js";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentDay = () => new Date().toISOString().slice(0, 10);

// Read-only, like every GET in this API.
export function createAnalyticsRouter({ query = (...args) => pool.query(...args), now = currentMonth, today = currentDay } = {}) {
  const router = Router();

  router.get("/people", async (req, res, next) => {
    try {
      const { rows } = await query(PEOPLE_SQL);
      res.json({ data: buildPeople(rows), total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/structure", async (req, res, next) => {
    try {
      const [positions, competencies] = await Promise.all([query(STRUCTURE_SQL), query(COMPETENCY_PRACTICE_SQL)]);
      const data = buildStructure(positions.rows, competencies.rows);
      res.json({ data, total: data.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/catalog", async (req, res, next) => {
    try {
      const { rows } = await query(CATALOG_SQL);
      res.json({ data: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/deployments", async (req, res, next) => {
    try {
      const { rows } = await query(DEPLOYMENTS_SQL);
      res.json({ data: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/snapshots", async (req, res, next) => {
    try {
      const { rows } = await query(SNAPSHOTS_SQL);
      res.json({ data: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  // Saves this month's snapshot now. The backend also does it by itself every
  // six hours, so this is for taking one on demand.
  router.post("/snapshots", requireInternalApiKey, async (req, res, next) => {
    try {
      const month = now();
      const rows = await takeSnapshot({ query, month, today: today() });
      res.status(201).json({ data: { month, rows } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/health", async (req, res, next) => {
    try {
      const { rows } = await query(HEALTH_SQL);
      res.json({ data: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/assignments", async (req, res, next) => {
    try {
      const { rows } = await query(ASSIGNMENTS_SQL);
      res.json({ data: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  // ?from=YYYY-MM&to=YYYY-MM, both included. Without them: the current month.
  router.get("/seats", async (req, res, next) => {
    try {
      const from = req.query.from ?? now();
      const to = req.query.to ?? from;
      const problems = typeof from === "string" && typeof to === "string" ? validateRange(from, to) : { from: "from and to must be given once." };
      if (Object.keys(problems).length > 0) throw validationError(problems);
      const data = buildSeats(await loadControlCenterRows(query), from, to, today());
      res.json({ data, total: data.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
