import { useState } from 'react';
import PropTypes from 'prop-types';
import Sidebar from '../Sidebar';
import TopBar from '../TopBar';
import MasterDataTable from '../MasterDataTable';
import DashboardPlaceholder from '../DashboardPlaceholder';
import { NAV_ITEMS } from '../../lib/navigation';
import styles from './AppShell.module.css';

// A hash that doesn't match any NAV_ITEMS entry (stale bookmark, typo'd
// link, a renamed table route) silently falls back to the first item —
// with the TopBar title now static ("Dashboard" for every section), that
// fallback would otherwise be undetectable. Warn so it shows up in the
// console instead of just quietly rendering the wrong table.
function resolveViewId(id) {
  const match = NAV_ITEMS.find((item) => item.id === id || item.hash === id);
  if (!match) {
    console.warn(`No dashboard section matches "${id}" — falling back to ${NAV_ITEMS[0].label}.`);
    return NAV_ITEMS[0].id;
  }
  return match.id;
}

function AppShell({ initialHash = '' }) {
  const [activeViewId, setActiveViewId] = useState(() => resolveViewId(initialHash));
  const activeItem = NAV_ITEMS.find((item) => item.id === activeViewId) ?? NAV_ITEMS[0];

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#shell-main-content">
        Skip to content
      </a>
      <Sidebar items={NAV_ITEMS} activeId={activeViewId} onSelect={setActiveViewId} />
      <div className={styles.workspace}>
        <TopBar title="Dashboard" />
        <main id="shell-main-content" className={styles.content} tabIndex={-1}>
          {activeItem.route ? (
            <MasterDataTable key={activeItem.id} route={activeItem.route} columns={activeItem.columns} />
          ) : (
            <DashboardPlaceholder key={activeItem.id} />
          )}
        </main>
      </div>
    </div>
  );
}

AppShell.propTypes = {
  initialHash: PropTypes.string,
};

export default AppShell;
