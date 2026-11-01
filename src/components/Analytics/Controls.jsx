import PropTypes from 'prop-types';
import styles from './Analytics.module.css';

// A small labelled drop-down used for the slicers inside a chart card and for
// the global slicer bar. `options` are plain strings or { value, label }.
function ControlSelect({ label, value, options, onChange }) {
  return (
    <label className={styles.control}>
      <span className={styles.controlLabel}>{label}</span>
      <select className={styles.select} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

ControlSelect.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired })])
  ).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ControlSelect;
