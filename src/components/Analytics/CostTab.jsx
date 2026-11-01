import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsCatalog, useAnalyticsSeats } from '../../hooks/useAnalyticsData';
import { useCrossFilters } from '../../hooks/useCrossFilters';
import { useMonthRange } from '../../hooks/useMonthRange';
import { applyFilters, applyFiltersExcept, labelOf, monthLabel, monthsFromTo, percent, teamLabel } from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import LoadGate from './LoadGate';
import MonthSlicers from './MonthSlicers';
import SlicerBar from './SlicerBar';
import { BarsChart, DonutPie, TrendChart } from './charts';
import styles from './Analytics.module.css';

const NO_FILTERS = { departmentName: null, team: null, practiceName: null, positionName: null };
const SLICERS = [
  { field: 'departmentName', label: 'Department' },
  { field: 'team', label: 'Team' },
  { field: 'practiceName', label: 'Practice' },
  { field: 'positionName', label: 'Seat type' },
];
const LABELS = Object.fromEntries(SLICERS.map((slicer) => [slicer.field, slicer.label]));
const TOP_OPTIONS = ['5', '10', '15', '20'];
const COST_TYPES = [{ value: 'total', label: 'Total' }, { value: 'onsite', label: 'Onsite' }, { value: 'offshore', label: 'Offshore' }];
const SOURCE_LABELS = { actualPeople: 'Actual cost', plannedPeople: 'Planned cost', defaultPeople: 'Default (Senior Consultant)', missingPeople: 'No cost found' };
// A seat from an older backend has no cost fields, so they count as 0.
const costOf = (seat, type) => {
  const onsite = seat.onsiteCost ?? 0;
  const offshore = seat.offshoreCost ?? 0;
  return type === 'onsite' ? onsite : type === 'offshore' ? offshore : onsite + offshore;
};
const designationKey = (name) => name.trim().toLowerCase();
const usd = (value) => Math.round(value);
const gradeNumber = (grade) => Number(/(\d+)/.exec(grade ?? '')?.[1] ?? 0);
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

// The ranked names of `field` by total cost, biggest first.
const topNames = (rows, field, count) => {
  const totals = new Map();
  for (const row of rows) totals.set(labelOf(row[field]), (totals.get(labelOf(row[field])) ?? 0) + costOf(row, 'total'));
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, count).map(([name]) => name);
};

function Charts({ seats, catalog, range, filters, onToggle }) {
  const [stackBy, setStackBy] = useState('departmentName');
  const [costType, setCostType] = useState('total');
  const [teamTop, setTeamTop] = useState('10');
  const [side, setSide] = useState('offshoreCost');
  const [ladderSide, setLadderSide] = useState('both');
  const [perHourBy, setPerHourBy] = useState('all');

  const months = monthsFromTo(range.from, range.to);
  const rows = useMemo(() => applyFilters(seats, filters), [seats, filters]);
  const focusRows = rows.filter((seat) => seat.month === range.focus);
  const planned = catalog.filter((row) => row.kind === 'plannedCost');
  const actual = catalog.filter((row) => row.kind === 'actualCost');

  // 39: what each department costs every month.
  const stackNames = topNames(rows, stackBy, 6);
  const stackData = months.map((month) => ({
    label: monthLabel(month),
    ...Object.fromEntries(stackNames.map((name) => [name, usd(sum(rows.filter((seat) => seat.month === month && labelOf(seat[stackBy]) === name), (seat) => costOf(seat, costType)))])),
  }));

  // 40: which teams cost the most in the focus month.
  const teams = (() => {
    const totals = new Map();
    for (const seat of applyFiltersExcept(seats, filters, 'team').filter((row) => row.month === range.focus && row.filled)) totals.set(seat.team, (totals.get(seat.team) ?? 0) + costOf(seat, 'total'));
    return [...totals].map(([name, value]) => ({ name, value: usd(value) })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, Number(teamTop));
  })();

  // 41: the planned cost of each designation against what people there really cost.
  const designations = planned.map((row) => row.name);
  const actualOf = (designation) => {
    const own = actual.filter((row) => designationKey(row.name) === designationKey(designation) && row[side] !== null);
    return own.length === 0 ? null : usd(sum(own, (row) => row[side]) / own.length);
  };
  const actualCount = actual.filter((row) => row[side] !== null).length;
  const versus = [...new Set(designations)].map((name) => ({ name, Planned: usd(planned.find((row) => row.name === name)[side]), Actual: actualOf(name) }));

  // 42: how the month's cost splits between onsite and offshore.
  const split = [
    { name: 'Onsite', value: usd(sum(focusRows, (seat) => costOf(seat, 'onsite'))) },
    { name: 'Offshore', value: usd(sum(focusRows, (seat) => costOf(seat, 'offshore'))) },
  ].filter((entry) => entry.value > 0);

  // 43: the planned cost at each grade.
  const ladder = [...planned].sort((a, b) => gradeNumber(a.grade) - gradeNumber(b.grade)).map((row) => ({ name: `${row.grade} ${row.name}`, Offshore: usd(row.offshoreCost), Onsite: usd(row.onsiteCost) }));
  const ladderSeries = ladderSide === 'both' ? ['Offshore', 'Onsite'] : [ladderSide];

  // 44: where each person's cost figure came from.
  const sources = Object.entries(SOURCE_LABELS).map(([key, name]) => ({ name, value: sum(focusRows, (seat) => seat[key]) })).filter((entry) => entry.value > 0);

  // 45: cost for each hour allocated.
  const perHourNames = perHourBy === 'all' ? ['All seats'] : topNames(rows, 'departmentName', 5);
  const perHour = months.map((month) => ({
    label: monthLabel(month),
    ...Object.fromEntries(
      perHourNames.map((name) => {
        const inGroup = rows.filter((seat) => seat.month === month && (perHourBy === 'all' || labelOf(seat.departmentName) === name));
        const hours = sum(inGroup, (seat) => seat.allocatedHours);
        return [name, hours === 0 ? null : Math.round((sum(inGroup, (seat) => costOf(seat, 'total')) / hours) * 100) / 100];
      })
    ),
  }));

  return (
    <div className={styles.grid}>
      <ChartCard
        wide
        title="Monthly allocated cost"
        summary="USD a month, by the Control Center cost rules."
        columns={['Month', ...stackNames]}
        rows={stackData.map((entry) => [entry.label, ...stackNames.map((name) => entry[name])])}
        controls={
          <>
            <ControlSelect label="Stack by" value={stackBy} options={[{ value: 'departmentName', label: 'Department' }, { value: 'practiceName', label: 'Practice' }, { value: 'positionName', label: 'Seat type' }]} onChange={setStackBy} />
            <ControlSelect label="Cost" value={costType} options={COST_TYPES} onChange={setCostType} />
          </>
        }
      >
        <TrendChart data={stackData} areas={stackNames.map((name) => ({ key: name, label: name }))} />
      </ChartCard>

      <ChartCard
        title={`Cost by team in ${monthLabel(range.focus)}`}
        columns={['Team', 'USD']}
        rows={teams.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Show top" value={teamTop} options={TOP_OPTIONS} onChange={setTeamTop} />}
      >
        <BarsChart sideways data={teams} activeName={filters.team} onPick={(name) => onToggle('team', name)} />
      </ChartCard>

      <ChartCard
        title="Onsite and offshore cost"
        columns={['Location', 'USD']}
        rows={split.map((entry) => [entry.name, entry.value])}
      >
        <DonutPie data={split} total={formatCount(sum(split, (entry) => entry.value))} centerLabel={`USD, ${monthLabel(range.focus)}`} />
      </ChartCard>

      <ChartCard
        title="Planned against actual cost"
        summary={actualCount === 0 ? 'No actual costs are recorded yet, so every actual shows a dash.' : `Actual is the average of ${actualCount} recorded costs. A dash means none for that designation.`}
        columns={['Designation', 'Planned', 'Actual']}
        rows={versus.map((entry) => [entry.name, entry.Planned, entry.Actual ?? '–'])}
        controls={<ControlSelect label="Location" value={side} options={[{ value: 'offshoreCost', label: 'Offshore' }, { value: 'onsiteCost', label: 'Onsite' }]} onChange={setSide} />}
      >
        <BarsChart sideways data={versus} series={[{ key: 'Planned', label: 'Planned' }, { key: 'Actual', label: 'Actual' }]} />
      </ChartCard>

      <ChartCard
        title="Planned cost by grade"
        columns={['Grade', ...ladderSeries]}
        rows={ladder.map((entry) => [entry.name, ...ladderSeries.map((key) => entry[key])])}
        controls={<ControlSelect label="Location" value={ladderSide} options={[{ value: 'both', label: 'Both' }, { value: 'Offshore', label: 'Offshore' }, { value: 'Onsite', label: 'Onsite' }]} onChange={setLadderSide} />}
      >
        <BarsChart sideways data={ladder} series={ladderSeries.map((key) => ({ key, label: key }))} />
      </ChartCard>

      <ChartCard
        title={`Where the cost figures come from in ${monthLabel(range.focus)}`}
        summary="Counts each person once for every Consultant or Lead Consultant seat they hold."
        columns={['Source', 'People']}
        rows={sources.map((entry) => [entry.name, entry.value])}
      >
        <DonutPie data={sources} total={formatCount(sum(sources, (entry) => entry.value))} centerLabel="people" />
      </ChartCard>

      <ChartCard
        wide
        title="Cost for each allocated hour"
        summary="USD per allocated hour. A month with no allocated hours is left blank."
        columns={['Month', ...perHourNames]}
        rows={perHour.map((entry) => [entry.label, ...perHourNames.map((name) => entry[name] ?? '–')])}
        controls={<ControlSelect label="One line per" value={perHourBy} options={[{ value: 'all', label: 'All seats' }, { value: 'department', label: 'Department' }]} onChange={setPerHourBy} />}
      >
        <TrendChart data={perHour} lines={perHourNames.map((name) => ({ key: name, label: name }))} />
      </ChartCard>
    </div>
  );
}

Charts.propTypes = {
  seats: PropTypes.arrayOf(PropTypes.object).isRequired,
  catalog: PropTypes.arrayOf(PropTypes.object).isRequired,
  range: PropTypes.object.isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
};

// The cost visuals: what the people in seats cost, and what they were planned to cost.
function CostTab({ refreshKey }) {
  const [retries, setRetries] = useState(0);
  const range = useMonthRange();
  const seatsResult = useAnalyticsSeats(range.from, range.to, refreshKey + retries);
  const catalog = useAnalyticsCatalog(refreshKey + retries);
  const { filters, toggle, set, clearAll } = useCrossFilters(NO_FILTERS);

  const seats = useMemo(() => (seatsResult.data?.rows ?? []).map((seat) => ({ ...seat, team: teamLabel(seat.teamCode, seat.teamName) })), [seatsResult.data]);
  const slicers = SLICERS.map((slicer) => ({ ...slicer, values: [...new Set(seats.map((seat) => labelOf(seat[slicer.field])))].sort() }));
  const focusSeats = applyFilters(seats, filters).filter((seat) => seat.month === range.focus);
  const totalCost = focusSeats.reduce((total, seat) => total + costOf(seat, 'total'), 0);
  const uncertain = focusSeats.reduce((total, seat) => total + (seat.defaultPeople ?? 0) + (seat.missingPeople ?? 0), 0);

  return (
    <div className={styles.page}>
      <MonthSlicers range={range} />
      <LoadGate results={[seatsResult, catalog]} what="the costs" onRetry={() => setRetries((count) => count + 1)}>
        <SlicerBar
          slicers={slicers}
          filters={filters}
          labels={LABELS}
          onChange={set}
          onReset={clearAll}
          matching={`USD ${formatCount(Math.round(totalCost))} in ${monthLabel(range.focus)} across ${formatCount(focusSeats.length)} seats (${percent(focusSeats.filter((seat) => seat.filled).length, focusSeats.length)}% filled)${uncertain > 0 ? `. ${uncertain} people are costed by default or have no cost.` : ''}`}
        />
        <Charts seats={seats} catalog={catalog.data?.rows ?? []} range={range} filters={filters} onToggle={toggle} />
      </LoadGate>
    </div>
  );
}

CostTab.propTypes = {
  refreshKey: PropTypes.number.isRequired,
};

export default CostTab;
