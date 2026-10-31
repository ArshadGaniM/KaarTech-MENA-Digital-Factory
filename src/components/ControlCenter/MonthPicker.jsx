import PropTypes from 'prop-types';
import { formatMonth, shiftMonth } from '../../lib/months';
import styles from './ControlCenter.module.css';

function MonthPicker({ month, onChange }) {
  return (
    <div className={styles.monthPicker} role="group" aria-label="Month">
      <button type="button" className={styles.monthStep} aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <label className={styles.monthLabel}>
        <span className={styles.srOnly}>Month</span>
        <input
          type="month"
          className={styles.monthInput}
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label={`Month, ${formatMonth(month)}`}
        />
      </label>
      <button type="button" className={styles.monthStep} aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  );
}

MonthPicker.propTypes = {
  month: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MonthPicker;
