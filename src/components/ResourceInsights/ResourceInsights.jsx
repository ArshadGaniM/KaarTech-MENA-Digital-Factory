import { useState } from 'react';
import PropTypes from 'prop-types';
import BarList from '../BarList';
import DonutChart from '../DonutChart';
import { FilterSummary, InsightCard, InsightPanel } from '../Insights';
import { useGroupSummary } from '../../hooks/useGroupSummary';
import { formatCount } from '../../lib/formatCount';
import styles from './ResourceInsights.module.css';

const TOP_DESIGNATIONS = 8;
const NOT_SET_KEY = '__not-set';
const NO_FILTERS = { locationType: null, designation: null };

const keyOf = (value) => value ?? NOT_SET_KEY;
const labelOf = (value) => value ?? 'Not set';

// Two charts that filter each other. Picking Offshore narrows the
// designation bars to Offshore, and picking a designation narrows the
// location donut to it. Each chart is filtered by the other's pick but
// never by its own, so every slice stays visible and can be switched.
function ResourceInsights({ refreshKey, onNavigate }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  // Both only ever increase, so their sum changes on every retry or refresh.
  const [retries, setRetries] = useState(0);
  const retry = () => setRetries((count) => count + 1);
  const byLocation = useGroupSummary('resources', 'locationType', { designation: filters.designation }, refreshKey + retries);
  const byDesignation = useGroupSummary('resources', 'designation', { locationType: filters.locationType }, refreshKey + retries);

  const toggle = (field, value) => setFilters((current) => ({ ...current, [field]: current[field] === value ? null : value }));
  const clear = (field) => setFilters((current) => ({ ...current, [field]: null }));
  const chips = Object.entries(filters)
    .filter(([, value]) => value !== null)
    .map(([field, value]) => ({ key: field, label: value, onRemove: () => clear(field) }));

  // The hooks keep the previous result while a new one loads, so the match
  // count is only worked out once both charts have settled on the current
  // filters. Reading it earlier would show the last filter's number.
  const chartFailed = Boolean(byLocation.error || byDesignation.error);
  const settled = [byLocation, byDesignation].every((chart) => chart.data && !chart.isLoading && !chart.error);
  let matchingText = 'Loading…';
  if (chartFailed) matchingText = 'Match count unavailable';
  else if (settled) {
    const matching =
      filters.locationType !== null
        ? (byLocation.data.groups.find((group) => group.value === filters.locationType)?.count ?? 0)
        : byLocation.data.total;
    matchingText = `${formatCount(matching)} resources match`;
  }

  const designations = byDesignation.data?.groups ?? [];
  const shown = designations.slice(0, TOP_DESIGNATIONS);
  // From the backend's own total, not the sum of the groups it sent: it
  // cuts the group list off at 100, and those rows still belong to "Other".
  const shownCount = shown.reduce((sum, group) => sum + group.count, 0);
  const otherCount = Math.max(0, (byDesignation.data?.total ?? 0) - shownCount);
  const maxCount = Math.max(1, ...shown.map((group) => group.count));

  return (
    <InsightPanel
      id="resource-insights"
      title="Resources"
      linkLabel="Open Resources table"
      onLink={() => onNavigate('resources')}
      summary={<FilterSummary matchingText={matchingText} chips={chips} onClearAll={() => setFilters(NO_FILTERS)} />}
    >
      <InsightCard
        title="Onsite and offshore"
        error={byLocation.error}
        errorLabel="Could not load the location split"
        hasData={byLocation.data !== null}
        onRetry={retry}
      >
        {byLocation.data && (
          <DonutChart
            segments={byLocation.data.groups.map((group) => ({
              key: keyOf(group.value),
              label: labelOf(group.value),
              count: group.count,
              selectable: group.value !== null,
            }))}
            selectedKey={filters.locationType}
            onSelect={(key) => toggle('locationType', key)}
            centerLabel="resources"
          />
        )}
      </InsightCard>

      <InsightCard
        title="Top designations"
        error={byDesignation.error}
        errorLabel="Could not load the designations"
        hasData={byDesignation.data !== null}
        onRetry={retry}
      >
        {shown.length === 0 ? (
          <p className={styles.muted}>No resources match.</p>
        ) : (
          <BarList
            max={maxCount}
            rows={[
              ...shown.map((group) => ({
                key: keyOf(group.value),
                label: labelOf(group.value),
                count: group.count,
                pressed: filters.designation === group.value,
                disabled: group.value === null,
                onClick: () => toggle('designation', group.value),
              })),
              ...(otherCount > 0 ? [{ key: '__other', label: 'Other designations', count: otherCount }] : []),
            ]}
          />
        )}
      </InsightCard>
    </InsightPanel>
  );
}

ResourceInsights.propTypes = {
  refreshKey: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default ResourceInsights;
