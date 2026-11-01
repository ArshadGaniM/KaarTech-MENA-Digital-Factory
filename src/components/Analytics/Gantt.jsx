import PropTypes from 'prop-types';
import { monthLabel, monthsFromTo, spanDays } from '../../lib/analyticsData';
import styles from './Analytics.module.css';

const MAX_TICKS = 120;

// Bars on one shared date axis. Each bar starts and ends where its dates do,
// measured from the earliest start to the latest end among the rows shown.
function Gantt({ rows }) {
  const first = rows.reduce((min, row) => (row.start < min ? row.start : min), rows[0].start);
  const last = rows.reduce((max, row) => (row.end > max ? row.end : max), rows[0].end);
  const total = spanDays(first, last);
  // A bad date years away would otherwise draw thousands of ticks.
  const allTicks = monthsFromTo(first.slice(0, 7), last.slice(0, 7)).slice(0, MAX_TICKS);
  // About twelve labels fit the track, so a long span labels every few months.
  const step = Math.ceil(allTicks.length / 12);
  const ticks = allTicks.filter((_, index) => index % step === 0);
  // A month's label sits where the month starts, or at the left edge for the first one.
  const tickLeft = (month) => ((spanDays(first, `${month}-01` < first ? first : `${month}-01`) - 1) / total) * 100;

  return (
    <div className={styles.ganttWrap}>
      <ol className={styles.ganttAxis} aria-hidden="true">
        {ticks.map((month) => (
          <li key={month} style={{ left: `${tickLeft(month)}%` }}>
            {monthLabel(month)}
          </li>
        ))}
      </ol>
      <ul className={styles.ganttRows}>
        {rows.map((row) => (
          <li key={row.key} className={styles.ganttRow}>
            <span className={styles.ganttLabel}>
              <strong>{row.label}</strong>
              <small>{row.sub}</small>
            </span>
            <span className={styles.ganttTrack}>
              <i
                className={styles.ganttBar}
                style={{ left: `${((spanDays(first, row.start) - 1) / total) * 100}%`, width: `${(spanDays(row.start, row.end) / total) * 100}%` }}
                title={`${row.start} to ${row.end}`}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

Gantt.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired, sub: PropTypes.string, start: PropTypes.string.isRequired, end: PropTypes.string.isRequired })
  ).isRequired,
};

export default Gantt;
