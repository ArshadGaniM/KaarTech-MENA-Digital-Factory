import { Router } from "express";
import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { ASSIGNMENTS_SQL, buildPeople, buildSeats, buildStructure, CATALOG_SQL, COMPETENCY_PRACTICE_SQL, PEOPLE_SQL, STRUCTURE_SQL, validateRange } from "./analytics.js";
import { loadControlCenterRows } from "./controlCenter.js";

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
