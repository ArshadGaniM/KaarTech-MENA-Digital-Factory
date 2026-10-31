import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import AnimatedNumber from '../AnimatedNumber';
import ResourceInsights from '../ResourceInsights';
import { useTableCounts } from '../../hooks/useTableCounts';
import { formatCount } from '../../lib/formatCount';
import styles from './Dashboard.module.css';

// The four tables that describe the factory's people, work and footprint.
const FEATURED_ROUTES = ['resources', 'projects', 'teams', 'delivery-centers'];

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function Dashboard({ onNavigate }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useTableCounts(refreshKey);
  // A new timestamp each time fresh counts arrive, not on every render.
  const updatedAt = useMemo(() => (data ? timeFormat.format(new Date()) : null), [data]);

  // Only the very first load replaces the page. A refresh keeps the current
  // numbers on screen until the new ones arrive.
  if (isLoading && !data) {
    return (
      <p className={styles.status} role="status" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className={styles.statusError} role="alert">
        Could not load the dashboard: {error.message}
      </p>
    );
  }

  const failed = data.filter((table) => table.error !== null);
  const loaded = data.filter((table) => table.error === null);
  if (loaded.length === 0) {
    return (
      <p className={styles.statusError} role="alert">
        Could not load counts for any table. Check that the backend is running and up to date.
      </p>
    );
  }

  const featured = FEATURED_ROUTES.map((route) => data.find((table) => table.route === route));
  const ranked = [...loaded].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...loaded.map((table) => table.count));
  const empty = loaded.filter((table) => table.count === 0);
  const totalRecords = loaded.reduce((sum, table) => sum + table.count, 0);

  return (
    <div className={styles.dashboard}>
      {failed.length > 0 && (
        <p className={styles.statusError} role="alert">
          Could not load counts for: {failed.map((table) => table.label).join(', ')}.
        </p>
      )}

      <section aria-labelledby="dashboard-overview" className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 id="dashboard-overview" className={styles.sectionTitle}>
            Overview
          </h2>
          <div className={styles.refresh}>
            <span className={styles.updated}>Updated {updatedAt}</span>
            <button
              type="button"
              className={styles.refreshButton}
              disabled={isLoading}
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <ul className={styles.tiles}>
          {featured.map((table) => (
            <li key={table.route}>
              <button type="button" className={styles.tile} onClick={() => onNavigate(table.route)}>
                <span className={styles.tileLabel}>{table.label}</span>
                <span className={styles.tileValue}>
                  <AnimatedNumber value={table.count} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ResourceInsights refreshKey={refreshKey} onNavigate={onNavigate} />

      <div className={styles.panels}>
        <section aria-labelledby="dashboard-records" className={styles.panel}>
          <h2 id="dashboard-records" className={styles.sectionTitle}>
            Records by table
          </h2>
          <p className={styles.panelMeta}>{formatCount(totalRecords)} active records across {loaded.length} tables</p>
          <ul className={styles.bars}>
            {ranked.map((table) => (
              <li key={table.route}>
                <button type="button" className={styles.barRow} onClick={() => onNavigate(table.route)}>
                  <span className={styles.barLabel}>{table.label}</span>
                  <span className={styles.barTrack} aria-hidden="true">
                    <span className={styles.barFill} style={{ width: `${(table.count / maxCount) * 100}%` }} />
                  </span>
                  <span className={styles.barValue}>{formatCount(table.count)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dashboard-needs-data" className={styles.panel}>
          <h2 id="dashboard-needs-data" className={styles.sectionTitle}>
            Needs data
          </h2>
          {empty.length === 0 ? (
            <p className={styles.panelMeta}>
              {failed.length > 0
                ? 'No empty tables among those that loaded.'
                : 'Every table has at least one record.'}
            </p>
          ) : (
            <>
              <p className={styles.panelMeta}>These tables have no records yet.</p>
              <ul className={styles.emptyList}>
                {empty.map((table) => (
                  <li key={table.route}>
                    <button type="button" className={styles.emptyLink} onClick={() => onNavigate(table.route)}>
                      {table.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

Dashboard.propTypes = {
  onNavigate: PropTypes.func.isRequired,
};

export default Dashboard;
