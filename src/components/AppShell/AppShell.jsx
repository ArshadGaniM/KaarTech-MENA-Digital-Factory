import { useState } from 'react';
import PropTypes from 'prop-types';
import Sidebar from '../Sidebar';
import TopBar from '../TopBar';
import MasterDataTable from '../MasterDataTable';
import { NAV_ITEMS } from '../../lib/navigation';
import styles from './AppShell.module.css';

function resolveInitialViewId(initialHash) {
  const match = NAV_ITEMS.find((item) => item.hash === initialHash);
  return (match ?? NAV_ITEMS[0]).id;
}

function AppShell({ initialHash = '' }) {
  const [activeViewId, setActiveViewId] = useState(() => resolveInitialViewId(initialHash));
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
          <MasterDataTable route={activeItem.route} columns={activeItem.columns} />
        </main>
      </div>
    </div>
  );
}

AppShell.propTypes = {
  initialHash: PropTypes.string,
};

export default AppShell;
