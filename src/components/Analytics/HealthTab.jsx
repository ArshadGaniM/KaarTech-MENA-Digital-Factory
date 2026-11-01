import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsHealth } from '../../hooks/useAnalyticsData';
import { monthLabel, percent } from '../../lib/analyticsData';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import LoadGate from './LoadGate';
import { BarsChart, TrendChart } from './charts';
import styles from './Analytics.module.css';


function Charts({ rows }) {
  const [sortBy, setSortBy] = useState('live');
  const [weeksTable, setWeeksTable] = useState('all');
  const [filledSort, setFilledSort] = useState('least');
  const [filledTop, setFilledTop] = useState('12');

  // 51: live and deleted rows in each table.
  const counts = rows.filter((row) => row.kind === 'count').map((row) => ({ name: row.table, Live: row.live, Deleted: row.deleted })).sort((a, b) => (sortBy === 'name' ? a.name.localeCompare(b.name) : b[sortBy === 'deleted' ? 'Deleted' : 'Live'] - a[sortBy === 'deleted' ? 'Deleted' : 'Live'] || a.name.localeCompare(b.name)));

  // 52: rows added each week.
  const tables = [...new Set(rows.filter((row) => row.kind === 'week').map((row) => row.table))].sort();
  const weekly = (() => {
    const byWeek = new Map();
    for (const row of rows.filter((entry) => entry.kind === 'week' && (weeksTable === 'all' || entry.table === weeksTable))) byWeek.set(row.week, (byWeek.get(row.week) ?? 0) + row.added);
    return [...byWeek].sort((a, b) => a[0].localeCompare(b[0])).map(([week, added]) => ({ week, label: `${monthLabel(week.slice(0, 7))} ${week.slice(8)}`, added }));
  })();

  // 53: how many resources fill in each field.
  const filled = rows
    .filter((row) => row.kind === 'blank')
    .map((row) => ({ name: row.field, value: percent(row.live - row.blank, row.live) }))
    .sort((a, b) => (filledSort === 'least' ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name))
    .slice(0, Number(filledTop));

  return (
    <div className={styles.grid}>
      <ChartCard
        wide
        title="Live and deleted rows per table"
        columns={['Table', 'Live', 'Deleted']}
        rows={counts.map((entry) => [entry.name, entry.Live, entry.Deleted])}
        controls={<ControlSelect label="Order by" value={sortBy} options={[{ value: 'live', label: 'Live rows' }, { value: 'deleted', label: 'Deleted rows' }, { value: 'name', label: 'Name' }]} onChange={setSortBy} />}
      >
        <BarsChart data={counts} stacked series={[{ key: 'Live', label: 'Live' }, { key: 'Deleted', label: 'Deleted' }]} />
      </ChartCard>

      <ChartCard
        title="Rows added each week"
        summary="The last 12 weeks, counted from the day each row was created. Weeks start on a Monday."
        columns={['Week starting', 'Rows added']}
        rows={weekly.map((entry) => [entry.week, entry.added])}
        controls={<ControlSelect label="Table" value={weeksTable} options={[{ value: 'all', label: 'All tables' }, ...tables]} onChange={setWeeksTable} />}
      >
        <TrendChart data={weekly} bars={[{ key: 'added', label: 'Rows added' }]} />
      </ChartCard>

      <ChartCard
        title="How completely resources are filled in"
        summary="The share of live resources with a value in each field."
        columns={['Field', 'Filled %']}
        rows={filled.map((entry) => [entry.name, entry.value])}
        controls={
          <>
            <ControlSelect label="Show" value={filledSort} options={[{ value: 'least', label: 'Least filled first' }, { value: 'most', label: 'Most filled first' }]} onChange={setFilledSort} />
            <ControlSelect label="Fields" value={filledTop} options={['5', '10', '12']} onChange={setFilledTop} />
          </>
        }
      >
        <BarsChart sideways data={filled} />
      </ChartCard>
    </div>
  );
}

Charts.propTypes = { rows: PropTypes.arrayOf(PropTypes.object).isRequired };

// The data health visuals: how much is stored, how fast it grows and how complete it is.
function HealthTab({ refreshKey }) {
  const [retries, setRetries] = useState(0);
  const health = useAnalyticsHealth(refreshKey + retries);

  return (
    <div className={styles.page}>
      <LoadGate results={[health]} what="the data health" onRetry={() => setRetries((count) => count + 1)}>
        <Charts rows={health.data?.rows ?? []} />
      </LoadGate>
    </div>
  );
}

HealthTab.propTypes = { refreshKey: PropTypes.number.isRequired };

export default HealthTab;
