import PropTypes from 'prop-types';
import BarList from '../BarList';
import DonutChart from '../DonutChart';
import { FilterSummary, InsightCard, InsightNote, InsightPanel } from '../Insights';
import { useAllocationSummary } from '../../hooks/useAllocationSummary';
import { useCrossFilters } from '../../hooks/useCrossFilters';
import { ALLOCATION_MAX_POSITIONS } from '../../lib/allocationApi';
import { formatCount } from '../../lib/formatCount';

const TOP_POSITIONS = 10;
const NO_FILTERS = { bucket: null, position: null };

// A resource's total allocation is the sum of its live deployment
// percentages: fully allocated is exactly 100, partly is above 0 and below
// 100, not deployed is no live deployment. Over-allocated is above 100,
// which the allocation rule should make impossible, so it only appears if
// the data ever breaks that rule.
const BUCKET_INFO = {
  full: { label: 'Fully allocated', colorVar: '--color-allocation-full' },
  partial: { label: 'Partly allocated', colorVar: '--color-allocation-partial' },
  none: { label: 'Not deployed', colorVar: '--color-allocation-none' },
  over: { label: 'Over-allocated', colorVar: '--color-allocation-over' },
};

// The donut is narrowed by the position picked and the position bars by the
// allocation picked, never by their own pick, so every slice and bar stays
// visible and can be switched.
function AllocationInsights({ refreshKey, onNavigate }) {
  const { filters, toggle, clear, clearAll, retries, retry } = useCrossFilters(NO_FILTERS);
  // Both only ever increase, so their sum changes on every retry or refresh.
  const { data, isLoading, error } = useAllocationSummary(filters, refreshKey + retries);

  const chips = [
    ...(filters.bucket !== null ? [{ key: 'bucket', label: BUCKET_INFO[filters.bucket].label, onRemove: () => clear('bucket') }] : []),
    ...(filters.position !== null ? [{ key: 'position', label: filters.position, onRemove: () => clear('position') }] : []),
  ];

  // The hook keeps the previous result while a new one loads, so the count
  // waits until the result is for the current filters.
  let matchingText = 'Loading…';
  if (error) matchingText = 'Match count unavailable';
  else if (data && !isLoading) {
    const matching =
      filters.bucket !== null
        ? (data.buckets.find((bucket) => bucket.key === filters.bucket)?.count ?? 0)
        : data.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    matchingText = `${formatCount(matching)} resources match`;
  }

  const segments = (data?.buckets ?? [])
    .filter((bucket) => bucket.key !== 'over' || bucket.count > 0 || filters.bucket === 'over')
    .map((bucket) => ({
      key: bucket.key,
      label: BUCKET_INFO[bucket.key].label,
      count: bucket.count,
      colorVar: BUCKET_INFO[bucket.key].colorVar,
      selectable: bucket.count > 0 || filters.bucket === bucket.key,
    }));
  const allPositions = data?.positions ?? [];
  const positions = allPositions.slice(0, TOP_POSITIONS);
  const positionCount = allPositions.length >= ALLOCATION_MAX_POSITIONS ? `${ALLOCATION_MAX_POSITIONS}+` : allPositions.length;
  const maxCount = Math.max(1, ...positions.map((position) => position.count));

  return (
    <InsightPanel
      id="allocation-insights"
      title="Allocation"
      linkLabel="Open Resource Deployment table"
      onLink={() => onNavigate('resource-deployment')}
      summary={<FilterSummary matchingText={matchingText} chips={chips} onClearAll={clearAll} />}
    >
      <InsightCard
        title="How fully people are deployed"
        error={error}
        errorLabel="Could not load the allocation"
        hasData={data !== null}
        isLoading={isLoading}
        onRetry={retry}
      >
        {data && (
          <DonutChart segments={segments} selectedKey={filters.bucket} onSelect={(key) => toggle('bucket', key)} centerLabel="resources" />
        )}
      </InsightCard>

      <InsightCard
        title="Positions people are deployed to"
        error={error}
        errorLabel="Could not load the positions"
        hasData={data !== null}
        isLoading={isLoading}
        onRetry={retry}
      >
        {positions.length === 0 ? (
          <InsightNote>
            {filters.bucket === 'none' ? 'People who are not deployed have no position.' : 'No deployments match.'}
          </InsightNote>
        ) : (
          <>
            <BarList
              max={maxCount}
              rows={positions.map((position) => ({
                key: position.value,
                label: position.value,
                count: position.count,
                pressed: filters.position === position.value,
                onClick: () => toggle('position', position.value),
              }))}
            />
            {allPositions.length > TOP_POSITIONS && (
              <InsightNote>{`Showing the top ${TOP_POSITIONS} of ${positionCount} positions.`}</InsightNote>
            )}
          </>
        )}
      </InsightCard>
    </InsightPanel>
  );
}

AllocationInsights.propTypes = {
  refreshKey: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default AllocationInsights;
