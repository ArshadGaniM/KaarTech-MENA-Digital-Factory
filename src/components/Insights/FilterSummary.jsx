import PropTypes from 'prop-types';
import styles from './Insights.module.css';

// "N match", one removable chip per active filter, and Clear filters.
function FilterSummary({ matchingText, chips, onClearAll }) {
  return (
    <div className={styles.filterRow}>
      <p className={styles.matching} role="status" aria-live="polite">
        {matchingText}
      </p>
      {chips.map((chip) => (
        <button key={chip.key} type="button" className={styles.chip} onClick={chip.onRemove}>
          {`Remove filter ${chip.label}`}
        </button>
      ))}
      {chips.length > 0 && (
        <button type="button" className={styles.clear} onClick={onClearAll}>
          Clear filters
        </button>
      )}
    </div>
  );
}

FilterSummary.propTypes = {
  matchingText: PropTypes.string.isRequired,
  chips: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired, onRemove: PropTypes.func.isRequired })
  ).isRequired,
  onClearAll: PropTypes.func.isRequired,
};

export default FilterSummary;
