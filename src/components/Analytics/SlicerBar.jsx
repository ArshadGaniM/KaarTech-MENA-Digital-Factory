import PropTypes from 'prop-types';
import { NOT_SET } from '../../lib/analyticsData';
import ControlSelect from './Controls';
import styles from './Analytics.module.css';

const ALL = '';

// The slicers every chart on the tab follows. `slicers` lists each field and
// its values; an empty choice means "All". `children` holds extra controls,
// such as the month range.
function SlicerBar({ slicers, filters, onChange, onReset, matching, children }) {
  const active = slicers.filter((slicer) => filters[slicer.field] !== null && filters[slicer.field] !== undefined);
  return (
    <div className={styles.slicerBar} role="group" aria-label="Slicers">
      <div className={styles.slicerRow}>
        {slicers.map((slicer) => (
          <ControlSelect
            key={slicer.field}
            label={slicer.label}
            value={filters[slicer.field] ?? ALL}
            options={[{ value: ALL, label: 'All' }, ...slicer.values.map((value) => ({ value, label: value }))]}
            onChange={(value) => onChange(slicer.field, value === ALL ? null : value)}
          />
        ))}
        {children}
      </div>
      <div className={styles.slicerFoot}>
        <span className={styles.matching} role="status">
          {matching}
        </span>
        {active.map((slicer) => (
          <button key={slicer.field} type="button" className={styles.chip} onClick={() => onChange(slicer.field, null)}>
            {slicer.label}: {filters[slicer.field] === NOT_SET ? NOT_SET : filters[slicer.field]} ×
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
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  matching: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default SlicerBar;
