import PropTypes from 'prop-types';
import { useTableCounts } from '../../hooks/useTableCounts';
import styles from './Dashboard.module.css';

// The four tables that describe the factory's people, work and footprint.
const FEATURED_ROUTES = ['resources', 'projects', 'teams', 'delivery-centers'];

const numberFormat = new Intl.NumberFormat('en-US');

function formatCount(count) {
  return count === null ? '—' : numberFormat.format(count);
}

function Dashboard({ onNavigate }) {
  const { data, isLoading, error } = useTableCounts();

  if (isLoading) {
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
        Could not load counts for any table. Check that the backend is running.
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
        <h2 id="dashboard-overview" className={styles.sectionTitle}>
          Overview
        </h2>
        <ul className={styles.tiles}>
          {featured.map((table) => (
            <li key={table.route}>
              <button type="button" className={styles.tile} onClick={() => onNavigate(table.route)}>
                <span className={styles.tileLabel}>{table.label}</span>
                <span className={styles.tileValue}>{formatCount(table.count)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

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
