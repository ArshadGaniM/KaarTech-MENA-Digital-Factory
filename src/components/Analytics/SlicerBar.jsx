import PropTypes from 'prop-types';
import ControlSelect from './Controls';
import styles from './Analytics.module.css';

const ALL = '';

// A picked value that is no longer among the options (data changed since) stays
// in the list, so the drop-down shows the active pick instead of "All".
const withCurrent = (values, current) => (current && !values.includes(current) ? [...values, current] : values);

// The slicers every chart on the tab follows. `slicers` lists each field and
// its values; an empty choice means "All". `children` holds extra controls,
// such as the month range.
function SlicerBar({ slicers, filters, labels, onChange, onReset, matching, children }) {
  // Every active pick gets a chip, including one made on another tab, so a
  // narrowed chart always has a visible cause and a way to clear it.
  const active = Object.keys(filters).filter((field) => filters[field] !== null && filters[field] !== undefined);
  return (
    <div className={styles.slicerBar} role="group" aria-label="Slicers">
      <div className={styles.slicerRow}>
        {slicers.map((slicer) => (
          <ControlSelect
            key={slicer.field}
            label={slicer.label}
            value={filters[slicer.field] ?? ALL}
            options={[{ value: ALL, label: 'All' }, ...withCurrent(slicer.values, filters[slicer.field]).map((value) => ({ value, label: value }))]}
            onChange={(value) => onChange(slicer.field, value === ALL ? null : value)}
          />
        ))}
        {children}
      </div>
      <div className={styles.slicerFoot}>
        <span className={styles.matching} role="status">
          {matching}
        </span>
        {active.map((field) => (
          <button key={field} type="button" className={styles.chip} onClick={() => onChange(field, null)}>
            {labels[field] ?? field}: {filters[field]} ×
          </button>
        ))}
        <button type="button" className={styles.linkButton} disabled={active.length === 0} onClick={onReset}>
          Reset slicers
        </button>
      </div>
    </div>
  );
}

SlicerBar.propTypes = {
  slicers: PropTypes.arrayOf(
    PropTypes.shape({ field: PropTypes.string.isRequired, label: PropTypes.string.isRequired, values: PropTypes.arrayOf(PropTypes.string).isRequired })
  ).isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  labels: PropTypes.objectOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  matching: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default SlicerBar;
