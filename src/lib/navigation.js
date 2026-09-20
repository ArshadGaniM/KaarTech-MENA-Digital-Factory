import { MASTER_DATA_TABLES } from './masterDataApi';

// Single registry both AppShell and Sidebar read from. "Dashboard" is a
// standalone first section with no master-data table behind it yet — its
// content is intentionally empty until that's defined. Every master-data
// table is one entry, each carrying the route/columns MasterDataTable
// needs to render it directly. "Entity Relationship" (FEAT-12) is the
// second non-table section, appended LAST rather than inserted after
// Dashboard, so it never shifts the index of any real master-data table —
// AppShell.test.jsx destructures NAV_ITEMS by position and relies on
// NAV_ITEMS[1]/[2] being the first two actual tables. `kind` is what
// AppShell branches on to decide which component to render.
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', hash: '#dashboard', route: null, columns: null, kind: 'dashboard' },
  ...MASTER_DATA_TABLES.map((table) => ({
    id: table.route,
    label: table.label,
    hash: `#${table.route}`,
    route: table.route,
    columns: table.columns,
    kind: 'table',
  })),
  {
    id: 'entity-relationship',
    label: 'Entity Relationship',
    hash: '#entity-relationship',
    route: null,
    columns: null,
    kind: 'entity-relationship',
  },
];

// Hashes that mean "render AppShell instead of the marketing page",
// derived from NAV_ITEMS so App.jsx and AppShell can't drift out of sync.
export const APP_SHELL_HASHES = NAV_ITEMS.map((item) => item.hash);
