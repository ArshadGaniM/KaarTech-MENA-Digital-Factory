import { Router } from "express";
import { pool } from "./db.js";
import { notFound } from "./errors.js";
import { toResponse, validateBody, validateActor } from "./masterDataSchema.js";
import { requireInternalApiKey } from "./auth.js";

// No user/auth system exists yet — createdBy/updatedBy is caller-supplied
// (matches CLAUDE.md's ask verbatim: "created by which is me Arshad
// Ghani"), defaulting here so the MCP tools stay simple to call day to
// day while remaining overridable once more than one person uses them.
const DEFAULT_ACTOR = "Arshad Gani";

// Shared CRUD behaviour for every master data table (CLAUDE.md request:
// practices, delivery_centers, competencies, modules, resources, departments
// all follow the identical add/modify/mark-deleted + created/updated
// by/at contract) — one factory instead of six near-identical route
// files. Each table's own business columns come from `table.fields`
// (see masterDataTables.js); "mark deleted" is a soft delete: DELETE sets
// deleted_at rather than removing the row, and every read excludes rows
// where deleted_at is set.
//
// table.tableName / table.fields[].column come only from the fixed
// allow-list in masterDataTables.js (never from request input), so
// interpolating them into the SQL below is safe — Postgres has no
// bind-parameter syntax for identifiers, and all actual values still go
// through numbered bound parameters.
export function createMasterDataRouter(table) {
  const { tableName, resourceName, fields } = table;
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const [rows, count] = await Promise.all([
        pool.query(
          `select * from ${tableName} where deleted_at is null order by name asc limit $1 offset $2`,
          [limit, offset]
        ),
        pool.query(`select count(*)::int as total from ${tableName} where deleted_at is null`),
      ]);

      res.json({ data: rows.rows.map((row) => toResponse(table, row)), total: count.rows[0].total });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const result = await pool.query(
        `select * from ${tableName} where id = $1 and deleted_at is null`,
        [req.params.id]
      );
      if (result.rows.length === 0) throw notFound(resourceName, req.params.id);
      res.json({ data: toResponse(table, result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requireInternalApiKey, async (req, res, next) => {
    try {
      validateBody(table, req.body);
      const actor = req.body.updatedBy?.trim() || DEFAULT_ACTOR;
      validateActor(actor);

      const columns = [...fields.map((f) => f.column), "created_by", "updated_by"];
      const values = [...fields.map((f) => req.body[f.key]), actor, actor];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

      const result = await pool.query(
        `insert into ${tableName} (${columns.join(", ")}) values (${placeholders}) returning *`,
        values
      );
      res.status(201).json({ data: toResponse(table, result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", requireInternalApiKey, async (req, res, next) => {
    try {
      validateBody(table, req.body, { partial: true });
      const existing = await pool.query(
        `select * from ${tableName} where id = $1 and deleted_at is null`,
        [req.params.id]
      );
      if (existing.rows.length === 0) throw notFound(resourceName, req.params.id);

      const current = existing.rows[0];
      const actor = req.body.updatedBy?.trim() || DEFAULT_ACTOR;
      validateActor(actor);

      const columns = [...fields.map((f) => f.column), "updated_by"];
      const values = [...fields.map((f) => req.body[f.key] ?? current[f.column]), actor];
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

      const result = await pool.query(
        `update ${tableName} set ${setClause}
         where id = $${values.length + 1} and deleted_at is null returning *`,
        [...values, req.params.id]
      );
      if (result.rows.length === 0) throw notFound(resourceName, req.params.id);
      res.json({ data: toResponse(table, result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", requireInternalApiKey, async (req, res, next) => {
    try {
      const result = await pool.query(
        `update ${tableName} set deleted_at = now()
         where id = $1 and deleted_at is null returning id`,
        [req.params.id]
      );
      if (result.rows.length === 0) throw notFound(resourceName, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
