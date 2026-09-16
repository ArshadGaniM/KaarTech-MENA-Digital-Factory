import { Router } from "express";
import { pool } from "./db.js";
import { notFound } from "./errors.js";
import { toResponse, validateBody } from "./masterDataSchema.js";

// Shared CRUD behaviour for every master data table (CLAUDE.md request:
// practices, delivery_centers, skill_sets, modules, resources, departments
// all follow the identical add/modify/mark-deleted + created_at/updated_at
// contract) — one factory instead of six near-identical route files.
// "mark deleted" is a soft delete: DELETE sets deleted_at rather than
// removing the row, and every read excludes rows where deleted_at is set.
// tableName/resourceName come only from the fixed allow-list in index.js
// (never from request input), so interpolating tableName into the SQL
// below is safe — Postgres has no bind-parameter syntax for identifiers,
// and all actual values still go through $1/$2 bound parameters.
export function createMasterDataRouter(tableName, resourceName) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      const [rows, count] = await Promise.all([
        pool.query(
          `select * from ${tableName} where deleted_at is null order by name asc limit $1 offset $2`,
          [limit, offset]
        ),
        pool.query(`select count(*)::int as total from ${tableName} where deleted_at is null`),
      ]);

      res.json({ data: rows.rows.map(toResponse), total: count.rows[0].total });
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
      res.json({ data: toResponse(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      validateBody(req.body);
      const result = await pool.query(
        `insert into ${tableName} (name) values ($1) returning *`,
        [req.body.name]
      );
      res.status(201).json({ data: toResponse(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      validateBody(req.body, { partial: true });
      const existing = await pool.query(
        `select * from ${tableName} where id = $1 and deleted_at is null`,
        [req.params.id]
      );
      if (existing.rows.length === 0) throw notFound(resourceName, req.params.id);

      const name = req.body.name ?? existing.rows[0].name;
      const result = await pool.query(
        `update ${tableName} set name = $1 where id = $2 returning *`,
        [name, req.params.id]
      );
      res.json({ data: toResponse(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
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
