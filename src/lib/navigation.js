import MasterDataView from '../components/MasterDataView';

// Single registry both AppShell and Sidebar read from — adding a second
// internal module is one entry here, not a new nav mechanism.
export const NAV_ITEMS = [
  { id: 'master-data', label: 'Master Data', hash: '#master-data', component: MasterDataView },
];

// Hashes that mean "render AppShell instead of the marketing page",
// derived from NAV_ITEMS so App.jsx and AppShell can't drift out of sync.
export const APP_SHELL_HASHES = NAV_ITEMS.map((item) => item.hash);
