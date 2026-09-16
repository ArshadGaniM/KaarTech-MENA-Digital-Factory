import { useState } from 'react';
import MasterDataTable from '../MasterDataTable';
import { MASTER_DATA_TABLES } from '../../lib/masterDataApi';
import styles from './MasterDataView.module.css';

function MasterDataView() {
  const [activeRoute, setActiveRoute] = useState(MASTER_DATA_TABLES[0].route);

  return (
    <section className={styles.section} id="master-data">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>MASTER DATA</p>
        <h2>Factory master data</h2>
        <p className={styles.subhead}>
          Read-only view of the shared master data tables. Records are added, modified, and
          marked deleted through the master-data MCP server.
        </p>

        <div className={styles.tabs} role="tablist" aria-label="Master data tables">
          {MASTER_DATA_TABLES.map((table) => (
            <button
              key={table.route}
              type="button"
              role="tab"
              aria-selected={table.route === activeRoute}
              className={table.route === activeRoute ? styles.tabActive : styles.tab}
              onClick={() => setActiveRoute(table.route)}
            >
              {table.label}
            </button>
          ))}
        </div>

        <div className={styles.tableWrap}>
          <MasterDataTable route={activeRoute} />
        </div>
      </div>
    </section>
  );
}

export default MasterDataView;
