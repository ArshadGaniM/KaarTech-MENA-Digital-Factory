import { MASTER_DATA_TABLES } from './masterDataApi';

// Single registry both AppShell and Sidebar read from. "Dashboard" is a
// standalone first section with no master-data table behind it yet — its
// content is intentionally empty until that's defined. Every other item is
// one per master-data table, each carrying the route/columns MasterDataTable
// needs to render it directly. Adding a table is one entry in
// MASTER_DATA_TABLES, not a second nav mechanism.
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', hash: '#dashboard', route: null, columns: null },
  ...MASTER_DATA_TABLES.map((table) => ({
    id: table.route,
    label: table.label,
    hash: `#${table.route}`,
    route: table.route,
    columns: table.columns,
  })),
];

// Hashes that mean "render AppShell instead of the marketing page",
// derived from NAV_ITEMS so App.jsx and AppShell can't drift out of sync.
export const APP_SHELL_HASHES = NAV_ITEMS.map((item) => item.hash);
