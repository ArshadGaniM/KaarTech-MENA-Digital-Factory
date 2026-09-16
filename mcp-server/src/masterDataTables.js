// Mirrors backend/src/masterDataTables.js — kept as a separate copy because
// this package has no workspace link to the backend, but the two lists must
// stay in sync. slug is the tool-name suffix (add_<slug>, update_<slug>,
// delete_<slug>); route matches the backend's REST path segment.
//
// fields describes each table's own business columns (beyond name), used
// to build each add_/update_ tool's zod input shape. Same shape as the
// backend's field list: key (camelCase JSON field), label (for the tool
// description), and for enum fields, values.
export const MASTER_DATA_TABLES = [
  {
    slug: "practice",
    route: "practices",
    label: "Practice",
    hasCode: true,
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "delivery_center",
    route: "delivery-centers",
    label: "Delivery Center",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      {
        key: "locationType",
        label: "onshore/offshore classification",
        required: true,
        type: "enum",
        values: ["onshore", "offshore"],
      },
      { key: "city", label: "city", required: true, type: "string" },
      { key: "country", label: "country", required: true, type: "string" },
    ],
  },
  {
    slug: "competency",
    route: "competencies",
    label: "Competency",
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "module",
    route: "modules",
    label: "Module",
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "resource",
    route: "resources",
    label: "Resource",
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "department",
    route: "departments",
    label: "Department",
    hasCode: true,
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
];
