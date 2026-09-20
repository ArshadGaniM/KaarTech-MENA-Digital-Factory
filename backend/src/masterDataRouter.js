import { Router } from "express";
import { pool } from "./db.js";
import {
  notFound,
  isUniqueViolation,
  duplicateFieldError,
  isForeignKeyViolation,
  referenceNotFoundError,
} from "./errors.js";
import {
  toResponse,
  validateBody,
  validateActor,
  validateReferences,
  validateCrossFields,
  lookupJoinSql,
  lookupSelectSql,
} from "./masterDataSchema.js";
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
// deleted_at rather than removing the row. Reads include soft-deleted
// rows (returned with markedDeleted: "Yes") so callers doing their own
// aggregation/simulation can decide to skip them by that flag, rather
// than have them silently vanish from every read; writes (PATCH/DELETE)
// still refuse to touch an already soft-deleted row.
//
// table.tableName / table.fields[].column come only from the fixed
// allow-list in masterDataTables.js (never from request input), so
// interpolating them into the SQL below is safe — Postgres has no
// bind-parameter syntax for identifiers, and all actual values still go
// through numbered bound parameters.

// validateReferences() already rejects a bad FK before every INSERT/UPDATE
// runs, so this only matters for the narrow race where the referenced row
// is removed between that check and the write — still needs the same 422
// treatment as a unique-violation rather than a leaked 500.
function mapWriteError(err, fields) {
  if (isUniqueViolation(err)) return duplicateFieldError(err, fields);
  if (isForeignKeyViolation(err)) return referenceNotFoundError(err, fields);
  return err;
}

export function createMasterDataRouter(table) {
  const { tableName, resourceName, fields } = table;
  const router = Router();

  // Per-table override for the sort column the placeholder `name` field
  // used to provide unconditionally — resource_cost (migration 0013)
  // dropped `name`, so it sets sortColumn: "employee_id" instead. Every
  // other table is unaffected: `table.sortColumn` is undefined for them,
  // so this falls back to the original "name" behaviour exactly.
  const sortColumn = table.sortColumn ?? "name";
  const joinSql = lookupJoinSql(table);
  const lookupColumns = lookupSelectSql(table);
  // `${tableName}.*` (not bare `*`) so a joined lookup table's same-named
  // columns (e.g. resources.name) can't collide with resource_cost's own
  // — same reasoning for qualifying deleted_at/sortColumn in ORDER BY.
  const selectList = [`${tableName}.*`, ...lookupColumns].join(", ");

  router.get("/", async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const [rows, count] = await Promise.all([
        // Active rows always sort before soft-deleted ones, so deleted rows
        // (which are never removed and only accumulate) can't crowd active
        // rows out of the page once the table holds more than `limit` rows.
        pool.query(
          `select ${selectList} from ${tableName} ${joinSql}
           order by (${tableName}.deleted_at is not null), ${tableName}.${sortColumn} asc
           limit $1 offset $2`,
          [limit, offset]
        ),
        pool.query(`select count(*)::int as total from ${tableName}`),
      ]);

      res.json({ data: rows.rows.map((row) => toResponse(table, row)), total: count.rows[0].total });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const result = await pool.query(
        `select ${selectList} from ${tableName} ${joinSql} where ${tableName}.id = $1`,
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
      await validateReferences(table, req.body);
      validateCrossFields(table, req.body);
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
      next(mapWriteError(err, fields));
    }
  });

  router.patch("/:id", requireInternalApiKey, async (req, res, next) => {
    try {
      validateBody(table, req.body, { partial: true });
      await validateReferences(table, req.body, { partial: true });
      const existing = await pool.query(
        `select * from ${tableName} where id = $1 and deleted_at is null`,
        [req.params.id]
      );
      if (existing.rows.length === 0) throw notFound(resourceName, req.params.id);

      const current = existing.rows[0];
      validateCrossFields(table, req.body, { current });
      const actor = req.body.updatedBy?.trim() || DEFAULT_ACTOR;
      validateActor(actor);

      const columns = [...fields.map((f) => f.column), "updated_by"];
      // ?? would treat an explicit null the same as "not sent" and silently
      // keep the current value — Object.hasOwn distinguishes "the key is
      // absent" (keep current) from "the key is present, set to null"
      // (clear it), so an optional field like practiceId can actually be
      // unset again once it's been set.
      const values = [
        ...fields.map((f) => (Object.hasOwn(req.body, f.key) ? req.body[f.key] : current[f.column])),
        actor,
      ];
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

      const result = await pool.query(
        `update ${tableName} set ${setClause}
         where id = $${values.length + 1} and deleted_at is null returning *`,
        [...values, req.params.id]
      );
      if (result.rows.length === 0) throw notFound(resourceName, req.params.id);
      res.json({ data: toResponse(table, result.rows[0]) });
    } catch (err) {
      next(mapWriteError(err, fields));
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
