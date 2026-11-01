import PropTypes from 'prop-types';
import { formatCount } from '../../lib/formatCount';
import styles from './BarList.module.css';

// Ranked horizontal bars. A row with `onClick` is a button. `pressed` makes
// it a toggle (aria-pressed), and leaving `pressed` out makes it a plain
// link-style button. A row without `onClick` is static text, for a summary
// line such as "Other". The bar widths are relative to `max`.
function BarList({ rows, max }) {
  const scale = Math.max(1, max);
  return (
    <ul className={styles.bars}>
      {rows.map((row) => (
        <li key={row.key}>
          {row.onClick ? (
            <button
              type="button"
              className={styles.row}
              aria-pressed={row.pressed}
              disabled={row.disabled}
              onClick={row.onClick}
            >
              <span className={styles.label}>{row.label}</span>{' '}
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${(row.count / scale) * 100}%` }} />
              </span>{' '}
              <span className={styles.value}>{formatCount(row.count)}</span>
            </button>
          ) : (
            <div className={styles.staticRow}>
              <span className={styles.label}>{row.label}</span> <span className={styles.value}>{formatCount(row.count)}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

BarList.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      onClick: PropTypes.func,
      pressed: PropTypes.bool,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  max: PropTypes.number.isRequired,
};

export default BarList;
