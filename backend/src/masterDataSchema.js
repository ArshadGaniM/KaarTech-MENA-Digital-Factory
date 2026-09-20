import { pool } from "./db.js";
import { validationError } from "./errors.js";

const MAX_TEXT_LENGTH = 255;

// Builds the LEFT JOIN plan for a table's live-lookup fields (e.g.
// resource_cost.employeeName/employeeDesignation from resources.name/
// designation) — shared between the router's SELECT queries and
// toResponse's field mapping so their column aliasing never drifts apart.
// table.lookups comes only from the fixed masterDataTables.js descriptor,
// never from request input, so interpolating it into SQL is safe (same
// reasoning as tableName/column elsewhere in this codebase).
//
// A lookup normally joins directly off the base table (`table.tableName`).
// Setting `via: "<other lookup's table>"` instead joins off that earlier
// lookup's own alias — a chained/transitive lookup (e.g. Project
// Assignments -> Teams -> Departments: the Departments lookup's
// `localColumn` is a column on `teams`, not on `project_assignments`).
// The `via` target must be an earlier entry in `table.lookups` (single
// forward pass, no cycle detection needed since order is author-controlled).
function buildLookupPlan(table) {
  const withAlias = (table.lookups ?? []).map((lookup, index) => ({ ...lookup, alias: `lookup_${index}` }));
  return withAlias.map((lookup) => {
    if (!lookup.via) return { ...lookup, sourceAlias: table.tableName };
    const source = withAlias.find((l) => l.table === lookup.via);
    if (!source) {
      throw new Error(`${table.tableName}: lookup.via '${lookup.via}' has no earlier lookup entry for that table`);
    }
    return { ...lookup, sourceAlias: source.alias };
  });
}

export function lookupJoinSql(table) {
  return buildLookupPlan(table)
    .map(
      (lookup) =>
        `left join ${lookup.table} ${lookup.alias} ` +
        `on ${lookup.alias}.${lookup.foreignColumn} = ${lookup.sourceAlias}.${lookup.localColumn} ` +
        `and ${lookup.alias}.deleted_at is null`
    )
    .join(" ");
}

export function lookupSelectSql(table) {
  const columns = [];
  for (const lookup of buildLookupPlan(table)) {
    for (const projection of lookup.projections) {
      columns.push(`${lookup.alias}.${projection.column} as ${lookup.alias}_${projection.column}`);
    }
  }
  return columns;
}

export function toResponse(table, row) {
  const response = { id: row.id };
  if (table.hasCode) response.code = row.code;
  for (const field of table.fields) {
    response[field.key] = row[field.column];
  }
  // A lookup column is only present on rows the router's own SELECT
  // joined it into — a POST/PATCH's `returning *` never carries it, since
  // it selects only the base table. `?? null` treats that the same as a
  // join that matched nothing (soft-deleted or missing resource), rather
  // than leaking `undefined` into the JSON response either way.
  for (const lookup of buildLookupPlan(table)) {
    for (const projection of lookup.projections) {
      response[projection.key] = row[`${lookup.alias}_${projection.column}`] ?? null;
    }
  }
  response.createdBy = row.created_by;
  response.createdAt = row.created_at;
  response.updatedBy = row.updated_by;
  response.updatedAt = row.updated_at;
  // Derived from deleted_at (the actual soft-delete flag) rather than its
  // own stored column, so there's one source of truth for delete state —
  // a separate persisted Yes/No column could drift out of sync with it.
  response.markedDeleted = row.deleted_at != null ? "Yes" : "No";
  return response;
}

// Presence/must-validate semantics shared by validateBody and
// validateReferences: a required field is checked even when absent on
// create (so the "missing" case itself gets flagged); on update, and for
// any non-required field, it's only checked when the caller actually sent
// it. Object.hasOwn (not `!== undefined`) is the presence test throughout
// this codebase — see masterDataRouter.js's PATCH handler, which relies on
// the same distinction to tell "key absent" (keep current value) apart
// from "key present, set to null" (clear it).
function fieldPresenceToValidate(field, safeBody, partial) {
  const present = Object.hasOwn(safeBody, field.key);
  return { present, mustValidate: field.required ? !partial || present : present };
}

export function validateBody(table, body, { partial = false } = {}) {
  // express.json() leaves req.body undefined for a request sent without a
  // JSON content-type — treat that the same as an empty object rather than
  // throwing a raw TypeError that would surface as a misleading 500.
  const safeBody = body && typeof body === "object" ? body : {};
  const details = {};

  for (const field of table.fields) {
    const { mustValidate } = fieldPresenceToValidate(field, safeBody, partial);
    if (!mustValidate) continue;

    const value = safeBody[field.key];
    // A non-required field sent as null is an explicit "clear this" —
    // valid, not a type error. A required field can never be nulled.
    if (value === null && !field.required) continue;

    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        details[field.key] = `${field.key} must be a number.`;
      }
      continue;
    }

    if (field.type === "date") {
      // A plain ISO 8601 date/datetime string, stored in a `date` column —
      // Date.parse rejects garbage strings but accepts both "2026-01-01"
      // and a full timestamp, matching what a `date` column itself accepts.
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        details[field.key] = `${field.key} must be a valid date (ISO 8601 string).`;
      }
      continue;
    }

    const maxLength = field.maxLength ?? MAX_TEXT_LENGTH;
    if (typeof value !== "string" || value.trim().length === 0) {
      details[field.key] = field.required
        ? `${field.key} is required and must be a non-empty string.`
        : `${field.key} must be a non-empty string.`;
    } else if (value.length > maxLength) {
      details[field.key] = `${field.key} must be ${maxLength} characters or fewer.`;
    } else if (field.type === "enum" && !field.values.includes(value)) {
      details[field.key] = `${field.key} must be one of: ${field.values.join(", ")}.`;
    }
  }

  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}

// Enforces any field-level `references` descriptor (e.g. resource_cost's
// employeeId must exist in resources) — unlike modules.practiceId, which
// is deliberately left unvalidated. Must run after validateBody so a
// non-number/absent-when-required value has already been rejected with a
// clear message rather than surfacing as a confusing "no matching row".
export async function validateReferences(table, body, { partial = false } = {}) {
  const safeBody = body && typeof body === "object" ? body : {};

  const fieldsToCheck = table.fields.filter((field) => {
    if (!field.references) return false;
    const { mustValidate } = fieldPresenceToValidate(field, safeBody, partial);
    // null only reaches a check for a non-required field being explicitly
    // cleared — validateBody already rejects null on a required field.
    return mustValidate && safeBody[field.key] !== null;
  });

  // Run every FK-existence check concurrently rather than one round trip
  // per field in sequence — resource_cost only has one `references` field
  // today, but a table with two (e.g. a future Project Assignments row
  // validating both a project and a team) shouldn't pay for them one at a
  // time.
  const results = await Promise.all(
    fieldsToCheck.map(async (field) => {
      const value = safeBody[field.key];
      const { table: refTable, column: refColumn } = field.references;
      const result = await pool.query(
        `select 1 from ${refTable} where ${refColumn} = $1 and deleted_at is null limit 1`,
        [value]
      );
      return { field, value, found: result.rows.length > 0 };
    })
  );

  const details = {};
  for (const { field, value, found } of results) {
    if (!found) {
      details[field.key] = `${field.key} must reference an existing ${field.references.table} row (no match for '${value}').`;
    }
  }

  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}

// Enforces any table-level `crossFieldValidations` entry (e.g. Project
// Assignments' projectAssignmentEndDate must not be earlier than
// projectAssignmentStartDate) — a rule spanning two fields at once, unlike
// validateBody's per-field checks. `current` is the existing row (already
// snake_case DB columns) for a PATCH, so a partial update that only sends
// one of the two dates is still checked against the other's real,
// currently-stored value rather than skipped. Must run after validateBody
// (so a malformed date has already been rejected with a clear per-field
// message) and, for PATCH, after the existing row has been fetched.
export function validateCrossFields(table, body, { current = null } = {}) {
  const safeBody = body && typeof body === "object" ? body : {};
  const details = {};

  for (const rule of table.crossFieldValidations ?? []) {
    if (rule.type !== "dateRange") continue;

    const startField = table.fields.find((f) => f.key === rule.startKey);
    const endField = table.fields.find((f) => f.key === rule.endKey);
    const startValue = Object.hasOwn(safeBody, rule.startKey) ? safeBody[rule.startKey] : current?.[startField.column];
    const endValue = Object.hasOwn(safeBody, rule.endKey) ? safeBody[rule.endKey] : current?.[endField.column];

    // Nothing to compare yet (e.g. a POST missing a required date — already
    // flagged by validateBody's own required check) or neither date is
    // changing on this PATCH.
    if (startValue == null || endValue == null) continue;

    if (new Date(endValue) < new Date(startValue)) {
      details[rule.endKey] = rule.message;
    }
  }

  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}

// updatedBy is caller-supplied free text on every write (see
// masterDataRouter.js) but isn't part of any table's `fields` list, so it
// needs its own length guard rather than piggybacking on validateBody.
export function validateActor(actor) {
  if (actor.length > MAX_TEXT_LENGTH) {
    throw validationError({ updatedBy: `updatedBy must be ${MAX_TEXT_LENGTH} characters or fewer.` });
  }
}
