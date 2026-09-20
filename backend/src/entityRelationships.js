// FEAT-12: derives the Entity Relationship page's data directly from
// MASTER_DATA_TABLES — the same descriptors that drive the real backend
// (masterDataRouter.js/masterDataSchema.js) — rather than hand-written
// prose that can drift out of sync with the schema. Every table that
// changes its `hasCode`/`identityField`/`fields`/`lookups` descriptor
// automatically changes what this endpoint (and the frontend page built
// on it) shows, with no separate edit required.
//
// Pure data transformation, no I/O — testable directly against a plain
// array, same reasoning as masterDataSchema.js's buildLookupPlan.

// A table's single source-of-truth identity field: either an
// auto-generated `code` (hasCode), a caller-supplied unique field
// (identityField, e.g. resources.employeeId), or none at all — a table
// like project_assignments has no single identifying field, only a
// composite of its FK/date fields.
function identityOf(table) {
  if (table.hasCode) return { type: "auto-generated", field: "code" };
  if (table.identityField) return { type: "caller-supplied-unique", field: table.identityField };
  return { type: "none" };
}

// Every enforced FK relationship this table declares (field.references),
// omitting fields with no `references` (e.g. modules.practiceId is
// deliberately unvalidated, so it's not a "relationship" in this sense).
function relationshipsOf(table) {
  return table.fields
    .filter((field) => field.references)
    .map((field) => ({
      field: field.key,
      referencesTable: field.references.table,
      referencesColumn: field.references.column,
    }));
}

// Every live-lookup this table exposes, including chained/transitive ones
// (lookup.via) — flattened to one entry per projected key so the page
// doesn't need to know masterDataSchema.js's internal alias scheme.
function lookupsOf(table) {
  const lookups = [];
  for (const lookup of table.lookups ?? []) {
    for (const projection of lookup.projections) {
      lookups.push({
        key: projection.key,
        sourceTable: lookup.table,
        // `via` names the earlier lookup this one chains through (e.g.
        // project_assignments' departments lookup chains via "teams") —
        // absent for a direct, single-hop lookup.
        via: lookup.via ?? null,
      });
    }
  }
  return lookups;
}

export function buildEntityRelationships(tables) {
  return tables.map((table) => ({
    route: table.route,
    tableName: table.tableName,
    resourceName: table.resourceName,
    identity: identityOf(table),
    relationships: relationshipsOf(table),
    lookups: lookupsOf(table),
  }));
}
