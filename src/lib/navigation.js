import { MASTER_DATA_TABLES } from './masterDataApi';

// Single registry both AppShell and Sidebar read from. Control Center and
// Dashboard come first and have no master-data table behind them; each
// master-data table is one entry carrying the route/columns MasterDataTable
// needs; Entity Relationship (FEAT-12) comes last. Tests destructure this
// list by position, so reordering it means updating them. `kind` is what
// AppShell branches on to decide which component to render.
export const DASHBOARD_HASH = '#dashboard';

export const NAV_ITEMS = [
  {
    id: 'control-center',
    label: 'Control Center',
    hash: '#control-center',
    route: null,
    columns: null,
    kind: 'control-center',
  },
  { id: 'dashboard', label: 'Dashboard', hash: DASHBOARD_HASH, route: null, columns: null, kind: 'dashboard' },
  ...MASTER_DATA_TABLES.map((table) => ({
    id: table.route,
    label: table.label,
    hash: `#${table.route}`,
    route: table.route,
    columns: table.columns,
    singularLabel: table.singularLabel,
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
