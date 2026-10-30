import { Router } from "express";
import { pool } from "./db.js";
import {
  notFound,
  notDeleted,
  validationError,
  isUniqueViolation,
  duplicateFieldError,
  isForeignKeyViolation,
  referenceNotFoundError,
  isInvalidTextRepresentation,
  invalidValueError,
} from "./errors.js";
import {
  toResponse,
  validateBody,
  validateActor,
  validateReferences,
  validateCrossFields,
  lookupJoinSql,
  lookupSelectSql,
  allocationSelectSql,
  validateAllocation,
  normalizeLists,
} from "./masterDataSchema.js";
import { requireInternalApiKey } from "./auth.js";

// No user/auth system exists yet — createdBy/updatedBy is caller-supplied
// (matches CLAUDE.md's ask verbatim: "created by which is me Arshad
// Ghani"), defaulting here so the MCP tools stay simple to call day to
// day while remaining overridable once more than one person uses them.
const DEFAULT_ACTOR = "Arshad Gani";

// `updatedBy` comes straight from the request body: a non-string (a number,
// an object) would otherwise throw on `.trim()` and surface as a 500
// instead of a 422 (gate finding, security-auditor).
function actorOf(body) {
  const raw = body?.updatedBy;
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    throw validationError({ updatedBy: "updatedBy must be a string." });
  }
  const actor = raw?.trim() || DEFAULT_ACTOR;
  validateActor(actor);
  return actor;
}

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
function mapWriteError(err, fields, body) {
  if (isUniqueViolation(err)) return duplicateFieldError(err, fields);
  if (isForeignKeyViolation(err)) return referenceNotFoundError(err, fields);
  if (isInvalidTextRepresentation(err)) return invalidValueError(err, fields, body);
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
  const selectList = [`${tableName}.*`, ...lookupColumns, ...allocationSelectSql(table)].join(", ");

  // Rows of one group (resource) are checked and written under a per-group
  // advisory lock held for the transaction, so two concurrent writes can't
  // both pass validateAllocation and together exceed the total. Tables
  // without an allocationRule skip the transaction entirely.
  async function withAllocationLock(groupValue, fn) {
    if (!table.allocationRule) return fn(pool);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1), $2::int)", [tableName, groupValue]);
      const out = await fn(client);
      await client.query("commit");
      return out;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // A write's `returning *` has no lookup/total columns; re-select through the
  // list query so the response carries employeeTotalAllocation like a GET.
  async function reselect(db, row) {
    if (!table.allocationRule) return row;
    const again = await db.query(
      `select ${selectList} from ${tableName} ${joinSql} where ${tableName}.id = $1`,
      [row.id]
    );
    return again.rows[0] ?? row;
  }

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
      normalizeLists(table, req.body);
      validateBody(table, req.body);
      await validateReferences(table, req.body);
      validateCrossFields(table, req.body);
      const actor = actorOf(req.body);

      const columns = [...fields.map((f) => f.column), "created_by", "updated_by"];
      const values = [...fields.map((f) => req.body[f.key]), actor, actor];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

      const created = await withAllocationLock(req.body[table.allocationRule?.groupKey], async (db) => {
        await validateAllocation(db, table, Object.fromEntries(fields.map((f) => [f.column, req.body[f.key]])));
        const result = await db.query(
          `insert into ${tableName} (${columns.join(", ")}) values (${placeholders}) returning *`,
          values
        );
        return reselect(db, result.rows[0]);
      });
      res.status(201).json({ data: toResponse(table, created) });
    } catch (err) {
      next(mapWriteError(err, fields, req.body));
    }
  });

  router.patch("/:id", requireInternalApiKey, async (req, res, next) => {
    try {
      normalizeLists(table, req.body);
      validateBody(table, req.body, { partial: true });
      await validateReferences(table, req.body, { partial: true });
      const existing = await pool.query(
        `select * from ${tableName} where id = $1 and deleted_at is null`,
        [req.params.id]
      );
      if (existing.rows.length === 0) throw notFound(resourceName, req.params.id);

      const current = existing.rows[0];
      validateCrossFields(table, req.body, { current });
      const actor = actorOf(req.body);

      const columns = [...fields.map((f) => f.column), "updated_by"];
      // ?? would treat an explicit null the same as "not sent" and silently
      // keep the current value — Object.hasOwn distinguishes "the key is
      // absent" (keep current) from "the key is present, set to null"
      // (clear it), so an optional field like practiceId can actually be
      // unset again once it's been set.
      const merged = fields.map((f) => (Object.hasOwn(req.body, f.key) ? req.body[f.key] : current[f.column]));
      const values = [...merged, actor];
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

      const groupIndex = fields.findIndex((f) => f.key === table.allocationRule?.groupKey);
      const updated = await withAllocationLock(groupIndex === -1 ? null : merged[groupIndex], async (db) => {
        await validateAllocation(
          db,
          table,
          Object.fromEntries(fields.map((f, i) => [f.column, merged[i]])),
          req.params.id
        );
        const result = await db.query(
          `update ${tableName} set ${setClause}
           where id = $${values.length + 1} and deleted_at is null returning *`,
          [...values, req.params.id]
        );
        if (result.rows.length === 0) throw notFound(resourceName, req.params.id);
        return reselect(db, result.rows[0]);
      });
      res.json({ data: toResponse(table, updated) });
    } catch (err) {
      next(mapWriteError(err, fields, req.body));
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

  // Undo of DELETE (FEAT-19): clears deleted_at. A non-CRUD action, so a
  // verb sub-resource per api.md rather than a PATCH (PATCH deliberately
  // refuses soft-deleted rows). validateReferences() requires a *live*
  // referenced row, so restoring a child whose parent is itself still
  // deleted would resurrect a row pointing at nothing — every FK is
  // re-checked here, with the same 422 shape, instead of silently
  // allowing it. The same check is repeated inside the UPDATE itself (see
  // liveParentsSql) so a parent deleted between the up-front check and the
  // write can't slip through either.
  const liveParentsSql = fields
    .filter((f) => f.references)
    .map(
      (f) =>
        ` and (${tableName}.${f.column} is null or exists (select 1 from ${f.references.table} where ${f.references.column} = ${tableName}.${f.column} and deleted_at is null))`
    )
    .join("");

  router.post("/:id/restore", requireInternalApiKey, async (req, res, next) => {
    try {
      const existing = await pool.query(`select * from ${tableName} where id = $1`, [req.params.id]);
      if (existing.rows.length === 0) throw notFound(resourceName, req.params.id);

      const current = existing.rows[0];
      if (current.deleted_at === null) throw notDeleted(resourceName, req.params.id);

      const referenceBody = {};
      for (const field of fields) {
        if ((field.references || field.listReferences) && current[field.column] !== null) {
          referenceBody[field.key] = current[field.column];
        }
      }
      await validateReferences(table, referenceBody, { partial: true });

      const actor = actorOf(req.body);
      const restored = await withAllocationLock(current[table.allocationRule?.groupColumn], async (db) => {
        await validateAllocation(
          db,
          table,
          Object.fromEntries(fields.map((f) => [f.column, current[f.column]])),
          req.params.id
        );
        const result = await db.query(
          `update ${tableName} set deleted_at = null, updated_by = $1
           where id = $2 and deleted_at is not null${liveParentsSql} returning *`,
          [actor, req.params.id]
        );
        return result.rows.length === 0 ? null : reselect(db, result.rows[0]);
      });
      if (restored === null) {
        // Either someone restored it first (409/404 below) or a parent was
        // deleted in the window since the check above (the re-check throws
        // the 422).
        const again = await pool.query(`select * from ${tableName} where id = $1`, [req.params.id]);
        if (again.rows.length === 0) throw notFound(resourceName, req.params.id);
        if (again.rows[0].deleted_at === null) throw notDeleted(resourceName, req.params.id);
        await validateReferences(table, referenceBody, { partial: true });
        throw notFound(resourceName, req.params.id);
      }
      res.json({ data: toResponse(table, restored) });
    } catch (err) {
      next(mapWriteError(err, fields, req.body));
    }
  });

  return router;
}
