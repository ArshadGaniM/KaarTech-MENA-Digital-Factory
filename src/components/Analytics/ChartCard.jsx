import { useState } from 'react';
import PropTypes from 'prop-types';
import { toCsv } from '../../lib/analyticsData';
import DataTable from './DataTable';
import styles from './Analytics.module.css';

function downloadCsv(name, columns, rows) {
  const url = URL.createObjectURL(new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// One visual: a title, its own slicers (`controls`), the chart and the same
// numbers as a table. The table is the text version of the chart, and the
// CSV button downloads it.
function ChartCard({ title, controls, columns, rows, wide = false, tableOnly = false, summary, children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`${styles.card} ${wide ? styles.wide : ''}`} aria-label={title}>
      <header className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <div className={styles.cardActions}>
          {!tableOnly && (
            <button type="button" className={styles.linkButton} aria-pressed={showTable} onClick={() => setShowTable((shown) => !shown)}>
              {showTable ? 'Show chart' : 'Show table'}
            </button>
          )}
          <button type="button" className={styles.linkButton} disabled={rows.length === 0} onClick={() => downloadCsv(title, columns, rows)}>
            Download CSV
          </button>
        </div>
      </header>
      {controls && <div className={styles.controls}>{controls}</div>}
      {summary && <p className={styles.summary}>{summary}</p>}
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing to show for the current slicers.</p>
      ) : showTable || tableOnly ? (
        <DataTable title={title} columns={columns} rows={rows} />
      ) : (
        <div className={styles.chartBody}>{children}</div>
      )}
    </section>
  );
}

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  controls: PropTypes.node,
  columns: PropTypes.arrayOf(PropTypes.string).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  wide: PropTypes.bool,
  tableOnly: PropTypes.bool,
  summary: PropTypes.string,
  children: PropTypes.node,
};

export default ChartCard;
