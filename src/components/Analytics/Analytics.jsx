import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsPeople } from '../../hooks/useAnalyticsData';
import { useCrossFilters } from '../../hooks/useCrossFilters';
import { BUCKET_LABELS, allocationBucket, applyFilters, labelOf } from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import AllocationTab from './AllocationTab';
import SlicerBar from './SlicerBar';
import WorkforceTab from './WorkforceTab';
import styles from './Analytics.module.css';

const NO_FILTERS = {
  locationType: null,
  region: null,
  employmentType: null,
  designation: null,
  subDivision: null,
  geBatch: null,
  position: null,
  allocationBucket: null,
};

const SLICERS = {
  workforce: [
    { field: 'locationType', label: 'Location type' },
    { field: 'region', label: 'Region' },
    { field: 'employmentType', label: 'Employment type' },
    { field: 'designation', label: 'Designation' },
    { field: 'subDivision', label: 'Sub division' },
    { field: 'geBatch', label: 'GE batch' },
  ],
  allocation: [
    { field: 'locationType', label: 'Location type' },
    { field: 'region', label: 'Region' },
    { field: 'designation', label: 'Designation' },
    { field: 'position', label: 'Employee position' },
    { field: 'allocationBucket', label: 'Allocation' },
  ],
};

// The analytics tabs. The people slicers are kept here, so a pick on one tab
// is still there on the other.
function Analytics({ tab, refreshKey }) {
  const [retries, setRetries] = useState(0);
  const { data, error } = useAnalyticsPeople(refreshKey + retries);
  const { filters, toggle, set, clearAll } = useCrossFilters(NO_FILTERS);

  const people = useMemo(
    () => (data?.rows ?? []).map((row) => ({ ...row, allocationBucket: BUCKET_LABELS[allocationBucket(row.allocation)] })),
    [data]
  );

  if (!data) {
    return error ? (
      <p className={styles.error} role="alert">
        Could not load the workforce: {error.message}{' '}
        <button type="button" className={styles.linkButton} onClick={() => setRetries((count) => count + 1)}>
          Try again
        </button>
      </p>
    ) : (
      <p className={styles.status} role="status">
        Loading…
      </p>
    );
  }

  const slicers = SLICERS[tab].map((slicer) => ({
    ...slicer,
    values: [...new Set(people.map((row) => labelOf(row[slicer.field])))].sort(),
  }));
  const matching = applyFilters(people, filters).length;

  return (
    <div className={styles.page}>
      {error && (
        <p className={styles.error} role="alert">
          Could not refresh the workforce: {error.message}
        </p>
      )}
      <SlicerBar
        slicers={slicers}
        filters={filters}
        onChange={set}
        onReset={clearAll}
        matching={`${formatCount(matching)} of ${formatCount(people.length)} people`}
      />
      {tab === 'workforce' ? (
        <WorkforceTab people={people} filters={filters} onToggle={toggle} onSet={set} />
      ) : (
        <AllocationTab people={people} filters={filters} onToggle={toggle} refreshKey={refreshKey + retries} />
      )}
    </div>
  );
}

Analytics.propTypes = {
  tab: PropTypes.oneOf(['workforce', 'allocation']).isRequired,
  refreshKey: PropTypes.number.isRequired,
};

export default Analytics;
