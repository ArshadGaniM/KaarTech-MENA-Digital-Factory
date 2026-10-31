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
    // pg returns a `numeric` column as a string; the UI needs a real number to total.
    response[field.key] =
      field.numeric && row[field.column] != null ? Number(row[field.column]) : row[field.column];
  }
  if (table.allocationRule) {
    // Only present on rows from the router's own SELECT (see allocationSelectSql).
    response.employeeTotalAllocation =
      row.employee_total_allocation != null ? Number(row.employee_total_allocation) : null;
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
      } else if (field.integer && !Number.isInteger(value)) {
        details[field.key] = `${field.key} must be a whole number.`;
      } else if (field.min !== undefined && value < field.min) {
        details[field.key] = `${field.key} must be at least ${field.min}.`;
      } else if (field.max !== undefined && value > field.max) {
        details[field.key] = `${field.key} must be at most ${field.max}.`;
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
// A comma-separated list field as the names it holds: trimmed, blanks dropped.
export function splitList(value) {
  return typeof value === "string" ? value.split(",").map((n) => n.trim()).filter(Boolean) : [];
}

export async function validateReferences(table, body, { partial = false } = {}) {
  const safeBody = body && typeof body === "object" ? body : {};

  const fieldsToCheck = table.fields.filter((field) => {
    if (!field.references && !field.listReferences) return false;
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
      if (field.listReferences) {
        const { table: refTable, column: refColumn } = field.listReferences;
        const names = splitList(value);
        if (names.length === 0) return { field, value, missing: [], empty: true };
        const result = names.length
          ? await pool.query(
              `select ${refColumn} as name from ${refTable} where ${refColumn} = any($1::text[]) and deleted_at is null`,
              [names]
            )
          : { rows: [] };
        const known = new Set(result.rows.map((row) => row.name));
        return { field, value, missing: names.filter((name) => !known.has(name)) };
      }
      const { table: refTable, column: refColumn } = field.references;
      const result = await pool.query(
        `select 1 from ${refTable} where ${refColumn} = $1 and deleted_at is null limit 1`,
        [value]
      );
      return { field, value, found: result.rows.length > 0 };
    })
  );

  const details = {};
  for (const { field, value, found, missing, empty } of results) {
    if (field.listReferences) {
      if (empty) {
        details[field.key] = `${field.key} must list at least one name from ${field.listReferences.table}.`;
      } else if (missing.length > 0) {
        details[field.key] = `${field.key} must be a comma-separated list of existing ${field.listReferences.table} (no match for: ${missing.join(", ")}).`;
      }
    } else if (!found) {
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

// A resource's allocation total across all of its live rows, selected next to
// each row so the table can show when a resource is short of the target.
export function allocationSelectSql(table) {
  const rule = table.allocationRule;
  if (!rule) return [];
  return [
    `(select coalesce(sum(a.${rule.valueColumn}), 0) from ${table.tableName} a where a.${rule.groupColumn} = ${table.tableName}.${rule.groupColumn} and a.deleted_at is null) as employee_total_allocation`,
  ];
}

// Rejects a row that would push its group (resource) past the rule's total,
// or repeat a unique value (position) within the group. `candidate` is keyed
// by column name; `excludeId` is the row being edited so it isn't counted
// against itself. Soft-deleted rows never count.
export async function validateAllocation(pool, table, candidate, excludeId = null) {
  const rule = table.allocationRule;
  if (!rule) return;
  const { rows } = await pool.query(
    `select ${rule.uniqueColumn} as unique_value, ${rule.valueColumn} as value
     from ${table.tableName}
     where ${rule.groupColumn} = $1 and deleted_at is null and ($2::uuid is null or id <> $2::uuid)`,
    [candidate[rule.groupColumn], excludeId]
  );
  const details = {};
  if (rows.some((row) => row.unique_value === candidate[rule.uniqueColumn])) {
    details[rule.uniqueKey] = `${rule.groupKey} ${candidate[rule.groupColumn]} is already allocated to ${candidate[rule.uniqueColumn]}; edit that row instead of adding another.`;
  }
  // Postgres stores the value at 2 decimals, so compare what will be stored.
  const cents = (n) => Math.round(Number(n) * 100);
  const others = rows.reduce((sum, row) => sum + cents(row.value), 0) / 100;
  const resulting = (cents(others) + cents(candidate[rule.valueColumn])) / 100;
  if (resulting > rule.total) {
    const remaining = Math.max(0, (cents(rule.total) - cents(others)) / 100);
    details[rule.valueKey] = `Allocations for ${rule.groupKey} ${candidate[rule.groupColumn]} cannot exceed ${rule.total}%: ${others}% is already allocated, so at most ${remaining}% remains.`;
  }
  if (Object.keys(details).length > 0) throw validationError(details);
}

// Rewrites a list field to its canonical form ("MM,SRM, MM" -> "MM, SRM") so
// the same set is always stored and shown the same way. A value with no names
// in it is left alone for validateReferences to reject.
export function normalizeLists(table, body) {
  if (!body || typeof body !== "object") return;
  for (const field of table.fields) {
    if (!field.listReferences || typeof body[field.key] !== "string") continue;
    const names = [...new Set(splitList(body[field.key]))];
    if (names.length > 0) body[field.key] = names.join(", ");
  }
}

// FEAT-24: the text every cell of a row would show — business code, id, each
// stored field, each live lookup column and the audit names — joined into one
// string so a single search term can match any cell. Identifiers come only
// from the fixed table descriptor; the term itself is always a bound parameter.
function searchableTextSql(table) {
  const t = table.tableName;
  const parts = [`${t}.id::text`];
  if (table.hasCode) parts.push(`${t}.code`);
  for (const field of table.fields) parts.push(`${t}.${field.column}::text`);
  for (const lookup of buildLookupPlan(table)) {
    for (const projection of lookup.projections) parts.push(`${lookup.alias}.${projection.column}::text`);
  }
  parts.push(`${t}.created_by`, `${t}.updated_by`);
  return `concat_ws(' ', ${parts.join(", ")})`;
}

// A term shorter than this only matches as plain text: trigram similarity on a
// couple of letters matches almost everything.
const MIN_FUZZY_LENGTH = 4;
const FUZZY_THRESHOLD = 0.55;

// The SQL that filters and ranks rows for a search term bound at `$param`.
// A row matches if the term appears in it as text (any case), or — for a term
// long enough to be meaningful — if some word in it is a near miss
// (pg_trgm word similarity), so "Nithyasri" still finds "Nithyashri S".
// Exact hits rank before near misses. Returns null for an empty term.
export function searchSql(table, param) {
  const text = searchableTextSql(table);
  const exact = `position(lower($${param}) in lower(${text})) > 0`;
  const fuzzy = `(char_length($${param}) >= ${MIN_FUZZY_LENGTH} and public.word_similarity($${param}, ${text}) >= ${FUZZY_THRESHOLD})`;
  return {
    where: `(${exact} or ${fuzzy})`,
    rank: `(case when ${exact} then 0 else 1 end), public.word_similarity($${param}, ${text}) desc`,
  };
}

// The search term from a request, trimmed and capped — null when there is none.
export function searchTermOf(query) {
  const raw = typeof query?.q === "string" ? query.q.trim().slice(0, 100) : "";
  return raw === "" ? null : raw;
}
