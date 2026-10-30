import PropTypes from 'prop-types';
import { useTableCounts } from '../../hooks/useTableCounts';
import styles from './ControlCenter.module.css';

const numberFormat = new Intl.NumberFormat('en-US');

function tableStatus(table) {
  if (table.error !== null) return { key: 'error', label: 'Unreachable' };
  if (table.count === 0) return { key: 'empty', label: 'No records' };
  return { key: 'healthy', label: 'Healthy' };
}

function ControlCenter({ onNavigate }) {
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
        Could not load the control center: {error.message}
      </p>
    );
  }

  const rows = data.map((table) => ({ ...table, status: tableStatus(table) }));
  const countOf = (key) => rows.filter((row) => row.status.key === key).length;
  const totalRecords = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);

  const summary = [
    { label: 'Healthy tables', value: countOf('healthy') },
    { label: 'Tables with no records', value: countOf('empty') },
    { label: 'Unreachable tables', value: countOf('error') },
    { label: 'Total records', value: totalRecords },
  ];

  return (
    <div className={styles.controlCenter}>
      <section aria-labelledby="control-center-summary" className={styles.section}>
        <h2 id="control-center-summary" className={styles.sectionTitle}>
          Factory status
        </h2>
        <ul className={styles.tiles}>
          {summary.map((tile) => (
            <li key={tile.label} className={styles.tile}>
              <span className={styles.tileLabel}>{tile.label}</span>
              <span className={styles.tileValue}>{numberFormat.format(tile.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="control-center-tables" className={styles.section}>
        <h2 id="control-center-tables" className={styles.sectionTitle}>
          Master data
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col" className={styles.numeric}>
                Records
              </th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className={styles.srOnly}>Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.route}>
                <th scope="row">{row.label}</th>
                <td className={styles.numeric}>{row.count === null ? '—' : numberFormat.format(row.count)}</td>
                <td>
                  <span className={styles[`badge_${row.status.key}`]}>{row.status.label}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.openButton}
                    aria-label={`Open ${row.label}`}
                    onClick={() => onNavigate(row.route)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

ControlCenter.propTypes = {
  onNavigate: PropTypes.func.isRequired,
};

export default ControlCenter;
