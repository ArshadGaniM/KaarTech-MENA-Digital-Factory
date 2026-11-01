import PropTypes from 'prop-types';
import { monthChoices } from '../../lib/analyticsData';
import ControlSelect from './Controls';
import styles from './Analytics.module.css';

// The From, To and Focus month selects for a range from useMonthRange.
function MonthSlicers({ range }) {
  const options = monthChoices(range.base);
  return (
    <div className={styles.slicerBar} role="group" aria-label="Months">
      <div className={styles.slicerRow}>
        <ControlSelect label="From month" value={range.from} options={options} onChange={range.setFrom} />
        <ControlSelect label="To month" value={range.to} options={options} onChange={range.setTo} />
        <ControlSelect label="Focus month" value={range.focus} options={options.filter((option) => option.value >= range.from && option.value <= range.to)} onChange={range.setFocus} />
      </div>
    </div>
  );
}

MonthSlicers.propTypes = {
  range: PropTypes.shape({
    base: PropTypes.string.isRequired,
    from: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired,
    focus: PropTypes.string.isRequired,
    setFrom: PropTypes.func.isRequired,
    setTo: PropTypes.func.isRequired,
    setFocus: PropTypes.func.isRequired,
  }).isRequired,
};

export default MonthSlicers;
