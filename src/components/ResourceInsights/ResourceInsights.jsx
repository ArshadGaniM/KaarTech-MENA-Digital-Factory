import { useState } from 'react';
import PropTypes from 'prop-types';
import DonutChart from '../DonutChart';
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
  const byLocation = useGroupSummary('resources', 'locationType', { designation: filters.designation }, refreshKey);
  const byDesignation = useGroupSummary('resources', 'designation', { locationType: filters.locationType }, refreshKey);

  const toggle = (field, value) => setFilters((current) => ({ ...current, [field]: current[field] === value ? null : value }));
  const clear = (field) => setFilters((current) => ({ ...current, [field]: null }));
  const hasFilters = filters.locationType !== null || filters.designation !== null;

  // The hooks keep the previous result while a new one loads, so the match
  // count is only worked out once both charts have settled on the current
  // filters. Reading it earlier would show the last filter's number.
  const chartFailed = Boolean(byLocation.error || byDesignation.error);
  const settled = [byLocation, byDesignation].every((chart) => chart.data && !chart.isLoading && !chart.error);
  let matching = null;
  if (settled) {
    matching =
      filters.locationType !== null
        ? (byLocation.data.groups.find((group) => group.value === filters.locationType)?.count ?? 0)
        : byLocation.data.total;
  }
  let matchingText = 'Loading…';
  if (chartFailed) matchingText = 'Match count unavailable';
  else if (matching !== null) matchingText = `${formatCount(matching)} resources match`;

  const designations = byDesignation.data?.groups ?? [];
  const shown = designations.slice(0, TOP_DESIGNATIONS);
  // From the backend's own total, not the sum of the groups it sent: it
  // cuts the group list off at 100, and those rows still belong to "Other".
  const shownCount = shown.reduce((sum, group) => sum + group.count, 0);
  const otherCount = Math.max(0, (byDesignation.data?.total ?? 0) - shownCount);
  const maxCount = Math.max(1, ...shown.map((group) => group.count));

  return (
    <section aria-labelledby="resource-insights" className={styles.insights}>
      <div className={styles.header}>
        <h2 id="resource-insights" className={styles.title}>
          Resources
        </h2>
        <button type="button" className={styles.link} onClick={() => onNavigate('resources')}>
          Open Resources table
        </button>
      </div>

      <div className={styles.filterRow}>
        <p className={styles.matching} role="status" aria-live="polite">
          {matchingText}
        </p>
        {filters.locationType !== null && (
          <button type="button" className={styles.chip} onClick={() => clear('locationType')}>
            {`Remove filter ${filters.locationType}`}
          </button>
        )}
        {filters.designation !== null && (
          <button type="button" className={styles.chip} onClick={() => clear('designation')}>
            {`Remove filter ${filters.designation}`}
          </button>
        )}
        {hasFilters && (
          <button type="button" className={styles.clear} onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Onsite and offshore</h3>
          {byLocation.error ? (
            <p className={styles.error} role="alert">
              Could not load the location split: {byLocation.error.message}
            </p>
          ) : byLocation.data === null ? (
            <p className={styles.muted}>Loading…</p>
          ) : (
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
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Top designations</h3>
          {byDesignation.error ? (
            <p className={styles.error} role="alert">
              Could not load the designations: {byDesignation.error.message}
            </p>
          ) : byDesignation.data === null ? (
            <p className={styles.muted}>Loading…</p>
          ) : shown.length === 0 ? (
            <p className={styles.muted}>No resources match.</p>
          ) : (
            <ul className={styles.bars}>
              {shown.map((group) => (
                <li key={keyOf(group.value)}>
                  <button
                    type="button"
                    className={styles.barRow}
                    aria-pressed={filters.designation === group.value}
                    disabled={group.value === null}
                    onClick={() => toggle('designation', group.value)}
                  >
                    <span className={styles.barLabel}>{labelOf(group.value)}</span>{' '}
                    <span className={styles.barTrack} aria-hidden="true">
                      <span className={styles.barFill} style={{ width: `${(group.count / maxCount) * 100}%` }} />
                    </span>{' '}
                    <span className={styles.barValue}>{formatCount(group.count)}</span>
                  </button>
                </li>
              ))}
              {otherCount > 0 && (
                <li className={styles.otherRow}>
                  <span className={styles.barLabel}>Other designations</span>
                  <span className={styles.barValue}>{formatCount(otherCount)}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

ResourceInsights.propTypes = {
  refreshKey: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default ResourceInsights;
